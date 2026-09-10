import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { handleCampaignRequest } from '../lib/campaign/api.mjs';

function d1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_bright_boomerang.sql', import.meta.url), 'utf8'));
  const wrap = (sql, args = []) => ({
    bind: (...next) => wrap(sql, next),
    first: async () => sqlite.prepare(sql).get(...args) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...args) }),
    run: async () => run(sql, args),
    _sql: sql, _args: args,
  });
  const run = (sql, args) => {
    const result = sqlite.prepare(sql).run(...args);
    return { success: true, meta: { changes: Number(result.changes) } };
  };
  return {
    sqlite,
    prepare: wrap,
    batch: async statements => {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map(statement => run(statement._sql, statement._args));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  };
}

function setup() {
  const db = d1(); let rolls = 0;
  const adapter = {
    initialState: async () => ({ count: 0, hidden: 'GM ONLY', rolls: [] }),
    project: async (state, member) => member.role === 'gm' ? state : { count: state.count, rolls: state.rolls },
    command: async (state, member, type, payload) => {
      if (type === 'gm.edit' && member.role !== 'gm') throw Object.assign(new Error('Game master only.'), { status: 403 });
      if (!['increment', 'roll', 'gm.edit'].includes(type)) throw new Error('Unknown command.');
      if (type === 'roll') state.rolls.push(++rolls);
      else state.count += Number.isInteger(payload.amount) ? payload.amount : 1;
      return { state, result: { actor: member.id, roll: type === 'roll' ? rolls : null } };
    },
    validateImport: state => {
      if (!state || !Number.isSafeInteger(state.count) || typeof state.hidden !== 'string' || !Array.isArray(state.rolls)) throw new Error('Bad state');
      return { count: state.count, hidden: state.hidden, rolls: state.rolls };
    },
  };
  async function call(path, { method = 'GET', body, cookie, origin = 'https://game.example', headers = {} } = {}) {
    const request = new Request(`https://game.example${path}`, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(method === 'POST' ? { origin, 'content-type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const response = await handleCampaignRequest(request, db, adapter);
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
  }
  const post = (path, body, cookie, extra) => call(path, { method: 'POST', body, cookie, ...extra });
  const create = () => post('/api/campaigns', { title: 'After Hours', name: 'GM' });
  async function join(gm, name = 'Player') {
    const invite = await post(`/api/campaigns/${gm.body.campaign.id}/invite`, {}, gm.cookie);
    return post(`/api/campaigns/${gm.body.campaign.id}/join`, { secret: invite.body.secret, name });
  }
  return { db, adapter, call, post, create, join, getRolls: () => rolls };
}

test('create, join, reload, list and resume preserve role-specific sessions and hide secrets', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  assert.equal(gm.status, 201);
  assert.match(gm.headers.get('set-cookie'), /Secure; HttpOnly; SameSite=Strict/);
  assert.equal(gm.body.campaign.state.hidden, 'GM ONLY');
  const player = await app.join(gm);
  assert.equal(player.status, 201);
  assert.equal(player.body.member.role, 'player');
  assert.equal(player.body.campaign.state.hidden, undefined);
  assert.equal(player.body.members.length, 2);
  const reload = await app.call(`/api/campaigns/${id}`, { cookie: player.cookie });
  assert.equal(reload.body.member.id, player.body.member.id);
  assert.equal(JSON.stringify(reload.body).includes('hash'), false);
  assert.equal(JSON.stringify(reload.body).includes('GM ONLY'), false);
  const list = await app.call('/api/campaigns', { cookie: player.cookie });
  assert.equal(list.body.campaigns[0].id, id);
  assert.equal(list.body.campaigns[0].state, undefined);
  const resumed = await app.post(`/api/campaigns/${id}/resume`, { secret: player.body.resumeSecret });
  assert.equal(resumed.status, 200);
  assert.equal(resumed.body.member.id, player.body.member.id);
  assert.notEqual(resumed.cookie, player.cookie);
  assert.equal((await app.call(`/api/campaigns/${id}`, { cookie: player.cookie })).status, 401);
  assert.equal((await app.call(`/api/campaigns/${id}`, { cookie: resumed.cookie })).status, 200);
  const rows = app.db.sqlite.prepare('SELECT session_hash, resume_hash FROM memberships').all();
  for (const row of rows) {
    assert.match(row.session_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(row.resume_hash, player.body.resumeSecret);
    assert.notEqual(row.resume_hash, gm.body.resumeSecret);
  }
});

test('server actor wins spoofed fields; players cannot create invites, revoke, or run GM commands', async () => {
  const app = setup(), gm = await app.create(), player = await app.join(gm), id = gm.body.campaign.id;
  assert.equal((await app.post(`/api/campaigns/${id}/invite`, { role: 'gm' }, player.cookie)).status, 403);
  assert.equal((await app.post(`/api/campaigns/${id}/revoke`, { memberId: gm.body.member.id, role: 'gm' }, player.cookie)).status, 403);
  const denied = await app.post(`/api/campaigns/${id}/commands`, { operationId: 'spoof', expectedRevision: 0, type: 'gm.edit', payload: { role: 'gm', memberId: gm.body.member.id } }, player.cookie);
  assert.equal(denied.status, 403);
  const allowed = await app.post(`/api/campaigns/${id}/commands`, { operationId: 'normal', expectedRevision: 0, type: 'increment', payload: { actor: gm.body.member.id, amount: 1 }, member: gm.body.member }, player.cookie);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.body.result.actor, player.body.member.id);
  assert.equal((await app.post(`/api/campaigns/${id}`, { state: { hidden: 'overwrite' } }, player.cookie)).status, 404);
});

test('commands replay original roll; reused operationId with different content conflicts; stale writes conflict', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const body = { operationId: 'roll-1', expectedRevision: 0, type: 'roll', payload: {} };
  const original = await app.post(`/api/campaigns/${id}/commands`, body, gm.cookie);
  const replay = await app.post(`/api/campaigns/${id}/commands`, body, gm.cookie);
  assert.deepEqual(replay.body, original.body);
  assert.equal(app.getRolls(), 1);
  assert.equal((await app.post(`/api/campaigns/${id}/commands`, { ...body, payload: { different: true } }, gm.cookie)).status, 409);
  assert.equal((await app.post(`/api/campaigns/${id}/commands`, { ...body, operationId: 'stale' }, gm.cookie)).status, 409);
  assert.equal(app.db.sqlite.prepare('SELECT COUNT(*) AS total FROM operations').get().total, 1);
  assert.equal((await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie })).body.campaign.revision, 1);
});

test('simultaneous duplicate rolls commit and return exactly one roll, with discarded speculative work', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const originalCommand = app.adapter.command;
  let entered = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  app.adapter.command = async (...args) => {
    const outcome = await originalCommand(...args);
    if (++entered === 2) release();
    await gate;
    return outcome;
  };
  const body = { operationId: 'racing-roll', expectedRevision: 0, type: 'roll', payload: {} };
  const [one, two] = await Promise.all([app.post(`/api/campaigns/${id}/commands`, body, gm.cookie), app.post(`/api/campaigns/${id}/commands`, body, gm.cookie)]);
  assert.equal(one.status, 200); assert.equal(two.status, 200);
  assert.deepEqual(one.body, two.body);
  const view = await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie });
  assert.equal(view.body.campaign.revision, 1);
  assert.equal(view.body.campaign.state.rolls.length, 1);
  assert.equal(view.body.campaign.state.rolls[0], one.body.result.roll);
  assert.equal(app.db.sqlite.prepare('SELECT COUNT(*) AS total FROM operations').get().total, 1);
});

test('different concurrent commands cannot overwrite each other', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const originalCommand = app.adapter.command;
  let entered = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  app.adapter.command = async (...args) => { const outcome = await originalCommand(...args); if (++entered === 2) release(); await gate; return outcome; };
  const base = { expectedRevision: 0, type: 'increment', payload: { amount: 1 } };
  const results = await Promise.all(['one', 'two'].map(operationId => app.post(`/api/campaigns/${id}/commands`, { ...base, operationId }, gm.cookie)));
  assert.deepEqual(results.map(item => item.status).sort(), [200, 409]);
  assert.equal((await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie })).body.campaign.state.count, 1);
});

test('revocation blocks sessions, resume capabilities, and an in-flight write at commit', async () => {
  const app = setup(), gm = await app.create(), player = await app.join(gm), id = gm.body.campaign.id;
  let entered, release;
  const began = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const originalCommand = app.adapter.command;
  app.adapter.command = async (...args) => { const outcome = await originalCommand(...args); entered(); await gate; return outcome; };
  const pending = app.post(`/api/campaigns/${id}/commands`, { operationId: 'revoked', expectedRevision: 0, type: 'increment', payload: {} }, player.cookie);
  await began;
  assert.equal((await app.post(`/api/campaigns/${id}/revoke`, { memberId: player.body.member.id }, gm.cookie)).status, 200);
  release();
  assert.equal((await pending).status, 401);
  assert.equal((await app.post(`/api/campaigns/${id}/resume`, { secret: player.body.resumeSecret })).status, 403);
  assert.equal((await app.call(`/api/campaigns/${id}`, { cookie: player.cookie })).status, 401);
  assert.equal((await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie })).body.campaign.revision, 0);
  assert.equal(app.db.sqlite.prepare('SELECT COUNT(*) AS total FROM operations').get().total, 0);
});

test('GM exports import into a new campaign; player exports omit hidden state and cannot import', async () => {
  const app = setup(), gm = await app.create(), player = await app.join(gm), id = gm.body.campaign.id;
  await app.post(`/api/campaigns/${id}/commands`, { operationId: 'prepare', expectedRevision: 0, type: 'increment', payload: { amount: 3 } }, gm.cookie);
  const backup = await app.call(`/api/campaigns/${id}/export`, { cookie: gm.cookie });
  assert.equal(backup.body.campaign.state.hidden, 'GM ONLY');
  assert.equal(JSON.stringify(backup.body).includes('resume'), false);
  assert.equal(JSON.stringify(backup.body).includes('session'), false);
  const imported = await app.post('/api/import', { name: 'New GM', backup: backup.body });
  assert.equal(imported.status, 201);
  assert.notEqual(imported.body.campaign.id, id);
  assert.equal(imported.body.campaign.state.count, 3);
  assert.equal(imported.body.campaign.revision, 0);
  assert.equal(imported.body.members.length, 1);
  assert.equal(imported.body.member.role, 'gm');
  const playerBackup = await app.call(`/api/campaigns/${id}/export`, { cookie: player.cookie });
  assert.equal(playerBackup.body.campaign.state.hidden, undefined);
  assert.equal((await app.post('/api/import', { name: 'No', backup: playerBackup.body })).status, 400);
  backup.body.campaign.state.count = 'corrupt';
  assert.equal((await app.post('/api/import', { name: 'No', backup: backup.body })).status, 400);
});

test('resume rotation invalidates the former capability; cross-origin requests and query secrets are rejected', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const rotated = await app.post(`/api/campaigns/${id}/resume-link`, {}, gm.cookie);
  assert.equal(rotated.status, 200);
  assert.equal((await app.post(`/api/campaigns/${id}/resume`, { secret: gm.body.resumeSecret })).status, 403);
  assert.equal((await app.post(`/api/campaigns/${id}/resume`, { secret: rotated.body.secret })).status, 200);
  assert.equal((await app.post('/api/campaigns', { title: 'Bad', name: 'Bad' }, undefined, { origin: 'https://evil.example' })).status, 403);
  assert.equal((await app.call(`/api/campaigns/${id}?secret=not-allowed`)).status, 400);
  assert.equal((await app.post('/api/campaigns', { title: 'Bad', name: 'x'.repeat(81) })).status, 400);
});

test('atomic batch failure rolls back both state and receipt', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  app.db.sqlite.exec("CREATE TRIGGER reject_receipt BEFORE INSERT ON operations BEGIN SELECT RAISE(ABORT, 'failure'); END;");
  const failed = await app.post(`/api/campaigns/${id}/commands`, { operationId: 'rollback', expectedRevision: 0, type: 'increment', payload: {} }, gm.cookie);
  assert.equal(failed.status, 500);
  const view = await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie });
  assert.equal(view.body.campaign.state.count, 0);
  assert.equal(view.body.campaign.revision, 0);
  assert.equal(app.db.sqlite.prepare('SELECT COUNT(*) AS total FROM operations').get().total, 0);
});

test('rotated and expired invitations cannot create memberships', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const previous = await app.post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  const current = await app.post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  assert.equal((await app.post(`/api/campaigns/${id}/join`, { secret: previous.body.secret, name: 'Old invitation' })).status, 403);
  assert.equal((await app.post(`/api/campaigns/${id}/join`, { secret: current.body.secret, name: 'Current invitation' })).status, 201);
  app.db.sqlite.prepare('UPDATE invites SET expires_at = ? WHERE campaign_id = ?').run(Date.now() - 1, id);
  assert.equal((await app.post(`/api/campaigns/${id}/join`, { secret: current.body.secret, name: 'Expired invitation' })).status, 403);
  assert.equal(app.db.sqlite.prepare('SELECT COUNT(*) AS total FROM memberships WHERE campaign_id = ?').get(id).total, 2);
});

test('player revocation invalidates shared invites; rejected revocations leave capabilities untouched', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const invite = await app.post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  const player = await app.post(`/api/campaigns/${id}/join`, { secret: invite.body.secret, name: 'Player' });
  assert.equal((await app.post(`/api/campaigns/${id}/revoke`, { memberId: player.body.member.id }, gm.cookie)).status, 200);
  assert.equal((await app.post(`/api/campaigns/${id}/join`, { secret: invite.body.secret, name: 'Rejoin removed member' })).status, 403);
  const fresh = await app.post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  const other = await app.create(), otherId = other.body.campaign.id;
  const otherInvite = await app.post(`/api/campaigns/${otherId}/invite`, {}, other.cookie);
  const snapshot = app.db.sqlite.prepare('SELECT * FROM invites ORDER BY hash').all();
  assert.equal((await app.post(`/api/campaigns/${id}/revoke`, { memberId: player.body.member.id }, gm.cookie)).status, 404);
  assert.equal((await app.post(`/api/campaigns/${id}/revoke`, { memberId: other.body.member.id }, gm.cookie)).status, 404);
  assert.equal((await app.post(`/api/campaigns/${otherId}/revoke`, { memberId: player.body.member.id }, gm.cookie)).status, 401);
  assert.deepEqual(app.db.sqlite.prepare('SELECT * FROM invites ORDER BY hash').all(), snapshot);
  assert.equal((await app.post(`/api/campaigns/${id}/join`, { secret: fresh.body.secret, name: 'Approved new player' })).status, 201);
  assert.equal((await app.post(`/api/campaigns/${otherId}/join`, { secret: otherInvite.body.secret, name: 'Other campaign player' })).status, 201);
});

test('invitation rotation rechecks the GM session inside the transaction', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const invite = await app.post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  const originalBatch = app.db.batch;
  let entered, release;
  const began = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  app.db.batch = async statements => { entered(); await gate; return originalBatch(statements); };
  const pending = app.post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  await began;
  assert.equal((await app.post(`/api/campaigns/${id}/resume`, { secret: gm.body.resumeSecret })).status, 200);
  release();
  assert.equal((await pending).status, 401);
  assert.equal((await app.post(`/api/campaigns/${id}/join`, { secret: invite.body.secret, name: 'Still valid' })).status, 201);
  assert.equal(app.db.sqlite.prepare('SELECT COUNT(*) AS total FROM invites WHERE campaign_id = ? AND revoked = 0').get(id).total, 1);
});

test('the 32-member capacity is enforced atomically for simultaneous joins', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  const invite = await app.post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
  for (let index = 0; index < 30; index++) assert.equal((await app.post(`/api/campaigns/${id}/join`, { secret: invite.body.secret, name: `Player ${index}` })).status, 201);
  const joined = await Promise.all(['Final one', 'Final two'].map(name => app.post(`/api/campaigns/${id}/join`, { secret: invite.body.secret, name })));
  assert.deepEqual(joined.map(item => item.status).sort(), [201, 409]);
  assert.equal(app.db.sqlite.prepare('SELECT COUNT(*) AS total FROM memberships WHERE campaign_id = ? AND revoked = 0').get(id).total, 32);
});

test('safe domain error statuses survive the adapter boundary without a state commit', async () => {
  const app = setup(), gm = await app.create(), id = gm.body.campaign.id;
  for (const status of [400, 403, 404, 409]) {
    app.adapter.command = async () => { throw Object.assign(new Error('Domain rejected request.'), { status }); };
    const result = await app.post(`/api/campaigns/${id}/commands`, { operationId: `domain-${status}`, expectedRevision: 0, type: 'increment', payload: {} }, gm.cookie);
    assert.equal(result.status, status);
  }
  assert.equal((await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie })).body.campaign.revision, 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createD1 } from './d1-harness.mjs';
import { handleCampaignRequest } from '../lib/campaign/api.mjs';
import { fateAdapter } from '../lib/fate/adapter.mjs';

function setup() {
  const migrations = new URL('../drizzle/', import.meta.url);
  const sql = readdirSync(migrations).filter(name => name.endsWith('.sql')).sort().map(name => readFileSync(new URL(name, migrations), 'utf8')).join('\n');
  const db = createD1(sql);
  async function call(path, { method = 'GET', body, cookie } = {}) {
    const request = new Request(`https://fate.example${path}`, {
      method, headers: { ...(cookie ? { cookie } : {}), ...(method === 'POST' ? { origin: 'https://fate.example', 'content-type': 'application/json' } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const response = await handleCampaignRequest(request, db, fateAdapter);
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const post = (path, body, cookie) => call(path, { method: 'POST', body, cookie });
  async function join(gm, name) {
    const id = gm.body.campaign.id;
    const invitation = await post(`/api/campaigns/${id}/invite`, {}, gm.cookie);
    assert.equal(invitation.status, 201, JSON.stringify(invitation.body));
    return post(`/api/campaigns/${id}/join`, { secret: invitation.body.secret, name });
  }
  return { db, call, post, join };
}

test('real migration, kernel, and Fate adapter complete play, persistence, private projection, retries, and restore/reclaim', async () => {
  const app = setup();
  const gm = await app.post('/api/campaigns', { title: 'Last Train Integration', name: 'Nolan GM' });
  assert.equal(gm.status, 201, JSON.stringify(gm.body));
  const id = gm.body.campaign.id;
  const player = await app.join(gm, 'Player One');
  assert.equal(player.status, 201, JSON.stringify(player.body));
  assert.ok(gm.body.campaign.state.scene.gmNotes);
  assert.equal(player.body.campaign.state.scene.gmNotes, undefined);
  let revision = 0;
  const command = async (cookie, type, payload) => {
    const body = { operationId: crypto.randomUUID(), expectedRevision: revision, type, payload };
    const result = await app.post(`/api/campaigns/${id}/commands`, body, cookie);
    assert.equal(result.status, 200, `${type}: ${JSON.stringify(result.body)}`);
    revision = result.body.revision;
    return { body, result };
  };
  await command(player.cookie, 'character.create', { name: 'Courier Mira', templateId: 'night-courier' });
  let playerView = await app.call(`/api/campaigns/${id}`, { cookie: player.cookie });
  const characterId = playerView.body.campaign.state.characters[0].id;
  assert.equal(playerView.body.campaign.state.characters[0].ownerId, player.body.member.id);
  await command(gm.cookie, 'journal.add', { text: 'Secret conductor identity', private: true });
  await command(player.cookie, 'action.propose', { characterId, action: 'overcome', approach: 'quick', intent: 'Catch the departing last train' });
  playerView = await app.call(`/api/campaigns/${id}`, { cookie: player.cookie });
  const requestId = playerView.body.campaign.state.requests[0].id;
  const unauthorizedRoll = await app.post(`/api/campaigns/${id}/commands`, { operationId: 'player-cannot-roll', expectedRevision: revision, type: 'action.roll', payload: { requestId, opposition: 0, stuntBonus: 2 } }, player.cookie);
  assert.equal(unauthorizedRoll.status, 403);
  const rolled = await command(gm.cookie, 'action.roll', { requestId, opposition: 3, stuntBonus: 0 });
  const gmRolled = await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie });
  const savedRoll = structuredClone(gmRolled.body.campaign.state.requests[0].roll);
  assert.equal(savedRoll.dice.length, 4);
  assert.equal(savedRoll.actorId, characterId);
  const retriedRoll = await app.post(`/api/campaigns/${id}/commands`, rolled.body, gm.cookie);
  assert.equal(retriedRoll.status, 200);
  assert.deepEqual(retriedRoll.body, rolled.result.body);
  assert.deepEqual((await app.call(`/api/campaigns/${id}`, { cookie: player.cookie })).body.campaign.state.requests[0].roll, savedRoll);
  await command(gm.cookie, 'action.finalize', { requestId, resolutionNote: 'The courier leaves a treasured parcel behind if the table agrees a cost.', aspectName: 'One step ahead of midnight' });
  const completed = await app.call(`/api/campaigns/${id}`, { cookie: player.cookie });
  assert.equal(completed.body.campaign.state.requests.length, 0);
  assert.equal(completed.body.campaign.state.scene.gmNotes, undefined);
  assert.equal(JSON.stringify(completed.body).includes('Secret conductor identity'), false);
  const gmCompleted = await app.call(`/api/campaigns/${id}`, { cookie: gm.cookie });
  assert.equal(gmCompleted.body.campaign.state.journal.some(entry => entry.text === 'Secret conductor identity' && entry.private), true);
  const staleSave = await app.post(`/api/campaigns/${id}/commands`, { operationId: crypto.randomUUID(), expectedRevision: gmRolled.body.campaign.revision, type: 'journal.add', payload: { text: 'Stale save must not win' } }, player.cookie);
  assert.equal(staleSave.status, 409);
  revision = completed.body.campaign.revision;
  const saved = await command(player.cookie, 'journal.add', { text: 'Saved after reloading the campaign.' });
  const retriedSave = await app.post(`/api/campaigns/${id}/commands`, saved.body, player.cookie);
  assert.deepEqual(retriedSave.body, saved.result.body);
  const persisted = await app.call(`/api/campaigns/${id}`, { cookie: player.cookie });
  assert.equal(persisted.body.campaign.state.journal.filter(entry => entry.text === 'Saved after reloading the campaign.').length, 1);
  assert.equal(persisted.body.campaign.revision, revision);

  const backup = await app.call(`/api/campaigns/${id}/export`, { cookie: gm.cookie });
  assert.equal(backup.status, 200);
  assert.equal(backup.body.access, 'gm');
  assert.ok(backup.body.campaign.state.scene.gmNotes);
  const restored = await app.post('/api/import', { name: 'Restore GM', backup: backup.body });
  assert.equal(restored.status, 201, JSON.stringify(restored.body));
  const restoredId = restored.body.campaign.id;
  assert.notEqual(restoredId, id);
  assert.equal(restored.body.campaign.revision, 0);
  assert.equal(restored.body.campaign.state.characters[0].id, characterId);
  assert.equal(restored.body.campaign.state.characters[0].ownerId, null);
  assert.equal(restored.body.campaign.state.journal.length, gmCompleted.body.campaign.state.journal.length + 1);
  const returningPlayer = await app.join(restored, 'Player One Returns');
  assert.equal(returningPlayer.status, 201, JSON.stringify(returningPlayer.body));
  assert.equal(returningPlayer.body.campaign.state.scene.gmNotes, undefined);
  assert.equal(returningPlayer.body.campaign.state.journal.some(entry => entry.private), false);
  assert.notEqual(returningPlayer.body.member.id, player.body.member.id);
  const claimed = await app.post(`/api/campaigns/${restoredId}/commands`, { operationId: 'claim-restored', expectedRevision: 0, type: 'character.claim', payload: { characterId } }, returningPlayer.cookie);
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  const afterClaimReload = await app.call(`/api/campaigns/${restoredId}`, { cookie: returningPlayer.cookie });
  assert.equal(afterClaimReload.body.campaign.state.characters[0].ownerId, returningPlayer.body.member.id);
  const reclaimedAgain = await app.post(`/api/campaigns/${restoredId}/commands`, { operationId: 'claim-again', expectedRevision: afterClaimReload.body.campaign.revision, type: 'character.claim', payload: { characterId } }, returningPlayer.cookie);
  assert.equal(reclaimedAgain.status, 409);
  const resumedSave = await app.post(`/api/campaigns/${restoredId}/commands`, { operationId: 'save-restored', expectedRevision: afterClaimReload.body.campaign.revision, type: 'journal.add', payload: { text: 'Resumed and saved after backup restoration.' } }, returningPlayer.cookie);
  assert.equal(resumedSave.status, 200, JSON.stringify(resumedSave.body));
  const finalReload = await app.call(`/api/campaigns/${restoredId}`, { cookie: returningPlayer.cookie });
  assert.equal(finalReload.body.campaign.revision, 2);
  assert.equal(finalReload.body.campaign.state.journal.at(-1).text, 'Resumed and saved after backup restoration.');
});

test('every title accepted by campaign creation remains valid for Fate backup restoration', async () => {
  const app = setup(), title = 'T'.repeat(100);
  assert.equal((await app.post('/api/campaigns', { title: 'T'.repeat(101), name: 'GM' })).status, 400);
  const gm = await app.post('/api/campaigns', { title, name: 'GM' });
  assert.equal(gm.status, 201, JSON.stringify(gm.body));
  const backup = await app.call(`/api/campaigns/${gm.body.campaign.id}/export`, { cookie: gm.cookie });
  const restored = await app.post('/api/import', { name: 'Restored GM', backup: backup.body });
  assert.equal(restored.status, 201, JSON.stringify(restored.body));
  assert.equal(restored.body.campaign.title, title);
});

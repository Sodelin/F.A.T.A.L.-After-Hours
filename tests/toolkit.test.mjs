import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createD1 } from './d1-harness.mjs';
import { handleCampaignRequest } from '../lib/campaign/api.mjs';
import { fateAdapter } from '../lib/fate/adapter.mjs';

const rating = { careful: 3, clever: 2, flashy: 2, forceful: 1, quick: 1, sneaky: 0 };
const authoredCharacter = { name: 'Dr. Aster', highConcept: 'An astronomer who negotiates with storms', trouble: 'Every promise becomes a constellation', aspects: ['My observatory travels with me', 'Nobody owns the weather'], approaches: rating };
const legacy = JSON.parse(readFileSync(new URL('./legacy-v1-save.json', import.meta.url), 'utf8'));

async function setup() {
  const migrations = new URL('../drizzle/', import.meta.url);
  const sql = readdirSync(migrations).filter(name => name.endsWith('.sql')).sort().map(name => readFileSync(new URL(name, migrations), 'utf8')).join('\n');
  const db = createD1(sql);
  async function call(path, { method = 'GET', body, cookie } = {}) {
    const request = new Request(`https://fate.example${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(method === 'POST' ? { origin: 'https://fate.example', 'content-type': 'application/json' } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const response = await handleCampaignRequest(request, db, fateAdapter);
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const post = (path, body, cookie) => call(path, { method: 'POST', body, cookie });
  const gm = await post('/api/campaigns', { title: 'Our authored campaign', name: 'GM' });
  assert.equal(gm.status, 201, JSON.stringify(gm.body));
  const id = gm.body.campaign.id;
  const view = async (actor = gm) => {
    const value = await call(`/api/campaigns/${id}`, { cookie: actor.cookie });
    assert.equal(value.status, 200, JSON.stringify(value.body));
    return value.body;
  };
  async function join(name = 'Player', campaign = gm) {
    const campaignId = campaign.body.campaign.id;
    const invite = await post(`/api/campaigns/${campaignId}/invite`, {}, campaign.cookie);
    assert.equal(invite.status, 201, JSON.stringify(invite.body));
    const player = await post(`/api/campaigns/${campaignId}/join`, { secret: invite.body.secret, name });
    assert.equal(player.status, 201, JSON.stringify(player.body));
    return player;
  }
  async function command(actor, type, payload, expectedStatus = 200) {
    const before = await view(actor);
    const body = { operationId: crypto.randomUUID(), expectedRevision: before.campaign.revision, type, payload };
    const value = await post(`/api/campaigns/${id}/commands`, body, actor.cookie);
    assert.equal(value.status, expectedStatus, `${type}: ${JSON.stringify(value.body)}`);
    return { ...value, request: body };
  }
  return { db, call, post, gm, id, view, join, command };
}

test('new schema2 campaign is an empty user-authored workspace', async () => {
  const app = await setup();
  const state = app.gm.body.campaign.state;
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.characters.length, 0);
  assert.equal(state.requests.length, 0);
  assert.equal(state.handouts.length, 0);
  assert.equal(state.scenes.length, 1);
  assert.equal(state.scene.title, 'Untitled scene');
  assert.equal(state.scene.zones.length, 1);
  assert.equal(state.scene.zones[0].name, 'Table');
  assert.equal(state.activeSceneId, state.scene.id);
  assert.deepEqual(state.aspects, state.scene.aspects);
  assert.doesNotMatch(JSON.stringify(state), /last.train|night.courier|crossing|neon.host|late.detective/i);
});

test('authored scenes, zones, map links, aspects and handouts persist with strict player projection', async () => {
  const app = await setup(), player = await app.join();
  await app.command(app.gm, 'scene.create', { title: 'Cloud Observatory' });
  let state = (await app.view()).campaign.state;
  const sceneId = state.scenes.find(scene => scene.title === 'Cloud Observatory').id;
  await app.command(app.gm, 'scene.update', { sceneId, title: 'Cloud Observatory', description: 'Our floating laboratory', objective: 'Negotiate a safe passage', gmNotes: 'PRIVATE GM PLAN: thunder is a witness', mapUrl: 'https://example.com/observatory-map.png' });
  await app.command(app.gm, 'zone.add', { sceneId, name: 'Telescope deck', description: 'Open to the sky', x: 20, y: 30 });
  await app.command(app.gm, 'zone.add', { sceneId, name: 'Storm archive', description: 'Records kept in glass', x: 70, y: 60 });
  state = (await app.view()).campaign.state;
  const authored = state.scenes.find(scene => scene.id === sceneId);
  const deck = authored.zones.find(zone => zone.name === 'Telescope deck'), archive = authored.zones.find(zone => zone.name === 'Storm archive');
  await app.command(app.gm, 'zone.connect', { sceneId, fromId: deck.id, toId: archive.id, connected: true });
  await app.command(app.gm, 'zone.update', { sceneId, zoneId: deck.id, name: 'Telescope balcony', description: 'Stars within reach', x: 25, y: 35 });
  await app.command(app.gm, 'scene.activate', { sceneId });
  await app.command(app.gm, 'aspect.add', { name: 'No horizon stays still', kind: 'situation' });
  await app.command(app.gm, 'handout.save', { title: 'Shared star chart', body: 'Everyone can consult these coordinates.', visible: true });
  await app.command(app.gm, 'handout.save', { title: 'Private witness', body: 'PRIVATE HANDOUT: the chart is forged', visible: false });
  await app.command(app.gm, 'scene.create', { title: 'PRIVATE FUTURE SCENE: Weather court' });
  for (const [type, payload] of [
    ['scene.create', { title: 'Unauthorized' }],
    ['scene.update', { sceneId, title: 'Unauthorized', description: '', objective: '', gmNotes: '' }],
    ['zone.add', { sceneId, name: 'Unauthorized' }],
    ['aspect.add', { name: 'Unauthorized', kind: 'situation' }],
    ['handout.save', { title: 'Unauthorized', body: 'No', visible: false }],
  ]) await app.command(player, type, payload, 403);
  const gmView = (await app.view()).campaign.state, playerView = (await app.view(player)).campaign.state;
  assert.equal(gmView.scene.mapUrl, 'https://example.com/observatory-map.png');
  assert.equal(gmView.scene.description, 'Our floating laboratory');
  assert.equal(gmView.scene.zones.find(zone => zone.id === deck.id).x, 25);
  assert.ok(gmView.scene.zones.find(zone => zone.id === deck.id).adjacent.includes(archive.id));
  assert.ok(gmView.scene.zones.find(zone => zone.id === archive.id).adjacent.includes(deck.id));
  assert.ok(gmView.aspects.some(aspect => aspect.name === 'No horizon stays still'));
  assert.deepEqual(gmView.aspects, gmView.scene.aspects);
  assert.equal(playerView.scenes.length, 1);
  assert.equal(playerView.scenes[0].id, sceneId);
  assert.equal(playerView.scene.gmNotes, undefined);
  assert.equal(playerView.scenes[0].gmNotes, undefined);
  assert.doesNotMatch(JSON.stringify(playerView), /PRIVATE GM PLAN|PRIVATE HANDOUT|PRIVATE FUTURE SCENE/);
  assert.ok(playerView.handouts.some(handout => handout.title === 'Shared star chart'));
  await app.command(app.gm, 'scene.update', { sceneId, title: 'Cloud Observatory', description: '', objective: '', gmNotes: '', mapUrl: 'javascript:alert(1)' }, 400);
});

test('custom character fields, equipment, stunts and dice remain authored and server-owned', async () => {
  const app = await setup(), player = await app.join(), stranger = await app.join('Other player');
  await app.command(player, 'character.create', authoredCharacter);
  let state = (await app.view(player)).campaign.state;
  const character = state.characters[0];
  assert.equal(character.ownerId, player.body.member.id);
  assert.deepEqual(character.approaches, rating);
  assert.equal(character.aspects.find(aspect => aspect.kind === 'highConcept').name, authoredCharacter.highConcept);
  assert.equal(character.aspects.find(aspect => aspect.kind === 'trouble').name, authoredCharacter.trouble);
  assert.deepEqual(character.aspects.filter(aspect => aspect.kind === 'character').map(aspect => aspect.name), authoredCharacter.aspects);
  assert.doesNotMatch(JSON.stringify(character), /courier|neighborhood|delivery/i);
  await app.command(player, 'character.edit', { characterId: character.id, highConcept: authoredCharacter.highConcept, trouble: authoredCharacter.trouble, name: 'Aster Sol', appearance: 'Silver gloves and an ink-stained coat' });
  await app.command(player, 'character.item.add', { characterId: character.id, name: 'Pocket astrolabe', quantity: 2, notes: 'Measures impossible weather' });
  await app.command(stranger, 'character.item.add', { characterId: character.id, name: 'Injected item', quantity: 1, notes: '' }, 403);
  await app.command(player, 'character.stunt.add', { characterId: character.id, name: 'Unauthorized', description: 'No', kind: 'oncePerSession' }, 403);
  await app.command(app.gm, 'character.stunt.add', { characterId: character.id, name: 'Read the pressure', description: 'Once per session, ask a storm a question.', kind: 'oncePerSession' });
  state = (await app.view(player)).campaign.state;
  const stunt = state.characters[0].stunts.find(stunt => stunt.name === 'Read the pressure');
  await app.command(player, 'character.stunt.use', { characterId: character.id, stuntId: stunt.id });
  await app.command(player, 'character.stunt.use', { characterId: character.id, stuntId: stunt.id }, 400);
  const rolled = await app.command(player, 'dice.roll', { count: 4, sides: 'F', modifier: 2, label: 'Weather reading' });
  assert.equal((await app.post(`/api/campaigns/${app.id}/commands`, rolled.request, player.cookie)).status, 200);
  const afterReplay = await app.view(player);
  assert.equal(afterReplay.campaign.revision, rolled.body.revision);
  assert.equal(afterReplay.campaign.state.characters[0].inventory[0].quantity, 2);
  assert.equal(afterReplay.campaign.state.characters[0].appearance, 'Silver gloves and an ink-stained coat');
  assert.ok(afterReplay.campaign.state.journal.some(entry => entry.text.includes('Weather reading')));
  await app.command(player, 'dice.roll', { count: 1000000, sides: 6, modifier: 0, label: 'Invalid' }, 400);
});

test('pending actions block scene transitions; conflict control remains GM-authorized', async () => {
  const app = await setup(), player = await app.join();
  await app.command(player, 'character.create', authoredCharacter);
  const characterId = (await app.view(player)).campaign.state.characters[0].id;
  await app.command(app.gm, 'scene.create', { title: 'Next authored location' });
  const nextSceneId = (await app.view()).campaign.state.scenes.find(scene => scene.title === 'Next authored location').id;
  await app.command(player, 'action.propose', { characterId, action: 'overcome', approach: 'careful', intent: 'Measure the pressure front' });
  let state = (await app.view()).campaign.state;
  const requestId = state.requests[0].id;
  await app.command(app.gm, 'scene.activate', { sceneId: nextSceneId }, 409);
  await app.command(app.gm, 'action.roll', { requestId, opposition: 3, stuntBonus: 0 });
  await app.command(app.gm, 'scene.activate', { sceneId: nextSceneId }, 409);
  await app.command(app.gm, 'action.finalize', { requestId, resolutionNote: 'The instruments consume a rare crystal if a cost is agreed.', aspectName: 'The weather gives an answer' });
  await app.command(app.gm, 'scene.conflict', { active: true });
  await app.command(player, 'conflict.order', { characterIds: [characterId] }, 403);
  await app.command(app.gm, 'conflict.order', { characterIds: [characterId] });
  await app.command(player, 'conflict.next', {}, 403);
  await app.command(app.gm, 'conflict.next', {});
  state = (await app.view()).campaign.state;
  assert.deepEqual(state.conflict.order, [characterId]);
  assert.ok(state.conflict.round >= 1);
  await app.command(app.gm, 'scene.conflict', { active: false });
  await app.command(app.gm, 'scene.activate', { sceneId: nextSceneId });
  assert.equal((await app.view()).campaign.state.activeSceneId, nextSceneId);
});

test('a boost cannot accumulate invalid extra grants that break later invocation or backup import', async () => {
  const app = await setup(), player = await app.join();
  await app.command(player, 'character.create', authoredCharacter);
  const characterId = (await app.view()).campaign.state.characters[0].id;
  await app.command(app.gm, 'aspect.add', { name: 'Brief opening', kind: 'boost' });
  const aspectId = (await app.view()).campaign.state.aspects.find(aspect => aspect.name === 'Brief opening').id;
  await app.command(app.gm, 'aspect.grant', { aspectId, characterId });
  await app.command(app.gm, 'aspect.grant', { aspectId, characterId }, 400);
  assert.equal((await app.view()).campaign.state.aspects.find(aspect => aspect.id === aspectId).freeInvokes.length, 1);
  const backup = await app.call(`/api/campaigns/${app.id}/export`, { cookie: app.gm.cookie });
  const imported = await app.post('/api/import', { name: 'Restored GM', backup: backup.body });
  assert.equal(imported.status, 201, JSON.stringify(imported.body));
});

test('GM backup restoration preserves authored content while separating old memberships and resume capabilities', async () => {
  const app = await setup(), player = await app.join();
  await app.command(player, 'character.create', authoredCharacter);
  const characterId = (await app.view()).campaign.state.characters[0].id;
  await app.command(player, 'character.item.add', { characterId, name: 'Handwritten atlas', quantity: 1, notes: 'Our campaign notes are inside' });
  await app.command(app.gm, 'character.stunt.add', { characterId, name: 'Calm the storm', description: 'Gain an agreed +2 when negotiating weather.', kind: 'bonus', approach: 'careful', action: 'overcome', condition: 'When negotiating directly with weather' });
  await app.command(app.gm, 'handout.save', { title: 'Private worldbuilding', body: 'Our unpublished cosmology', visible: false });
  await app.command(app.gm, 'journal.add', { text: 'GM private campaign note', private: true });
  const activeSceneId = (await app.view()).campaign.state.activeSceneId;
  await app.command(app.gm, 'scene.update', { sceneId: activeSceneId, title: 'Home Observatory', description: 'Created by our table', objective: '', gmNotes: 'Preserve these GM notes', mapUrl: 'https://example.com/our-map.png' });
  await app.command(app.gm, 'scene.create', { title: 'Future authored destination' });
  const before = (await app.view()).campaign.state;
  const backup = await app.call(`/api/campaigns/${app.id}/export`, { cookie: app.gm.cookie });
  assert.equal(backup.status, 200);
  assert.equal(JSON.stringify(backup.body).includes(player.body.resumeSecret), false);
  assert.equal(JSON.stringify(backup.body).includes(app.gm.body.resumeSecret), false);
  const imported = await app.post('/api/import', { name: 'New GM', backup: backup.body });
  assert.equal(imported.status, 201, JSON.stringify(imported.body));
  const importedId = imported.body.campaign.id, restored = imported.body.campaign.state;
  assert.notEqual(importedId, app.id);
  assert.equal(imported.body.members.length, 1);
  assert.deepEqual(restored.scenes, before.scenes);
  assert.deepEqual(restored.handouts, before.handouts);
  assert.deepEqual(restored.journal, before.journal);
  assert.deepEqual(restored.characters[0].inventory, before.characters[0].inventory);
  assert.deepEqual(restored.characters[0].stunts, before.characters[0].stunts);
  assert.equal(restored.characters[0].ownerId, null);
  assert.equal((await app.call(`/api/campaigns/${importedId}`, { cookie: player.cookie })).status, 401);
  assert.equal((await app.post(`/api/campaigns/${importedId}/resume`, { secret: player.body.resumeSecret })).status, 403);
  const rejoined = await app.join('Restored player', imported);
  const claimed = await app.post(`/api/campaigns/${importedId}/commands`, { operationId: 'claim-after-toolkit-import', expectedRevision: 0, type: 'character.claim', payload: { characterId } }, rejoined.cookie);
  assert.equal(claimed.status, 200, JSON.stringify(claimed.body));
  const playerExport = await app.call(`/api/campaigns/${importedId}/export`, { cookie: rejoined.cookie });
  assert.doesNotMatch(JSON.stringify(playerExport.body), /unpublished cosmology|Preserve these GM notes|GM private campaign note|Future authored destination/);
});

test('schema1 saved-session upgrade preserves scene, ownership, spent resources and unresolved roll progress', async () => {
  const app = await setup(), player = await app.join();
  const saved = structuredClone(legacy);
  saved.characters[0].ownerId = player.body.member.id;
  app.db.sqlite.prepare('UPDATE campaigns SET state = ?, revision = ? WHERE id = ?').run(JSON.stringify({ title: saved.title, state: saved }), 17, app.id);
  const before = await app.view(), projected = await app.view(player);
  assert.equal(before.campaign.state.schemaVersion, 2);
  assert.equal(before.campaign.state.scene.id, saved.scene.id);
  assert.equal(before.campaign.state.characters[0].ownerId, player.body.member.id);
  assert.equal(before.campaign.state.characters[0].fatePoints, 2);
  assert.equal(before.campaign.state.characters[0].stress[1], true);
  assert.deepEqual(before.campaign.state.characters[0].consequences, saved.characters[0].consequences);
  assert.deepEqual(before.campaign.state.requests[0].roll, saved.requests[0].roll);
  assert.equal(before.campaign.revision, 17);
  assert.doesNotMatch(JSON.stringify(projected.campaign.state), /Legacy private note must survive/);
  await app.command(player, 'journal.add', { text: 'Saved after upgrading the existing campaign.' });
  const persisted = JSON.parse(app.db.sqlite.prepare('SELECT state FROM campaigns WHERE id = ?').get(app.id).state).state;
  assert.equal(persisted.schemaVersion, 2);
  assert.equal(persisted.characters[0].ownerId, player.body.member.id);
  assert.deepEqual(persisted.requests[0].roll, saved.requests[0].roll);
  assert.equal(persisted.characters[0].fatePoints, 2);
  assert.equal(persisted.characters[0].stress[1], true);
  assert.deepEqual(persisted.characters[0].consequences, saved.characters[0].consequences);
  const legacyImport = await app.post('/api/import', { name: 'Legacy restore GM', backup: { format: 'campaign-backup-v1', access: 'gm', campaign: { title: saved.title, state: saved, revision: 17 } } });
  assert.equal(legacyImport.status, 201, JSON.stringify(legacyImport.body));
  assert.equal(legacyImport.body.campaign.state.schemaVersion, 2);
  assert.equal(legacyImport.body.campaign.state.characters[0].ownerId, null);
  assert.deepEqual(legacyImport.body.campaign.state.characters[0].consequences, saved.characters[0].consequences);
  assert.deepEqual(legacyImport.body.campaign.state.requests[0].roll, saved.requests[0].roll);
});

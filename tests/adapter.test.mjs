import test from 'node:test';
import assert from 'node:assert/strict';
import { fateAdapter as adapter } from '../lib/fate/adapter.mjs';

const clone = value => JSON.parse(JSON.stringify(value));
const gm = { id: 'member-gm', name: 'Game Master', role: 'gm' };
const alice = { id: 'member-alice', name: 'Alice', role: 'player' };
const bob = { id: 'member-bob', name: 'Bob', role: 'player' };
const newcomer = { id: 'member-new', name: 'Newcomer', role: 'player' };
const command = (state, member, type, payload = {}) => adapter.command(state, member, type, payload).state;
const character = (state, characterId) => state.characters.find(item => item.id === characterId);
const denied = error => error.status === 403;

function table() {
  let state = adapter.initialState({ title: 'After Hours integration test' });
  state = command(state, gm, 'character.create', { name: 'Conductor', templateId: 'neon-host', npc: true });
  const npcId = state.characters.at(-1).id;
  state = command(state, alice, 'character.create', { name: 'Rae', templateId: 'night-courier' });
  const aliceId = state.characters.at(-1).id;
  state = command(state, bob, 'character.create', { name: 'Kit', templateId: 'late-detective' });
  const bobId = state.characters.at(-1).id;
  return { state, aliceId, bobId, npcId };
}

function propose(state, member, characterId, action = 'overcome', targetId = null) {
  const next = command(state, member, 'action.propose', {
    characterId, action, approach: 'quick', intent: 'Carry the last ticket across the platform.',
    ...(targetId ? { targetId } : {}),
  });
  return { state: next, requestId: next.requests.find(item => item.characterId === characterId).id };
}

function rolled(state, member, characterId, action = 'overcome', targetId = null, opposition = 2) {
  const proposed = propose(state, member, characterId, action, targetId);
  return { state: command(proposed.state, gm, 'action.roll', { requestId: proposed.requestId, opposition }), requestId: proposed.requestId };
}

// The night courier's Quick +3 versus -2 guarantees a positive hit even on -4.
// We intentionally use actual cryptographic rolls rather than patching global RNG.
function pendingHit(state, aliceId, bobId) {
  const attack = rolled(state, alice, aliceId, 'attack', bobId, -2);
  const shifts = attack.state.requests.find(item => item.id === attack.requestId).outcome.damageShifts;
  assert.ok(shifts >= 1 && shifts <= 9);
  const next = command(attack.state, gm, 'action.finalize', { requestId: attack.requestId });
  assert.equal(character(next, bobId).pendingDamage, shifts);
  return { state: next, shifts };
}

test('GM and players create valid owned characters; player creation cannot impersonate an NPC', () => {
  const { state, aliceId, npcId } = table();
  assert.equal(character(state, aliceId).ownerId, alice.id);
  assert.equal(character(state, aliceId).npc, false);
  assert.equal(character(state, npcId).npc, true);
  assert.throws(() => command(state, alice, 'character.create', { name: 'Another Rae' }), /already have a character/);
  const another = command(state, gm, 'character.create', { name: 'Second NPC', npc: true });
  assert.equal(another.characters.length, 4);
  const first = command(adapter.initialState({ title: 'Player NPC attempt' }), newcomer, 'character.create', { name: 'Player hero', npc: true });
  assert.equal(first.characters[0].npc, false);
});

test('players cannot act through someone else or use GM scene/session commands', () => {
  const { state, aliceId, bobId, npcId } = table();
  const before = clone(state);
  for (const foreignId of [bobId, npcId]) {
    assert.throws(() => command(state, alice, 'move', { characterId: foreignId, zoneId: 'platform' }), denied);
    assert.throws(() => propose(state, alice, foreignId), denied);
    assert.throws(() => command(state, alice, 'character.edit', { characterId: foreignId, highConcept: 'Changed', trouble: 'Changed' }), denied);
  }
  assert.throws(() => command(state, alice, 'scene.advance'), denied);
  assert.throws(() => command(state, alice, 'session.start'), denied);
  assert.throws(() => command(state, alice, 'scene.conflict', { active: true }), denied);
  const moved = command(state, alice, 'move', { characterId: aliceId, zoneId: 'platform' });
  assert.equal(character(moved, aliceId).zone, 'platform');
  assert.deepEqual(state, before, 'Successful and rejected commands must not mutate their input state.');
});

test('conflict movement requires GM adjudication while adjacent exploration movement works', () => {
  const { state, aliceId } = table();
  assert.throws(() => command(state, alice, 'move', { characterId: aliceId, zoneId: 'carriage' }), /adjacent zone/);
  const conflict = command(state, gm, 'scene.conflict', { active: true });
  assert.throws(() => command(conflict, alice, 'move', { characterId: aliceId, zoneId: 'platform' }), denied);
  const ruled = command(conflict, gm, 'move', { characterId: aliceId, zoneId: 'platform' });
  assert.equal(character(ruled, aliceId).zone, 'platform');
});

test('propose → GM roll → player invoke → GM finalize uses actual dice and preserves costs', () => {
  const { state, aliceId } = table();
  const proposed = propose(state, alice, aliceId);
  assert.equal(proposed.state.requests[0].status, 'proposed');
  assert.throws(() => command(proposed.state, alice, 'action.roll', { requestId: proposed.requestId, opposition: 2 }), denied);
  let current = command(proposed.state, gm, 'action.roll', { requestId: proposed.requestId, opposition: 2 });
  const firstRoll = clone(current.requests[0].roll);
  assert.equal(firstRoll.dice.length, 4);
  assert.ok(firstRoll.dice.every(die => [-1, 0, 1].includes(die)));
  assert.equal(firstRoll.total, firstRoll.dice.reduce((sum, die) => sum + die, 0) + 3);
  assert.throws(() => command(current, bob, 'action.invoke', {
    requestId: proposed.requestId, aspectId: character(current, aliceId).aspects[0].id,
    mode: 'paid', justification: 'Trying to spend someone else’s points.',
  }), denied);
  const aspectId = character(current, aliceId).aspects[0].id;
  current = command(current, alice, 'action.invoke', { requestId: proposed.requestId, aspectId,
    mode: 'paid', justification: 'The courier knows the platform shortcuts.' });
  assert.equal(current.requests[0].roll.total, firstRoll.total + 2);
  assert.equal(character(current, aliceId).fatePoints, 2);
  assert.throws(() => command(current, alice, 'action.invoke', { requestId: proposed.requestId, aspectId,
    mode: 'paid', justification: 'Trying the same paid invocation twice.' }), /only once per roll/);
  assert.throws(() => command(current, alice, 'action.finalize', { requestId: proposed.requestId }), denied);
  const done = command(current, gm, 'action.finalize', { requestId: proposed.requestId,
    resolutionNote: 'The table agrees to surrender the spare ticket if a cost is required.' });
  assert.equal(done.requests.length, 0); assert.equal(character(done, aliceId).fatePoints, 2);
  assert.throws(() => command(done, gm, 'action.finalize', { requestId: proposed.requestId }), /no longer at that stage/);
});

test('pending damage blocks actions, movement, and scene/session transitions until explicitly absorbed', () => {
  const setup = table();
  const hit = pendingHit(setup.state, setup.aliceId, setup.bobId);
  const before = clone(hit.state);
  assert.throws(() => propose(hit.state, bob, setup.bobId), /Resolve your condition/);
  assert.throws(() => command(hit.state, bob, 'move', { characterId: setup.bobId, zoneId: 'platform' }), /Resolve your condition/);
  assert.throws(() => command(hit.state, gm, 'scene.advance'), /Resolve pending decisions/);
  assert.throws(() => command(hit.state, gm, 'session.start'), /Finish pending decisions/);
  assert.throws(() => command(hit.state, bob, 'damage.absorb', { characterId: setup.bobId,
    stressBox: [1, 2], consequences: [] }), /at most one stress box/);
  assert.throws(() => command(hit.state, bob, 'damage.absorb', { characterId: setup.bobId,
    stressBox: null, consequences: [] }), /does not absorb the hit/);
  assert.deepEqual(hit.state, before);
  const absorbed = command(hit.state, bob, 'damage.absorb', { characterId: setup.bobId,
    stressBox: 3, consequences: [{ severity: 'mild', name: 'Twisted ankle' }, { severity: 'moderate', name: 'Shaken confidence' }] });
  assert.equal(character(absorbed, setup.bobId).pendingDamage, 0);
  assert.deepEqual(character(absorbed, setup.bobId).stress, [false, false, true]);
  assert.equal(character(absorbed, setup.bobId).consequences.mild.freeInvokes[0].authorizedActorIds[0], setup.aliceId);
  assert.throws(() => command(absorbed, bob, 'damage.absorb', { characterId: setup.bobId,
    stressBox: 1, consequences: [] }), /no pending hit/);
});

test('session start preserves stress/consequences; scene advance clears stress and preserves consequences', () => {
  const setup = table();
  const hit = pendingHit(setup.state, setup.aliceId, setup.bobId);
  let current = command(hit.state, bob, 'damage.absorb', { characterId: setup.bobId,
    stressBox: 3, consequences: [{ severity: 'mild', name: 'Twisted ankle' }, { severity: 'moderate', name: 'Shaken confidence' }] });
  const savedConsequences = clone(character(current, setup.bobId).consequences);
  current = command(current, gm, 'session.start');
  assert.equal(current.session, 2);
  assert.deepEqual(character(current, setup.bobId).stress, [false, false, true]);
  assert.deepEqual(character(current, setup.bobId).consequences, savedConsequences);
  current = command(current, gm, 'scene.advance');
  assert.equal(current.sceneIndex, 1);
  assert.deepEqual(character(current, setup.bobId).stress, [false, false, false]);
  assert.deepEqual(character(current, setup.bobId).consequences, savedConsequences);
  assert.equal(character(current, setup.bobId).zone, current.scene.zones[0].id);
});

test('projection and backup restoration do not silently refresh spent Fate points', () => {
  const setup = table();
  const pending = rolled(setup.state, alice, setup.aliceId);
  let current = pending.state;
  for (const aspect of character(current, setup.aliceId).aspects) {
    current = command(current, alice, 'action.invoke', { requestId: pending.requestId, aspectId: aspect.id,
      mode: 'paid', justification: 'This distinct aspect contributes to the action.' });
  }
  assert.equal(character(current, setup.aliceId).fatePoints, 0);
  current = command(current, gm, 'action.finalize', { requestId: pending.requestId,
    resolutionNote: 'The table agrees to surrender the spare ticket if a cost is required.' });
  assert.equal(character(adapter.project(current, alice), setup.aliceId).fatePoints, 0);
  const restored = adapter.validateImport(clone(current));
  assert.equal(character(restored, setup.aliceId).fatePoints, 0);
  assert.deepEqual(character(restored, setup.aliceId).lastSession, { id: 'session-1', index: 1 });
  const claimed = command(restored, newcomer, 'character.claim', { characterId: setup.aliceId });
  assert.equal(character(claimed, setup.aliceId).fatePoints, 0);
  const nextSession = command(claimed, gm, 'session.start');
  assert.equal(character(nextSession, setup.aliceId).fatePoints, 3);
});

test('GM private notes and pack secrets are absent from player projection; projections are detached', () => {
  const setup = table();
  let current = command(setup.state, gm, 'journal.add', { text: 'GM private clue: brass suitcase password.', private: true });
  current = command(current, alice, 'journal.add', { text: 'We reached the platform.' });
  assert.throws(() => command(current, alice, 'journal.add', { text: 'Unauthorized secret.', private: true }), denied);
  const publicState = adapter.project(current, alice), gmState = adapter.project(current, gm);
  assert.equal(Object.hasOwn(publicState.scene, 'gmNotes'), false);
  assert.equal(publicState.journal.some(item => item.private), false);
  assert.ok(gmState.scene.gmNotes.length > 0);
  assert.equal(gmState.journal.some(item => item.text.includes('brass suitcase password')), true);
  publicState.title = 'Client-side change';
  publicState.characters[0].name = 'Client-side change';
  assert.notEqual(current.title, 'Client-side change');
  assert.notEqual(current.characters[0].name, 'Client-side change');
});

test('backup import clears player ownership; each player can claim one PC and never claim an NPC', () => {
  const setup = table();
  const backup = clone(setup.state);
  backup.scene.gmNotes = 'Tampered imported secret';
  let current = adapter.validateImport(backup);
  assert.equal(character(current, setup.aliceId).ownerId, null);
  assert.equal(character(current, setup.bobId).ownerId, null);
  assert.notEqual(current.scene.gmNotes, 'Tampered imported secret');
  assert.throws(() => command(current, newcomer, 'character.claim', { characterId: setup.npcId }), /already claimed/);
  current = command(current, newcomer, 'character.claim', { characterId: setup.aliceId });
  assert.equal(character(current, setup.aliceId).ownerId, newcomer.id);
  assert.throws(() => command(current, bob, 'character.claim', { characterId: setup.aliceId }), /already claimed/);
  assert.throws(() => command(current, newcomer, 'character.claim', { characterId: setup.bobId }), /already have a character/);
  assert.equal(propose(current, newcomer, setup.aliceId).state.requests.length, 1);
});

test('pending roll backup preserves dice, invocation ledger, outcome and resource costs, then remains playable', () => {
  const setup = table();
  const pending = rolled(setup.state, alice, setup.aliceId);
  let current = command(pending.state, alice, 'action.invoke', { requestId: pending.requestId,
    aspectId: character(pending.state, setup.aliceId).aspects[0].id, mode: 'paid', justification: 'Courier training applies.' });
  const savedRoll = clone(current.requests[0].roll), savedOutcome = clone(current.requests[0].outcome);
  current = adapter.validateImport(clone(current));
  assert.deepEqual(current.requests[0].roll, savedRoll);
  assert.deepEqual(current.requests[0].outcome, savedOutcome);
  assert.equal(current.requests[0].status, 'rolled');
  assert.equal(character(current, setup.aliceId).fatePoints, 2);
  current = command(current, newcomer, 'character.claim', { characterId: setup.aliceId });
  assert.throws(() => command(current, newcomer, 'action.invoke', { requestId: pending.requestId,
    aspectId: character(current, setup.aliceId).aspects[0].id, mode: 'paid', justification: 'Replaying spent aspect.' }), /only once per roll/);
  current = command(current, newcomer, 'action.invoke', { requestId: pending.requestId,
    aspectId: character(current, setup.aliceId).aspects[1].id, mode: 'paid', justification: 'A different aspect applies.' });
  assert.equal(character(current, setup.aliceId).fatePoints, 1);
  current = command(current, gm, 'action.finalize', { requestId: pending.requestId,
    resolutionNote: 'The table agrees to surrender the spare ticket if a cost is required.' });
  assert.equal(current.requests.length, 0);
});

test('import rejects malformed ruleset, invalid characters/dice, duplicate characters and nonexistent targets', () => {
  const setup = table(), pending = rolled(setup.state, alice, setup.aliceId);
  const mutateCases = [
    raw => { raw.ruleset = 'wrong-system'; },
    raw => { raw.characters[0].fatePoints = -1; },
    raw => { raw.characters.push(clone(raw.characters[0])); },
    raw => { raw.characters[0].zone = 'missing-zone'; },
    raw => { raw.requests[0].roll.dice = [1, 1, 1]; },
    raw => { raw.requests[0].roll.dice = [1, 0, -1, 5]; },
    raw => { raw.requests[0].targetId = 'missing-character'; },
  ];
  for (const mutate of mutateCases) {
    const raw = clone(pending.state); mutate(raw);
    assert.throws(() => adapter.validateImport(raw));
  }
});

test('REGRESSION: import rejects malformed or duplicated invocation ledger entries', () => {
  const setup = table(), pending = rolled(setup.state, alice, setup.aliceId);
  const mutateCases = [
    raw => { raw.requests[0].roll.usedFreeInvokes = [{}]; },
    raw => { raw.requests[0].roll.usedFreeInvokes = [null]; },
    raw => { raw.requests[0].roll.paidAspectIds = ['']; },
    raw => { raw.requests[0].roll.paidAspectIds = ['   ']; },
    raw => { raw.requests[0].roll.usedFreeInvokes = [{ aspectId: '   ', invokeId: 'f' }]; },
    raw => { raw.requests[0].roll.paidAspectIds = ['same-aspect', 'same-aspect']; },
    raw => { raw.requests[0].roll.usedFreeInvokes = [{ aspectId: 'a', invokeId: 'f' }, { aspectId: 'a', invokeId: 'f' }]; },
  ];
  for (const mutate of mutateCases) {
    const raw = clone(pending.state); mutate(raw);
    assert.throws(() => adapter.validateImport(raw), 'Malformed invocation ledgers must be rejected at import, before they block future invokes.');
  }
});

test('REGRESSION: import rejects duplicate request ids and multiple pending actions for one character', () => {
  const setup = table(), pending = rolled(setup.state, alice, setup.aliceId);
  const duplicate = clone(pending.state);
  duplicate.requests.push(clone(duplicate.requests[0]));
  assert.throws(() => adapter.validateImport(duplicate), 'Request ids must be unique.');
  const secondPending = clone(pending.state);
  secondPending.requests.push({ ...clone(secondPending.requests[0]), id: 'different-request-id' });
  assert.throws(() => adapter.validateImport(secondPending), 'One character cannot import multiple simultaneous pending actions.');
});

test('REGRESSION: a pending hit blocks finalizing the target’s previously rolled action', () => {
  const setup = table();
  const defenderAction = rolled(setup.state, bob, setup.bobId);
  const hit = pendingHit(defenderAction.state, setup.aliceId, setup.bobId);
  assert.throws(() => command(hit.state, gm, 'action.finalize', { requestId: defenderAction.requestId }),
    'A character must resolve a pending hit before finalizing its existing action.');
});

test('REGRESSION: a taken-out target cannot finalize its previously rolled action', () => {
  const setup = table();
  const defenderAction = rolled(setup.state, bob, setup.bobId);
  const hit = pendingHit(defenderAction.state, setup.aliceId, setup.bobId);
  const takenOut = command(hit.state, bob, 'damage.takenOut', { characterId: setup.bobId });
  assert.equal(character(takenOut, setup.bobId).takenOut, true);
  assert.throws(() => command(takenOut, gm, 'action.finalize', { requestId: defenderAction.requestId }),
    'A taken-out actor cannot complete an action in the same scene.');
});

test('REGRESSION: taking out a character with an unresolved proposal cannot permanently block scene advance', () => {
  const setup = table();
  const defenderProposal = propose(setup.state, bob, setup.bobId);
  const hit = pendingHit(defenderProposal.state, setup.aliceId, setup.bobId);
  const takenOut = command(hit.state, bob, 'damage.takenOut', { characterId: setup.bobId });
  assert.equal(takenOut.requests.some(request => request.characterId === setup.bobId), false,
    'Taking out the actor should cancel its now-unresolvable pending proposal (or supply an equivalent explicit cancellation path).');
  assert.equal(command(takenOut, gm, 'scene.advance').sceneIndex, 1);
});

test('GM must record an agreed cost before finalizing an overcome tie', () => {
  const setup = table(), pending = rolled(setup.state, alice, setup.aliceId);
  const backup = clone(pending.state);
  // Restore a valid all-blank 4dF result to exercise the tie deterministically.
  // This tests backup semantics as well as the cost barrier; live RNG is untouched.
  backup.requests[0].roll.dice = [0, 0, 0, 0];
  backup.requests[0].roll.baseOpposition = 3;
  const tied = adapter.validateImport(backup);
  assert.equal(tied.requests[0].outcome.cost, 'minor');
  const before = clone(tied);
  assert.throws(() => command(tied, gm, 'action.finalize', { requestId: pending.requestId }));
  assert.deepEqual(tied, before);
  const done = command(tied, gm, 'action.finalize', { requestId: pending.requestId,
    resolutionNote: 'The table agrees that the spare ticket is lost in the crossing.' });
  assert.equal(done.requests.length, 0);
  assert.match(done.journal.at(-1).text, /spare ticket is lost/);
});

test('owners can cancel proposals, but only the GM can cancel rolled actions without refunding invokes', () => {
  const setup = table(), proposal = propose(setup.state, alice, setup.aliceId);
  assert.throws(() => command(proposal.state, bob, 'action.cancel', { requestId: proposal.requestId }), denied);
  assert.equal(command(proposal.state, alice, 'action.cancel', { requestId: proposal.requestId }).requests.length, 0);
  const pending = rolled(setup.state, alice, setup.aliceId);
  const invoked = command(pending.state, alice, 'action.invoke', { requestId: pending.requestId,
    aspectId: character(pending.state, setup.aliceId).aspects[0].id,
    mode: 'paid', justification: 'Courier experience applies.' });
  assert.throws(() => command(invoked, alice, 'action.cancel', { requestId: pending.requestId }), denied);
  const cancelled = command(invoked, gm, 'action.cancel', { requestId: pending.requestId });
  assert.equal(cancelled.requests.length, 0);
  assert.equal(character(cancelled, setup.aliceId).fatePoints, 2);
});

test('import strips unknown nested fields from public character/aspect/session data', () => {
  const setup = table(), backup = clone(setup.state);
  const marker = 'UNEXPECTED_PRIVATE_FIELD_MARKER';
  backup.characters[1].unexpected = { gmNotes: marker };
  backup.characters[1].aspects[0].privateNotes = marker;
  backup.characters[1].lastSession.privateNotes = marker;
  backup.aspects[0].privateNotes = marker;
  backup.aspects[0].freeInvokes = [{ id: 'valid-grant', authorizedActorIds: [setup.aliceId], privateNotes: marker }];
  const restored = adapter.validateImport(backup);
  assert.equal(JSON.stringify(adapter.project(restored, alice)).includes(marker), false);
  assert.equal(restored.aspects[0].freeInvokes[0].id, 'valid-grant');
});

test('import rejects future or misnamed character sessions and colliding aspect identities', () => {
  const setup = table();
  const mutateCases = [
    raw => { raw.characters[1].lastSession = { id: 'session-2', index: 2 }; },
    raw => { raw.characters[1].lastSession = { id: 'session-wrong', index: 1 }; },
    raw => { raw.aspects[0].id = raw.characters[1].aspects[0].id; },
    raw => { raw.aspects[0].freeInvokes = [{ id: 'ghost-grant', authorizedActorIds: ['missing-character'] }]; },
  ];
  for (const mutate of mutateCases) {
    const backup = clone(setup.state); mutate(backup);
    assert.throws(() => adapter.validateImport(backup));
  }
});

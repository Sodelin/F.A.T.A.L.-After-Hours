import test from 'node:test';
import assert from 'node:assert/strict';
import { mechanicsAdapter as mechanics } from '../lib/fate/mechanics.mjs';
import { createCustomCharacter, createAspect, beginSession } from '../lib/fate/domain.mjs';

const gm = { id: 'gm-member', name: 'GM', role: 'gm' };
const player = { id: 'player-member', name: 'Player', role: 'player' };
const command = (state, member, type, payload) => mechanics.command(state, member, type, payload).state;
const copy = value => JSON.parse(JSON.stringify(value));
function initial() {
  const state = mechanics.initialState({ title: 'User campaign test' });
  state.characters = ['actor', 'opponent'].map((id, index) => ({
    ...beginSession(createCustomCharacter({ id, name: `User character ${index + 1}`,
      highConcept: 'Authored high concept', trouble: 'Authored trouble', aspects: ['Authored aspect'],
      approaches: { careful: 3, clever: 2, flashy: 2, forceful: 1, quick: 1, sneaky: 0 } }),
    { sessionId: 'session-1', sessionIndex: 1 }),
    ownerId: index ? gm.id : player.id, npc: index === 1, zone: state.scene.zones[0].id, pendingDamage: 0,
  }));
  state.aspects = [createAspect({ id: 'scene-aspect', name: 'Authored scene aspect',
    freeInvokes: [{ id: 'existing-grant', authorizedActorIds: ['actor'] }] })];
  return state;
}
function proposal(state, action, options = {}) {
  return command(state, player, 'action.propose', { characterId: 'actor', action,
    approach: 'careful', intent: 'Player-authored intent', ...options });
}
function pending(action, margin, options = {}) {
  let state = proposal(initial(), action, options);
  const requestId = state.requests[0].id;
  state = command(state, gm, 'action.roll', { requestId, opposition: 3 });
  // A valid restored blank-dice roll provides exact boundaries without altering live RNG.
  const backup = copy(state);
  backup.requests[0].roll.dice = [0, 0, 0, 0];
  backup.requests[0].roll.baseOpposition = 3 - margin;
  state = mechanics.validateImport(backup);
  state = command(state, player, 'character.claim', { characterId: 'actor' });
  return { state, requestId };
}
const finalize = (state, requestId, options = {}) => command(state, gm, 'action.finalize', { requestId, ...options });

test('proposal requires valid advantage mode and canonical active scene situation target', () => {
  const state = initial();
  for (const options of [
    { advantageMode: 'bad' }, { advantageMode: 'existing' },
    { advantageMode: 'discover', targetAspectId: 'missing' },
    { advantageMode: 'existing', targetAspectId: state.characters[0].aspects[0].id },
    { advantageMode: 'create', targetAspectId: 'scene-aspect' },
  ]) assert.throws(() => proposal(state, 'createAdvantage', options));
  const boostState = copy(state); boostState.aspects.push(createAspect({ id: 'boost', name: 'Authored boost', kind: 'boost' }));
  assert.throws(() => proposal(boostState, 'createAdvantage', { advantageMode: 'existing', targetAspectId: 'boost' }));
  assert.throws(() => proposal(state, 'overcome', { advantageMode: 'existing', targetAspectId: 'scene-aspect' }));
  const legacy = proposal(state, 'createAdvantage');
  assert.equal(legacy.requests[0].advantageMode, 'create');
  assert.equal(legacy.requests[0].targetAspectId, null);
});

test('create tie yields exactly one boost; discover/existing tie appends to the target without duplication', () => {
  const created = pending('createAdvantage', 0);
  const withBoost = finalize(created.state, created.requestId, { aspectName: 'Authored boost name' });
  assert.equal(withBoost.aspects.length, 2);
  assert.equal(withBoost.aspects[1].kind, 'boost');
  assert.equal(withBoost.aspects[1].freeInvokes.length, 1);
  for (const advantageMode of ['discover', 'existing']) {
    const task = pending('createAdvantage', 0, { advantageMode, targetAspectId: 'scene-aspect' });
    assert.equal(task.state.requests[0].outcome.freeInvokes, 1);
    const done = finalize(task.state, task.requestId);
    assert.equal(done.aspects.length, 1);
    assert.equal(done.aspects[0].id, 'scene-aspect');
    assert.equal(done.aspects[0].name, 'Authored scene aspect');
    assert.equal(done.aspects[0].freeInvokes.length, 2);
    assert.equal(done.aspects[0].freeInvokes[0].id, 'existing-grant');
  }
});

test('existing/discover success and style append one/two authorized grants preserving previous grants', () => {
  for (const advantageMode of ['discover', 'existing']) {
    for (const [margin, count] of [[1, 1], [2, 1], [3, 2]]) {
      const task = pending('createAdvantage', margin, { advantageMode, targetAspectId: 'scene-aspect' });
      const done = finalize(task.state, task.requestId);
      assert.equal(done.aspects.length, 1);
      assert.equal(done.aspects[0].freeInvokes.length, 1 + count);
      assert.ok(done.aspects[0].freeInvokes.every(grant => grant.authorizedActorIds[0] === 'actor'));
      assert.equal(new Set(done.aspects[0].freeInvokes.map(grant => grant.id)).size, 1 + count);
    }
  }
});

test('ordinary advantage failure adds nothing; create/discover opponent option credits a distinct roster character', () => {
  for (const advantageMode of ['create', 'discover', 'existing']) {
    const options = { advantageMode, ...(advantageMode === 'create' ? {} : { targetAspectId: 'scene-aspect' }) };
    const task = pending('createAdvantage', -1, options);
    assert.deepEqual(finalize(task.state, task.requestId).aspects, task.state.aspects);
    if (advantageMode === 'existing') {
      assert.throws(() => finalize(task.state, task.requestId, { failureChoice: 'opponentInvoke', opponentCharacterId: 'opponent' }));
      continue;
    }
    for (const opponentCharacterId of [undefined, 'actor', 'missing']) {
      assert.throws(() => finalize(task.state, task.requestId, { failureChoice: 'opponentInvoke', opponentCharacterId }));
    }
    const done = finalize(task.state, task.requestId, { failureChoice: 'opponentInvoke', opponentCharacterId: 'opponent', aspectName: 'Authored disadvantage' });
    const aspect = advantageMode === 'create' ? done.aspects.at(-1) : done.aspects[0];
    assert.deepEqual(aspect.freeInvokes.at(-1).authorizedActorIds, ['opponent']);
    assert.equal(done.aspects.length, advantageMode === 'create' ? 2 : 1);
  }
});

test('overcome failure at serious cost requires explicit note and records success at cost, not failure alone', () => {
  const task = pending('overcome', -1);
  assert.equal(task.state.requests[0].outcome.cost, null);
  assert.throws(() => finalize(task.state, task.requestId, { failureChoice: 'succeedAtCost' }));
  const done = finalize(task.state, task.requestId, { failureChoice: 'succeedAtCost', resolutionNote: 'The player and GM agree the stated serious cost.' });
  assert.equal(done.requests.length, 0);
  assert.match(done.journal.at(-1).text, /success at cost/);
  assert.match(done.journal.at(-1).text, /serious cost/);
  assert.doesNotMatch(done.journal.at(-1).text, /— failure/);
  const tie = pending('overcome', 0);
  assert.throws(() => finalize(tie.state, tie.requestId));
  assert.throws(() => finalize(tie.state, tie.requestId, { failureChoice: 'succeedAtCost', resolutionNote: 'Cannot select serious cost on a tie.' }));
});

test('attack style trade deals one fewer shift and grants one boost; default retains full damage', () => {
  for (const tradeShiftForBoost of [false, true]) {
    const task = pending('attack', 3, { targetId: 'opponent' });
    assert.equal(task.state.requests[0].outcome.damageShifts, 3);
    const done = finalize(task.state, task.requestId, { tradeShiftForBoost, aspectName: 'Authored opening' });
    assert.equal(done.characters.find(c => c.id === 'opponent').pendingDamage, tradeShiftForBoost ? 2 : 3);
    assert.equal(done.aspects.length, tradeShiftForBoost ? 2 : 1);
    if (tradeShiftForBoost) assert.deepEqual(done.aspects[1].freeInvokes[0].authorizedActorIds, ['actor']);
  }
  for (const margin of [-1, 0, 1, 2]) {
    const task = pending('attack', margin, { targetId: 'opponent' });
    assert.throws(() => finalize(task.state, task.requestId, { tradeShiftForBoost: true }));
  }
  const wrongAction = pending('overcome', 3);
  assert.throws(() => finalize(wrongAction.state, wrongAction.requestId, { tradeShiftForBoost: true }));
});

test('post-invoke finalization recomputes margin and rejects stale failure choices', () => {
  const task = pending('overcome', -1);
  const invoked = command(task.state, player, 'action.invoke', { requestId: task.requestId,
    aspectId: task.state.characters.find(c => c.id === 'actor').aspects[0].id,
    mode: 'paid', justification: 'The authored aspect supports this action.' });
  assert.equal(invoked.requests[0].outcome.outcome, 'success');
  assert.throws(() => finalize(invoked, task.requestId, { failureChoice: 'succeedAtCost', resolutionNote: 'Stale failure choice.' }));
  assert.equal(finalize(invoked, task.requestId).requests.length, 0);
  const attack = pending('attack', 1, { targetId: 'opponent' });
  const styled = command(attack.state, player, 'action.invoke', { requestId: attack.requestId,
    aspectId: attack.state.characters.find(c => c.id === 'actor').aspects[0].id,
    mode: 'paid', justification: 'The authored aspect supports this action.' });
  const result = finalize(styled, attack.requestId, { tradeShiftForBoost: true });
  assert.equal(result.characters.find(c => c.id === 'opponent').pendingDamage, 2);
});

test('final choices reject unrelated fields, forged targets, and stale/deleted canonical aspects', () => {
  const attack = pending('attack', -1);
  assert.throws(() => finalize(attack.state, attack.requestId, { failureChoice: 'succeedAtCost', resolutionNote: 'Invalid action option.' }));
  assert.throws(() => finalize(attack.state, attack.requestId, { opponentCharacterId: 'opponent' }));
  assert.throws(() => finalize(attack.state, attack.requestId, { tradeShiftForBoost: 'false' }));
  const advantage = pending('createAdvantage', 1, { advantageMode: 'existing', targetAspectId: 'scene-aspect' });
  const removed = copy(advantage.state); removed.aspects = [];
  assert.throws(() => finalize(removed, advantage.requestId));
  assert.equal(advantage.state.aspects[0].freeInvokes.length, 1);
});

test('pending advantage modes/targets survive import and reject malformed or incompatible fields', () => {
  for (const advantageMode of ['create', 'discover', 'existing']) {
    const options = { advantageMode, ...(advantageMode === 'create' ? {} : { targetAspectId: 'scene-aspect' }) };
    const proposed = proposal(initial(), 'createAdvantage', options);
    const restoredProposal = mechanics.validateImport(proposed);
    assert.equal(restoredProposal.requests[0].advantageMode, advantageMode);
    assert.equal(restoredProposal.requests[0].targetAspectId, advantageMode === 'create' ? null : 'scene-aspect');
    const task = pending('createAdvantage', 3, options);
    const restored = mechanics.validateImport(task.state);
    assert.equal(restored.requests[0].advantageMode, advantageMode);
    assert.deepEqual(restored.requests[0].roll, task.state.requests[0].roll);
    assert.deepEqual(restored.requests[0].outcome, task.state.requests[0].outcome);
  }
  const task = pending('createAdvantage', 1, { advantageMode: 'existing', targetAspectId: 'scene-aspect' });
  for (const alter of [
    r => { r.advantageMode = 'unknown'; }, r => { r.targetAspectId = 'missing'; },
    r => { r.advantageMode = 'create'; }, r => { r.targetAspectId = 'actor:high-concept'; },
  ]) {
    const raw = copy(task.state); alter(raw.requests[0]); assert.throws(() => mechanics.validateImport(raw));
  }
  const unrelated = pending('overcome', 1), raw = copy(unrelated.state);
  raw.requests[0].advantageMode = 'existing'; raw.requests[0].targetAspectId = 'scene-aspect';
  assert.throws(() => mechanics.validateImport(raw));
});

test('an existing aspect at its token limit rejects appended grants without partial state mutation', () => {
  const task = pending('createAdvantage', 3, { advantageMode: 'existing', targetAspectId: 'scene-aspect' });
  task.state.aspects[0].freeInvokes = Array.from({ length: 99 }, (_, i) => ({ id: `grant-${i}`, authorizedActorIds: ['actor'] }));
  const before = copy(task.state);
  assert.throws(() => finalize(task.state, task.requestId), /limit/);
  assert.deepEqual(task.state, before);
});

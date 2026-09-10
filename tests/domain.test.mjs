import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, APPROACHES, CHARACTER_TEMPLATES, FateRuleError, createCharacter,
  validateCharacter, createAspect, grantFreeInvoke, roll4dF, resolveAction, createRoll,
  invokeAspect, absorbDamage, endScene, beginSession, useSessionStunt,
  resolveCompel, applyMilestone, recoverConsequence,
} from '../lib/fate/domain.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const pc = options => createCharacter({ id: 'hero', ...options });
const context = { sceneId: 'alley', sessionId: 'session-1', sessionIndex: 1, scenarioId: 'midnight' };
const later = { ...context, sceneId: 'hospital', sessionId: 'session-2', sessionIndex: 2 };
const rng = (...values) => { let i = 0; return () => values[i++ % values.length]; };
const code = expected => error => error instanceof FateRuleError && error.code === expected;
const bonusStunt = id => ({ id, name: `Stunt ${id}`, description: 'A practiced technique.', kind: 'bonus', approach: 'quick', action: 'overcome', bonus: 2, condition: 'While delivering a parcel.' });
const sessionStunt = { id: 'contact', name: 'Old contact', description: 'Find a familiar face once per session.', kind: 'oncePerSession', usedSessionId: null };
const action = (name, margin, extra = {}) => resolveAction({ action: name, total: 2 + margin, opposition: 2, ...extra });
const roll = character => createRoll({ id: 'roll-1', character, action: 'overcome', approach: 'quick', opposition: 3 }, () => 0.5);
const invoke = (character, currentRoll, aspect, extra = {}) => invokeAspect({ character, roll: currentRoll, aspect,
  mode: 'paid', justification: 'My training applies to this delivery.', ...extra });

test('every original template creates independent, valid JSON characters', () => {
  for (const template of CHARACTER_TEMPLATES) {
    const one = pc({ templateId: template.id });
    const two = pc({ id: 'ally', templateId: template.id });
    assert.deepEqual(validateCharacter(one, { requireStartingRatings: true }), { valid: true, errors: [] });
    assert.deepEqual(one, JSON.parse(JSON.stringify(one)));
    assert.deepEqual(Object.values(one.approaches).sort(), [0, 1, 1, 2, 2, 3]);
    one.aspects[0].name = 'Changed';
    assert.notEqual(two.aspects[0].name, 'Changed');
    assert.notEqual(template.highConcept, 'Changed');
  }
});

test('creation rejects illegal distribution, missing identity, and excessive stunt cost', () => {
  assert.throws(() => pc({ id: '' }), code('INVALID_CHARACTER'));
  assert.throws(() => pc({ approaches: Object.fromEntries(APPROACHES.map(key => [key, 3])) }), code('INVALID_CHARACTER'));
  assert.throws(() => pc({ stunts: null }), code('INVALID_STUNTS'));
  assert.throws(() => pc({ stunts: Array.from({ length: 6 }, (_, i) => bonusStunt(`s${i}`)) }), code('INVALID_CHARACTER'));
  const five = pc({ stunts: Array.from({ length: 5 }, (_, i) => bonusStunt(`s${i}`)) });
  assert.equal(five.refresh, 1);
  assert.equal(five.fatePoints, 1);
});

test('validation reports malformed persisted state without crashing', () => {
  for (const broken of [null, [], {}, { ...pc(), aspects: [null, null, null] }, { ...pc(), consequences: { mild: {}, moderate: null, severe: null } }]) {
    assert.equal(validateCharacter(broken).valid, false);
  }
  const broken = pc(); broken.fatePoints = -1; broken.refresh = 99;
  assert.ok(validateCharacter(broken).errors.includes('INVALID_FATE_POINTS'));
  assert.ok(validateCharacter(broken).errors.includes('INVALID_REFRESH'));
});

test('4dF exhaustively reproduces the exact 81 equally likely outcomes', () => {
  const counts = new Map();
  for (let n = 0; n < 81; n += 1) {
    let encoded = n;
    const draws = [];
    for (let die = 0; die < 4; die += 1) { draws.push(((encoded % 3) + 0.5) / 3); encoded = Math.floor(encoded / 3); }
    const result = roll4dF(rng(...draws));
    assert.equal(result.dice.length, 4);
    counts.set(result.sum, (counts.get(result.sum) ?? 0) + 1);
  }
  assert.deepEqual(Array.from({ length: 9 }, (_, i) => counts.get(i - 4)), [1, 4, 10, 16, 19, 16, 10, 4, 1]);
});

test('RNG boundaries map correctly and invalid draws are rejected', () => {
  assert.deepEqual(roll4dF(rng(0, 1 / 3, 2 / 3, 0.999999)), { dice: [-1, 0, 1, 1], sum: 1 });
  for (const draw of [-0.001, 1, NaN, Infinity, undefined, '0.5']) {
    assert.throws(() => roll4dF(() => draw), code('INVALID_RNG_DRAW'));
  }
});

test('all actions share the exact margin thresholds', () => {
  for (const name of ACTIONS) {
    for (const [margin, outcome] of [[-1, 'failure'], [0, 'tie'], [1, 'success'], [2, 'success'], [3, 'successWithStyle']]) {
      assert.equal(action(name, margin).outcome, outcome);
    }
  }
});

test('overcome distinguishes failure, serious cost, tie cost, success, and style', () => {
  assert.equal(action('overcome', -1).goalAchieved, false);
  assert.equal(action('overcome', -1, { failureChoice: 'succeedAtCost' }).cost, 'serious');
  assert.equal(action('overcome', 0).goalAchieved, true);
  assert.equal(action('overcome', 0).cost, 'minor');
  assert.equal(action('overcome', 1).cost, null);
  assert.equal(action('overcome', 3).boost, true);
});

test('attack tie does no damage; style boost costs exactly one damage shift', () => {
  assert.equal(action('attack', -1).damageShifts, 0);
  assert.equal(action('attack', 0).damageShifts, 0);
  assert.equal(action('attack', 0).boost, true);
  assert.equal(action('attack', 2).damageShifts, 2);
  assert.equal(action('attack', 3).damageShifts, 3);
  assert.equal(action('attack', 3).boost, false);
  const traded = action('attack', 3, { tradeShiftForBoost: true });
  assert.equal(traded.damageShifts, 2); assert.equal(traded.boost, true);
  assert.throws(() => action('attack', 2, { tradeShiftForBoost: true }), code('INVALID_TRADE'));
  assert.throws(() => action('overcome', 3, { tradeShiftForBoost: true }), code('INVALID_TRADE'));
});

test('defend tie consults the attacking action and style grants a boost', () => {
  assert.equal(action('defend', 0).consultOpposingAction, true);
  assert.equal(action('defend', 1).goalAchieved, true);
  assert.equal(action('defend', 3).boost, true);
});

test('advantage creation, discovery, and known-aspect ties differ', () => {
  const creation = action('createAdvantage', 0);
  assert.equal(creation.boost, true); assert.equal(creation.createsAspect, false); assert.equal(creation.freeInvokes, 0);
  const discovery = action('createAdvantage', 0, { advantageMode: 'discover' });
  assert.equal(discovery.discoversAspect, true); assert.equal(discovery.freeInvokes, 1);
  assert.equal(action('createAdvantage', 0, { advantageMode: 'existing' }).freeInvokes, 1);
  assert.equal(action('createAdvantage', 3).freeInvokes, 2);
  const fail = action('createAdvantage', -1, { failureChoice: 'opponentInvoke' });
  assert.equal(fail.createsAspect, true); assert.equal(fail.freeInvokes, 1); assert.equal(fail.freeInvokeRecipient, 'opponent');
  assert.equal(action('createAdvantage', -1).freeInvokes, 0);
  assert.throws(() => action('createAdvantage', -1, { advantageMode: 'existing', failureChoice: 'opponentInvoke' }), code('INVALID_FAILURE_CHOICE'));
});

test('paid invokes cost exactly one point and each aspect is paid only once per roll', () => {
  const character = pc(), original = copy(character), firstRoll = roll(character);
  const first = invoke(character, firstRoll, character.aspects[0]);
  assert.equal(first.character.fatePoints, 2); assert.equal(first.roll.total, 5);
  assert.throws(() => invoke(first.character, first.roll, first.aspect), code('ASPECT_ALREADY_PAID'));
  const second = invoke(first.character, first.roll, first.character.aspects[1]);
  assert.equal(second.character.fatePoints, 1); assert.equal(second.roll.total, 7);
  assert.deepEqual(character, original); assert.equal(firstRoll.total, 3);
});

test('two free invokes on the same aspect stack and can combine with a paid invoke', () => {
  let character = pc(), currentRoll = roll(character);
  let aspect = createAspect({ id: 'target-is-distracted', name: 'Distracted' });
  aspect = grantFreeInvoke(aspect, { id: 'free-1', authorizedActorIds: ['hero'] });
  aspect = grantFreeInvoke(aspect, { id: 'free-2', authorizedActorIds: ['hero'] });
  for (const freeInvokeId of ['free-1', 'free-2']) {
    const result = invoke(character, currentRoll, aspect, { mode: 'free', freeInvokeId });
    character = result.character; currentRoll = result.roll; aspect = result.aspect;
  }
  assert.equal(character.fatePoints, 3); assert.equal(currentRoll.total, 7); assert.equal(aspect.freeInvokes.length, 0);
  const paid = invoke(character, currentRoll, aspect);
  assert.equal(paid.roll.total, 9); assert.equal(paid.character.fatePoints, 2);
  assert.throws(() => invoke(character, currentRoll, aspect, { mode: 'free', freeInvokeId: 'free-1' }), code('NO_FREE_INVOKE'));
});

test('free invoke ownership and stale token replay are checked', () => {
  const character = pc(), currentRoll = roll(character);
  const aspect = createAspect({ id: 'a', name: 'Loose bricks', freeInvokes: [{ id: 'f', authorizedActorIds: ['hero'] }] });
  assert.throws(() => invoke(pc({ id: 'intruder' }), currentRoll, aspect, { mode: 'free', freeInvokeId: 'f' }), code('FREE_INVOKE_NOT_AUTHORIZED'));
  const spent = invoke(character, currentRoll, aspect, { mode: 'free', freeInvokeId: 'f' });
  assert.throws(() => invoke(spent.character, spent.roll, aspect, { mode: 'free', freeInvokeId: 'f' }), code('FREE_INVOKE_ALREADY_USED'));
  const owned = copy(character.aspects[0]); owned.name = 'Stale replacement';
  assert.throws(() => invoke(character, currentRoll, owned), code('STALE_OWNED_ASPECT'));
});

test('reroll replaces all four dice while preserving previous modifiers', () => {
  const character = pc();
  const unlucky = createRoll({ id: 'r', character, action: 'overcome', approach: 'quick', opposition: 3, stuntBonus: 2 }, () => 0);
  const first = invoke(character, unlucky, character.aspects[0]);
  const rerolled = invokeAspect({ character: first.character, roll: first.roll, aspect: first.character.aspects[1], mode: 'paid', effect: 'reroll', justification: 'My training gives me another chance.' }, () => 0.9);
  assert.deepEqual(rerolled.roll.dice, [1, 1, 1, 1]);
  assert.equal(rerolled.roll.total, 11); assert.equal(rerolled.character.fatePoints, 1);
});

test('ally help and opposition invokes affect the intended side', () => {
  const hero = pc(), ally = pc({ id: 'ally' }), currentRoll = roll(hero);
  const help = invoke(ally, currentRoll, ally.aspects[0]);
  assert.equal(help.roll.total, 5); assert.equal(help.roll.opposition, 3);
  const hinder = invoke(ally, currentRoll, ally.aspects[0], { effect: 'opposition' });
  assert.equal(hinder.roll.total, 3); assert.equal(hinder.roll.opposition, 5);
  assert.throws(() => invoke(ally, currentRoll, ally.aspects[0], { effect: 'reroll' }), code('INVALID_INVOKE_TARGET'));
});

test('a boost disappears after its one free use and cannot be bought repeatedly', () => {
  const character = pc();
  const boost = createAspect({ id: 'boost', name: 'Momentary opening', kind: 'boost', freeInvokes: [{ id: 'f', authorizedActorIds: ['hero'] }] });
  assert.throws(() => invoke(character, roll(character), boost), code('BOOST_REQUIRES_FREE_INVOKE'));
  assert.equal(invoke(character, roll(character), boost, { mode: 'free', freeInvokeId: 'f' }).removeAspect, true);
});

test('paid invokes require funds and failed transactions leave inputs intact', () => {
  const character = pc(); character.fatePoints = 0;
  const before = copy(character), currentRoll = roll(character);
  assert.throws(() => invoke(character, currentRoll, character.aspects[0]), code('NO_FATE_POINTS'));
  assert.deepEqual(character, before);
  assert.throws(() => invoke(character, { ...currentRoll, total: 999 }, character.aspects[0]), code('INVALID_ROLL'));
});

test('a four-shift hit can use box 2 plus mild consequence, granting attacker a free invoke', () => {
  const character = pc(), before = copy(character);
  const result = absorbDamage(character, { shifts: 4, stressBox: 2, consequences: [{ severity: 'mild', name: 'Sprained ankle' }], context, attackerId: 'thug', hitId: 'hit-1' });
  assert.deepEqual(result.character.stress, [false, true, false]);
  assert.equal(result.absorbed, 4); assert.equal(result.remaining, 0); assert.equal(result.takenOut, false);
  assert.deepEqual(result.character.consequences.mild.freeInvokes[0].authorizedActorIds, ['thug']);
  assert.deepEqual(character, before);
});

test('multiple stress boxes, occupied boxes, duplicate consequences, and zero-hit allocations are rejected', () => {
  const character = pc();
  assert.throws(() => absorbDamage(character, { shifts: 3, stressBox: [1, 2] }), code('ONE_STRESS_BOX'));
  assert.throws(() => absorbDamage(character, { shifts: 3, stressBoxes: [1, 2] }), code('ONE_STRESS_BOX'));
  const used = absorbDamage(character, { shifts: 1, stressBox: 1 }).character;
  assert.throws(() => absorbDamage(used, { shifts: 1, stressBox: 1 }), code('STRESS_BOX_USED'));
  assert.throws(() => absorbDamage(character, { shifts: 4, consequences: [{ severity: 'mild', name: 'A' }, { severity: 'mild', name: 'B' }] }), code('INVALID_CONSEQUENCE_SELECTION'));
  assert.throws(() => absorbDamage(character, { shifts: 0, stressBox: 1 }), code('ZERO_HIT_ALLOCATION'));
  assert.deepEqual(absorbDamage(character, { shifts: 0 }).character, character);
});

test('one hit can consume multiple different consequences, but insufficient absorption takes the PC out', () => {
  const character = pc();
  const survived = absorbDamage(character, { shifts: 9, stressBox: 3, consequences: [{ severity: 'mild', name: 'Bruised' }, { severity: 'moderate', name: 'Fracture' }], context, attackerId: 'thug', hitId: 'hit-2' });
  assert.equal(survived.takenOut, false);
  assert.throws(() => absorbDamage(survived.character, { shifts: 2, consequences: [{ severity: 'mild', name: 'Bruised again' }], context, attackerId: 'thug', hitId: 'hit-3' }), code('CONSEQUENCE_SLOT_USED'));
  const lost = absorbDamage(character, { shifts: 4, stressBox: 3 });
  assert.equal(lost.remaining, 1); assert.equal(lost.takenOut, true);
  assert.throws(() => roll(lost.character), code('ALREADY_TAKEN_OUT'));
});

test('session refresh is chronological and idempotent, and preserves surplus points', () => {
  let character = pc(); character.fatePoints = 1;
  character = beginSession(character, { sessionId: 'session-1', sessionIndex: 1 });
  assert.equal(character.fatePoints, 3);
  character.fatePoints = 0;
  assert.equal(beginSession(character, { sessionId: 'session-1', sessionIndex: 1 }).fatePoints, 0);
  assert.throws(() => beginSession(character, { sessionId: 'session-1', sessionIndex: 2 }), code('SESSION_ID_REUSED'));
  assert.throws(() => beginSession(character, { sessionId: 'new-id', sessionIndex: 1 }), code('SESSION_NOT_NEWER'));
  character.fatePoints = 7;
  assert.equal(beginSession(character, { sessionId: 'session-2', sessionIndex: 2 }).fatePoints, 7);
});

test('once-per-session stunt usage survives reload and resets only in a new session', () => {
  let character = beginSession(pc({ stunts: [sessionStunt] }), { sessionId: 'session-1', sessionIndex: 1 });
  character = useSessionStunt(character, { stuntId: 'contact', sessionId: 'session-1' });
  const reloaded = beginSession(copy(character), { sessionId: 'session-1', sessionIndex: 1 });
  assert.throws(() => useSessionStunt(reloaded, { stuntId: 'contact', sessionId: 'session-1' }), code('STUNT_ALREADY_USED'));
  const next = beginSession(character, { sessionId: 'session-2', sessionIndex: 2 });
  assert.equal(useSessionStunt(next, { stuntId: 'contact', sessionId: 'session-2' }).stunts[0].usedSessionId, 'session-2');
});

test('compels apply only accepted or declined decisions and cannot overdraw points', () => {
  const character = pc(), request = { aspectId: 'trouble', complication: 'The delivery interrupts the escape.' };
  assert.equal(resolveCompel(character, { ...request, decision: 'accept' }).fatePoints, 4);
  assert.equal(resolveCompel(character, { ...request, decision: 'decline' }).fatePoints, 2);
  assert.throws(() => resolveCompel(character, { ...request, decision: 'propose' }), code('INVALID_COMPEL'));
  assert.throws(() => resolveCompel({ ...character, fatePoints: 0 }, { ...request, decision: 'decline' }), code('NO_FATE_POINTS'));
});

test('minor milestones permit one adjustment, do not raise power, and cannot rename high concept', () => {
  const character = pc();
  const swapped = applyMilestone(character, { id: 'm1', type: 'minor', minorAdjustment: { kind: 'swapApproaches', first: 'quick', second: 'forceful' } });
  assert.equal(swapped.approaches.quick, 0); assert.equal(swapped.approaches.forceful, 3);
  assert.equal(swapped.refresh, 3);
  assert.throws(() => applyMilestone(character, { id: 'm1', type: 'minor', approachIncrease: 'quick' }), code('INVALID_MILESTONE'));
  assert.throws(() => applyMilestone(character, { id: 'm1', type: 'minor', minorAdjustment: { kind: 'renameAspect', aspectId: character.aspects[0].id, name: 'New high concept' } }), code('INVALID_MINOR_ADJUSTMENT'));
  const renamed = applyMilestone(character, { id: 'm1', type: 'minor', minorAdjustment: { kind: 'renameAspect', aspectId: character.aspects[1].id, name: 'New trouble' } });
  assert.equal(renamed.aspects[1].name, 'New trouble');
});

test('milestone replay is rejected, significant gains cap at +5, and major inherits benefits', () => {
  let character = pc();
  character = applyMilestone(character, { id: 'm1', type: 'significant', approachIncrease: 'quick' });
  character = applyMilestone(character, { id: 'm2', type: 'significant', approachIncrease: 'quick' });
  assert.equal(character.approaches.quick, 5);
  assert.throws(() => applyMilestone(character, { id: 'm2', type: 'significant', approachIncrease: 'clever' }), code('MILESTONE_ALREADY_APPLIED'));
  assert.throws(() => applyMilestone(character, { id: 'm3', type: 'significant', approachIncrease: 'quick' }), code('APPROACH_CAP'));
  const major = applyMilestone(character, { id: 'm3', type: 'major', approachIncrease: 'clever', highConceptName: 'Courier of a saved city' });
  assert.equal(major.refreshBase, 4); assert.equal(major.refresh, 4); assert.equal(major.fatePoints, 3);
  assert.equal(major.approaches.clever, 3); assert.equal(major.aspects[0].name, 'Courier of a saved city');
});

test('stunt additions/exchanges charge refresh correctly, including a major milestone purchase', () => {
  let character = pc({ stunts: [bonusStunt('one'), bonusStunt('two'), bonusStunt('three')] });
  character = applyMilestone(character, { id: 'm1', type: 'minor', minorAdjustment: { kind: 'addStunt', stunt: bonusStunt('four') } });
  assert.equal(character.refresh, 2); assert.equal(character.fatePoints, 3);
  character = applyMilestone(character, { id: 'm2', type: 'minor', minorAdjustment: { kind: 'exchangeStunt', stuntId: 'four', stunt: bonusStunt('replacement') } });
  assert.equal(character.refresh, 2); assert.equal(character.stunts.length, 4);
  const major = applyMilestone(character, { id: 'm3', type: 'major', approachIncrease: 'quick', majorStunt: bonusStunt('five') });
  assert.equal(major.refreshBase, 4); assert.equal(major.refresh, 2); assert.equal(major.stunts.length, 5);
});

test('scene end clears stress and taken-out state while preserving every consequence', () => {
  const injured = absorbDamage(pc(), { shifts: 7, stressBox: 3, consequences: [{ severity: 'mild', name: 'Winded' }], context, attackerId: 'thug', hitId: 'hit' }).character;
  const recovered = endScene(injured);
  assert.deepEqual(recovered.stress, [false, false, false]); assert.equal(recovered.takenOut, false);
  assert.deepEqual(recovered.consequences, injured.consequences);
});

test('recovery requires GM approval and appropriate fictional timing for each severity', () => {
  let character = absorbDamage(pc(), { shifts: 12, consequences: [{ severity: 'mild', name: 'Winded' }, { severity: 'moderate', name: 'Fracture' }, { severity: 'severe', name: 'Shattered confidence' }], context, attackerId: 'thug', hitId: 'hit' }).character;
  const recovery = { gmApproved: true, justification: 'Appropriate rest and treatment occurred.', context };
  assert.throws(() => recoverConsequence(character, { ...recovery, severity: 'mild', phase: 'sceneEnd', rested: true, gmApproved: false }), code('GM_RECOVERY_REQUIRED'));
  assert.throws(() => recoverConsequence(character, { ...recovery, severity: 'mild', phase: 'sceneEnd' }), code('RECOVERY_NOT_READY'));
  character = recoverConsequence(character, { ...recovery, severity: 'mild', phase: 'sceneEnd', rested: true });
  assert.equal(character.consequences.mild, null);
  assert.throws(() => recoverConsequence(character, { ...recovery, severity: 'moderate', phase: 'sessionEnd' }), code('RECOVERY_NOT_READY'));
  character = recoverConsequence(character, { ...recovery, severity: 'moderate', phase: 'sessionEnd', context: later });
  assert.equal(character.consequences.moderate, null);
  assert.throws(() => recoverConsequence(character, { ...recovery, severity: 'severe', phase: 'scenarioEnd' }), code('RECOVERY_NOT_READY'));
  character = recoverConsequence(character, { ...recovery, severity: 'severe', phase: 'scenarioEnd', context: later });
  assert.equal(character.consequences.severe, null);
});

test('session refresh and milestones never silently heal consequences or clear scene stress', () => {
  const injured = absorbDamage(pc(), { shifts: 4, stressBox: 2, consequences: [{ severity: 'mild', name: 'Winded' }], context, attackerId: 'thug', hitId: 'hit' }).character;
  const refreshed = beginSession(injured, { sessionId: 'session-1', sessionIndex: 1 });
  const advanced = applyMilestone(refreshed, { id: 'm1', type: 'minor' });
  assert.deepEqual(advanced.consequences, injured.consequences);
  assert.deepEqual(advanced.stress, injured.stress);
});

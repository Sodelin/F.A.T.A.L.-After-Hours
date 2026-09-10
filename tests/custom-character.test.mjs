import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHARACTER_TEMPLATES, FateRuleError, createCharacter, createCustomCharacter, validateCharacter,
  addStunt, removeStunt, renameCharacterAspects, beginSession, useSessionStunt,
  grantFreeInvoke, applyMilestone,
} from '../lib/fate/domain.mjs';

const copy = value => JSON.parse(JSON.stringify(value));
const authored = {
  id: 'user-character', name: 'User-selected name', highConcept: 'User-authored high concept',
  trouble: 'User-authored trouble', aspects: ['User-authored additional aspect'],
  approaches: { careful: 3, clever: 2, flashy: 2, forceful: 1, quick: 1, sneaky: 0 },
};
const character = options => createCustomCharacter({ ...copy(authored), ...options });
const bonus = id => ({ id, name: 'User stunt name', description: 'User stunt description',
  kind: 'bonus', approach: 'careful', action: 'overcome', bonus: 2, condition: 'User-authored condition' });
const session = id => ({ id, name: 'User session stunt', description: 'User-authored session exception', kind: 'oncePerSession' });
const code = expected => error => error instanceof FateRuleError && error.code === expected;

test('custom character creation preserves authored fields and never supplies legacy personality text', () => {
  const input = copy(authored), before = copy(input), created = createCustomCharacter(input);
  assert.equal(created.name, input.name);
  assert.equal(created.appearance, '');
  assert.deepEqual(created.aspects.map(item => item.name), [input.highConcept, input.trouble, ...input.aspects]);
  assert.deepEqual(created.approaches, input.approaches);
  assert.deepEqual(validateCharacter(created, { requireStartingRatings: true }), { valid: true, errors: [] });
  assert.deepEqual(created.stunts, []);
  for (const template of CHARACTER_TEMPLATES) {
    assert.equal(JSON.stringify(created).includes(template.highConcept), false);
    assert.equal(JSON.stringify(created).includes(template.trouble), false);
  }
  created.aspects[0].name = 'Edited user text';
  assert.deepEqual(input, before);
});

test('every authored identity/aspect/rating field is mandatory, including explicit additional aspects', () => {
  assert.throws(() => createCustomCharacter(), code('CUSTOM_IDENTITY_REQUIRED'));
  for (const field of ['id', 'name', 'highConcept', 'trouble', 'aspects', 'approaches']) {
    const input = copy(authored); delete input[field];
    assert.throws(() => createCustomCharacter(input), FateRuleError, `Missing ${field} must not silently use a template.`);
  }
  for (const field of ['id', 'name', 'highConcept', 'trouble']) {
    assert.throws(() => character({ [field]: '   ' }), FateRuleError);
  }
  for (const aspects of [[], [''], ['A', 'B', 'C', 'D'], null]) {
    assert.throws(() => character({ aspects }), code('CUSTOM_ASPECTS_REQUIRED'));
  }
  assert.equal(character({ aspects: ['A', 'B', 'C'] }).aspects.length, 5);
});

test('custom character ratings enforce the standard starting distribution', () => {
  assert.throws(() => character({ approaches: { ...authored.approaches, careful: 4 } }), code('INVALID_CHARACTER'));
  assert.throws(() => character({ approaches: { careful: 3, clever: 2, flashy: 2, forceful: 1, quick: 1 } }), code('INVALID_CHARACTER'));
  assert.throws(() => character({ approaches: { ...authored.approaches, extra: 0 } }), code('INVALID_CHARACTER'));
  assert.throws(() => character({ approaches: { ...authored.approaches, careful: '3' } }), code('INVALID_CHARACTER'));
});

test('first three stunts are free, fourth/fifth cost refresh, and initial points use resulting refresh', () => {
  for (let count = 0; count <= 5; count += 1) {
    const created = character({ stunts: Array.from({ length: count }, (_, i) => bonus(`stunt-${i}`)) });
    assert.equal(created.refresh, 3 - Math.max(0, count - 3));
    assert.equal(created.fatePoints, created.refresh);
  }
  assert.throws(() => character({ stunts: Array.from({ length: 6 }, (_, i) => bonus(`stunt-${i}`)) }), code('STUNT_LIMIT'));
  assert.throws(() => character({ stunts: null }), code('STUNT_LIMIT'));
});

test('adding stunts preserves current points even when refresh falls below them', () => {
  let current = character(); current.fatePoints = 7;
  const original = copy(current);
  for (let count = 1; count <= 5; count += 1) {
    current = addStunt(current, bonus(`stunt-${count}`));
    assert.equal(current.fatePoints, 7);
    assert.equal(current.refresh, 3 - Math.max(0, count - 3));
  }
  assert.throws(() => addStunt(current, bonus('sixth')), code('STUNT_LIMIT'));
  assert.deepEqual(original.stunts, []);
  assert.deepEqual(validateCharacter(current), { valid: true, errors: [] });
});

test('removing stunts restores future refresh without immediate Fate-point refunds', () => {
  let current = character({ stunts: Array.from({ length: 5 }, (_, i) => bonus(`stunt-${i}`)) });
  current.fatePoints = 0;
  const original = copy(current);
  current = removeStunt(current, 'stunt-4');
  assert.equal(current.refresh, 2); assert.equal(current.fatePoints, 0);
  current = removeStunt(current, 'stunt-3');
  assert.equal(current.refresh, 3); assert.equal(current.fatePoints, 0);
  current = removeStunt(current, 'stunt-2');
  assert.equal(current.refresh, 3); assert.equal(current.fatePoints, 0);
  assert.equal(original.stunts.length, 5);
  const refreshed = beginSession(current, { sessionId: 'session-1', sessionIndex: 1 });
  assert.equal(refreshed.fatePoints, 3);
});

test('stunt validation rejects duplicate ids, missing rules, invalid bonuses, and nonexistent removals', () => {
  const current = addStunt(character(), bonus('one')), before = copy(current);
  assert.throws(() => addStunt(current, bonus('one')), code('DUPLICATE_STUNT_ID'));
  for (const stunt of [null, {}, { ...bonus('two'), bonus: 3 }, { ...bonus('two'), condition: '' }, { ...bonus('two'), action: 'inventedAction' }]) {
    assert.throws(() => addStunt(current, stunt), code('INVALID_STUNT'));
  }
  assert.throws(() => removeStunt(current, 'missing'), code('STUNT_NOT_FOUND'));
  assert.throws(() => removeStunt(current, ''), code('INVALID_STUNT_ID'));
  assert.deepEqual(current, before);
});

test('new session stunts normalize internal usage state and work with existing useSessionStunt', () => {
  const created = character({ stunts: [session('initial')] });
  assert.equal(created.stunts[0].usedSessionId, null);
  let current = beginSession(created, { sessionId: 'session-1', sessionIndex: 1 });
  current = addStunt(current, session('added'));
  assert.equal(current.stunts[1].usedSessionId, null);
  current = useSessionStunt(current, { stuntId: 'added', sessionId: 'session-1' });
  assert.throws(() => useSessionStunt(current, { stuntId: 'added', sessionId: 'session-1' }), code('STUNT_ALREADY_USED'));
});

test('a spent session stunt cannot be removed/re-added to bypass its usage limit', () => {
  let current = beginSession(character({ stunts: [session('once')] }), { sessionId: 'session-1', sessionIndex: 1 });
  current = useSessionStunt(current, { stuntId: 'once', sessionId: 'session-1' });
  assert.throws(() => removeStunt(current, 'once'), code('STUNT_USED_THIS_SESSION'));
  const nextSession = beginSession(current, { sessionId: 'session-2', sessionIndex: 2 });
  assert.equal(removeStunt(nextSession, 'once').stunts.length, 0);
  assert.equal(removeStunt(character({ stunts: [session('unused')] }), 'unused').stunts.length, 0);
});

test('five-stunt product cap remains explicit after major refresh growth without invalidating legacy saves', () => {
  let current = character({ stunts: Array.from({ length: 5 }, (_, i) => bonus(`stunt-${i}`)) });
  current = applyMilestone(current, { id: 'major-1', type: 'major', approachIncrease: 'sneaky' });
  assert.equal(current.refreshBase, 4); assert.equal(current.refresh, 2);
  assert.throws(() => addStunt(current, bonus('sixth')), code('STUNT_LIMIT'));
  const legacy = applyMilestone(current, { id: 'minor-legacy', type: 'minor', minorAdjustment: { kind: 'addStunt', stunt: bonus('legacy-sixth') } });
  assert.equal(legacy.stunts.length, 6);
  assert.equal(validateCharacter(legacy).valid, true, 'Legacy advanced saves remain valid; the new sheet-edit path has the product cap.');
  assert.equal(removeStunt(legacy, 'legacy-sixth').stunts.length, 5);
});

test('all character aspect names can be edited while preserving ids, types, free invokes and state', () => {
  const current = character({ aspects: ['First authored aspect', 'Second authored aspect', 'Third authored aspect'] });
  current.aspects[0] = grantFreeInvoke(current.aspects[0], { id: 'grant-1', authorizedActorIds: [current.id] });
  current.fatePoints = 8; current.stress[1] = true;
  const original = copy(current);
  const names = Object.fromEntries(current.aspects.map((aspect, index) => [aspect.id, `User revision ${index + 1}`]));
  const edited = renameCharacterAspects(current, names);
  assert.deepEqual(edited.aspects.map(aspect => aspect.name), Object.values(names));
  assert.deepEqual(edited.aspects.map(({ name, ...rest }) => rest), current.aspects.map(({ name, ...rest }) => rest));
  assert.equal(edited.fatePoints, 8); assert.deepEqual(edited.stress, current.stress);
  assert.deepEqual(current, original);
  assert.equal(validateCharacter(edited).valid, true);
});

test('aspect renaming supports partial edits but rejects blank names and foreign/consequence ids', () => {
  const current = character(), target = current.aspects[2].id;
  const partial = renameCharacterAspects(current, { [target]: 'User-selected revised name' });
  assert.equal(partial.aspects[2].name, 'User-selected revised name');
  assert.equal(partial.aspects[0].name, current.aspects[0].name);
  for (const map of [null, {}, []]) assert.throws(() => renameCharacterAspects(current, map), code('ASPECT_NAMES_REQUIRED'));
  assert.throws(() => renameCharacterAspects(current, { [target]: ' ' }), code('INVALID_ASPECT_NAME'));
  assert.throws(() => renameCharacterAspects(current, { 'another-character:aspect': 'Name' }), code('CHARACTER_ASPECT_NOT_FOUND'));
  assert.throws(() => renameCharacterAspects(current, { 'consequence:mild': 'Recovered' }), code('CHARACTER_ASPECT_NOT_FOUND'));
});

test('legacy template creation remains available for save and test compatibility', () => {
  for (const template of CHARACTER_TEMPLATES) {
    assert.equal(validateCharacter(createCharacter({ id: `legacy-${template.id}`, templateId: template.id })).valid, true);
  }
});

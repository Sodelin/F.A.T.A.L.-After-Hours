/** Fate Accelerated domain rules. Pure JSON reducers; see README for boundaries. */

export const RULESET = 'fate-accelerated';
export const APPROACHES = Object.freeze(['careful', 'clever', 'flashy', 'forceful', 'quick', 'sneaky']);
export const ACTIONS = Object.freeze(['overcome', 'createAdvantage', 'attack', 'defend']);
export const CONSEQUENCE_SHIFTS = Object.freeze({ mild: 2, moderate: 4, severe: 6 });

const clone = value => JSON.parse(JSON.stringify(value));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const str = value => typeof value === 'string' && value.trim().length > 0;
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const finite = value => Number.isSafeInteger(value);
const unique = values => new Set(values).size === values.length;

export class FateRuleError extends Error {
  constructor(code, message) { super(message); this.name = 'FateRuleError'; this.code = code; }
}

function requireRule(condition, code, message) {
  if (!condition) throw new FateRuleError(code, message);
}

function deepFreeze(value) {
  Object.values(value).forEach(item => { if (item && typeof item === 'object') deepFreeze(item); });
  return Object.freeze(value);
}

// Original quick-start personalities; each obeys FAE's starting distribution.
export const CHARACTER_TEMPLATES = deepFreeze([
  { id: 'night-courier', name: 'Night Courier', highConcept: 'Courier between impossible neighborhoods', trouble: 'I never leave a delivery unfinished', aspects: ['Every alley has a story'], approaches: { careful: 1, clever: 2, flashy: 1, forceful: 0, quick: 3, sneaky: 2 } },
  { id: 'late-detective', name: 'Late Detective', highConcept: 'Detective of the city after midnight', trouble: 'The mystery always comes home with me', aspects: ['A question opens more doors than a key'], approaches: { careful: 2, clever: 3, flashy: 0, forceful: 1, quick: 1, sneaky: 2 } },
  { id: 'neon-host', name: 'Neon Host', highConcept: 'Host of the last open venue', trouble: 'Everyone thinks I owe them a favor', aspects: ['There is always room for one more'], approaches: { careful: 1, clever: 2, flashy: 3, forceful: 2, quick: 1, sneaky: 0 } },
]);

function validGrant(grant) {
  return record(grant) && str(grant.id) && Array.isArray(grant.authorizedActorIds)
    && grant.authorizedActorIds.length > 0 && grant.authorizedActorIds.every(str) && unique(grant.authorizedActorIds);
}

export function createAspect({ id, name, kind = 'situation', freeInvokes = [] }) {
  const aspect = { id, name, kind, freeInvokes: clone(freeInvokes) };
  assertAspect(aspect);
  return aspect;
}

function assertAspect(aspect) {
  requireRule(record(aspect) && str(aspect.id) && str(aspect.name), 'INVALID_ASPECT', 'An aspect needs an id and a nonempty name.');
  requireRule(['highConcept', 'trouble', 'character', 'situation', 'boost', 'consequence'].includes(aspect.kind), 'INVALID_ASPECT', 'Unknown aspect kind.');
  requireRule(Array.isArray(aspect.freeInvokes) && aspect.freeInvokes.every(validGrant)
    && unique(aspect.freeInvokes.map(grant => grant.id)), 'INVALID_FREE_INVOKES', 'Free invokes need unique ids and explicit authorized actors.');
  requireRule(aspect.kind !== 'boost' || aspect.freeInvokes.length <= 1, 'INVALID_BOOST', 'A boost has at most one free invoke.');
}

export function grantFreeInvoke(aspect, { id, authorizedActorIds }) {
  assertAspect(aspect);
  const next = clone(aspect);
  next.freeInvokes.push({ id, authorizedActorIds: clone(authorizedActorIds) });
  assertAspect(next);
  return next;
}

function assertStunt(stunt) {
  requireRule(record(stunt) && str(stunt.id) && str(stunt.name) && str(stunt.description), 'INVALID_STUNT', 'Stunts need an id, name, and description.');
  requireRule(['bonus', 'oncePerSession'].includes(stunt.kind), 'INVALID_STUNT', 'Unknown stunt kind.');
  if (stunt.kind === 'bonus') {
    requireRule(APPROACHES.includes(stunt.approach) && ACTIONS.includes(stunt.action)
      && stunt.bonus === 2 && str(stunt.condition), 'INVALID_STUNT', 'Bonus stunts need an approach, action, +2 bonus, and fictional condition.');
  } else {
    requireRule(stunt.usedSessionId === null || str(stunt.usedSessionId), 'INVALID_STUNT', 'Session stunts need a null or named usage session.');
  }
}

function assertContext(context) {
  requireRule(record(context) && str(context.sceneId) && str(context.sessionId)
    && str(context.scenarioId) && integer(context.sessionIndex, 1), 'INVALID_CONTEXT', 'Context needs scene, session, scenario ids and a positive session index.');
}

export function validateCharacter(character, { requireStartingRatings = false } = {}) {
  const errors = [];
  const check = (condition, code) => { if (!condition) errors.push(code); };
  if (!record(character)) return { valid: false, errors: ['CHARACTER_NOT_OBJECT'] };
  check(character.schemaVersion === 1 && character.ruleset === RULESET, 'INVALID_RULESET');
  check(str(character.id) && str(character.name) && typeof character.appearance === 'string', 'INVALID_IDENTITY');
  const ratingsOK = record(character.approaches) && Object.keys(character.approaches).length === 6
    && APPROACHES.every(key => integer(character.approaches[key], 0, 5));
  check(ratingsOK, 'INVALID_APPROACHES');
  if (ratingsOK && requireStartingRatings) check(Object.values(character.approaches).sort().join(',') === '0,1,1,2,2,3', 'INVALID_STARTING_RATINGS');
  const aspectsOK = Array.isArray(character.aspects) && character.aspects.length >= 3 && character.aspects.length <= 5;
  check(aspectsOK, 'INVALID_CHARACTER_ASPECTS');
  if (aspectsOK) {
    for (const aspect of character.aspects) {
      try { assertAspect(aspect); } catch { errors.push('INVALID_CHARACTER_ASPECTS'); }
    }
    check(character.aspects.every(aspect => record(aspect) && ['highConcept', 'trouble', 'character'].includes(aspect.kind)), 'INVALID_CHARACTER_ASPECT_KIND');
    check(character.aspects.filter(aspect => aspect?.kind === 'highConcept').length === 1
      && character.aspects.filter(aspect => aspect?.kind === 'trouble').length === 1, 'MISSING_CORE_ASPECTS');
    check(unique(character.aspects.map(aspect => aspect?.id)), 'DUPLICATE_ASPECT_IDS');
  }
  check(Array.isArray(character.stunts), 'INVALID_STUNTS');
  if (Array.isArray(character.stunts)) {
    for (const stunt of character.stunts) { try { assertStunt(stunt); } catch { errors.push('INVALID_STUNTS'); } }
    check(unique(character.stunts.map(stunt => stunt?.id)), 'DUPLICATE_STUNT_IDS');
    check(integer(character.refreshBase, 3) && integer(character.refresh, 1)
      && character.refresh === character.refreshBase - Math.max(0, character.stunts.length - 3), 'INVALID_REFRESH');
  }
  check(integer(character.fatePoints), 'INVALID_FATE_POINTS');
  check(Array.isArray(character.stress) && character.stress.length === 3 && character.stress.every(box => typeof box === 'boolean'), 'INVALID_STRESS');
  check(typeof character.takenOut === 'boolean', 'INVALID_TAKEN_OUT');
  const consequencesOK = record(character.consequences) && Object.keys(character.consequences).length === 3
    && Object.keys(CONSEQUENCE_SHIFTS).every(key => Object.hasOwn(character.consequences, key));
  check(consequencesOK, 'INVALID_CONSEQUENCES');
  if (consequencesOK) {
    for (const [severity, consequence] of Object.entries(character.consequences)) {
      if (consequence === null) continue;
      try {
        assertAspect(consequence); assertContext(consequence.incurred);
        check(consequence.kind === 'consequence' && consequence.severity === severity
          && consequence.shifts === CONSEQUENCE_SHIFTS[severity], 'INVALID_CONSEQUENCE');
      } catch { errors.push('INVALID_CONSEQUENCE'); }
    }
  }
  check(character.lastSession === null || (record(character.lastSession) && str(character.lastSession.id)
    && integer(character.lastSession.index, 1)), 'INVALID_LAST_SESSION');
  check(Array.isArray(character.appliedMilestoneIds) && character.appliedMilestoneIds.every(str)
    && unique(character.appliedMilestoneIds), 'INVALID_MILESTONE_HISTORY');
  return { valid: errors.length === 0, errors: [...new Set(errors)] };
}

function assertCharacter(character, options) {
  const result = validateCharacter(character, options);
  requireRule(result.valid, 'INVALID_CHARACTER', `Invalid character: ${result.errors.join(', ')}.`);
}

export function createCharacter({ id, name, templateId = 'night-courier', appearance = '', highConcept,
  trouble, aspects, approaches, stunts = [] }) {
  const template = CHARACTER_TEMPLATES.find(item => item.id === templateId);
  requireRule(Boolean(template), 'UNKNOWN_TEMPLATE', 'Unknown character template.');
  requireRule(Array.isArray(stunts), 'INVALID_STUNTS', 'Stunts must be an array.');
  const additional = aspects ?? template.aspects;
  requireRule(Array.isArray(additional) && additional.length >= 1 && additional.length <= 3
    && additional.every(str), 'INVALID_CHARACTER_ASPECTS', 'Supply one to three additional aspect names.');
  const character = {
    schemaVersion: 1, ruleset: RULESET, id, name: name ?? template.name, appearance,
    approaches: clone(approaches ?? template.approaches),
    aspects: [
      createAspect({ id: `${id}:high-concept`, name: highConcept ?? template.highConcept, kind: 'highConcept' }),
      createAspect({ id: `${id}:trouble`, name: trouble ?? template.trouble, kind: 'trouble' }),
      ...additional.map((aspectName, index) => createAspect({ id: `${id}:aspect:${index + 1}`, name: aspectName, kind: 'character' })),
    ],
    stunts: clone(stunts), refreshBase: 3, refresh: 3 - Math.max(0, stunts.length - 3),
    fatePoints: 3 - Math.max(0, stunts.length - 3), stress: [false, false, false],
    consequences: { mild: null, moderate: null, severe: null }, takenOut: false,
    lastSession: null, appliedMilestoneIds: [],
  };
  assertCharacter(character, { requireStartingRatings: true });
  return character;
}

export function roll4dF(rng = Math.random) {
  requireRule(typeof rng === 'function', 'INVALID_RNG', 'Supply an RNG function.');
  const dice = Array.from({ length: 4 }, () => {
    const draw = rng();
    requireRule(typeof draw === 'number' && Number.isFinite(draw) && draw >= 0 && draw < 1,
      'INVALID_RNG_DRAW', 'RNG draws must be finite numbers in [0, 1).');
    return Math.floor(draw * 3) - 1;
  });
  return { dice, sum: dice.reduce((sum, value) => sum + value, 0) };
}

function classify(margin) { return margin < 0 ? 'failure' : margin === 0 ? 'tie' : margin < 3 ? 'success' : 'successWithStyle'; }

export function resolveAction({ action, total, opposition, advantageMode = 'create',
  failureChoice = 'fail', tradeShiftForBoost = false }) {
  requireRule(ACTIONS.includes(action), 'INVALID_ACTION', 'Unknown action.');
  requireRule(finite(total) && finite(opposition) && finite(total - opposition), 'INVALID_TOTAL', 'Roll totals and margin must be safe integers.');
  requireRule(typeof tradeShiftForBoost === 'boolean', 'INVALID_TRADE', 'Boost trade must be boolean.');
  const margin = total - opposition;
  const outcome = classify(margin);
  const result = { action, margin, outcome, goalAchieved: false, cost: null, damageShifts: 0,
    boost: false, createsAspect: false, discoversAspect: false, freeInvokes: 0,
    freeInvokeRecipient: null, consultOpposingAction: false };
  requireRule(!tradeShiftForBoost || (action === 'attack' && outcome === 'successWithStyle'), 'INVALID_TRADE', 'Only an attack succeeding with style can trade one damage shift for a boost.');
  if (action === 'overcome') {
    requireRule(['fail', 'succeedAtCost'].includes(failureChoice), 'INVALID_FAILURE_CHOICE', 'Unknown overcome failure choice.');
    result.goalAchieved = margin >= 0 || failureChoice === 'succeedAtCost';
    result.cost = margin < 0 && result.goalAchieved ? 'serious' : margin === 0 ? 'minor' : null;
    result.boost = margin >= 3;
  } else if (action === 'attack') {
    result.goalAchieved = margin > 0;
    result.damageShifts = Math.max(0, margin) - (tradeShiftForBoost ? 1 : 0);
    result.boost = margin === 0 || tradeShiftForBoost;
  } else if (action === 'defend') {
    result.goalAchieved = margin > 0;
    result.consultOpposingAction = margin <= 0;
    result.boost = margin >= 3;
  } else {
    requireRule(['create', 'discover', 'existing'].includes(advantageMode), 'INVALID_ADVANTAGE_MODE', 'Unknown advantage mode.');
    requireRule(['fail', 'opponentInvoke'].includes(failureChoice), 'INVALID_FAILURE_CHOICE', 'Unknown advantage failure choice.');
    requireRule(!(advantageMode === 'existing' && failureChoice === 'opponentInvoke'), 'INVALID_FAILURE_CHOICE', 'Failure on a known aspect creates no additional benefit.');
    result.goalAchieved = margin > 0 || (margin === 0 && advantageMode !== 'create');
    result.createsAspect = advantageMode === 'create' && (margin > 0 || (margin < 0 && failureChoice === 'opponentInvoke'));
    result.discoversAspect = advantageMode === 'discover' && (margin >= 0 || failureChoice === 'opponentInvoke');
    result.boost = margin === 0 && advantageMode === 'create';
    result.freeInvokes = margin >= 3 ? 2 : result.goalAchieved ? 1 : margin < 0 && failureChoice === 'opponentInvoke' ? 1 : 0;
    result.freeInvokeRecipient = result.freeInvokes === 0 ? null : margin < 0 ? 'opponent' : 'actor';
  }
  return result;
}

function recomputeRoll(roll) {
  roll.total = roll.dice.reduce((sum, value) => sum + value, 0) + roll.approachBonus + roll.stuntBonus + roll.invokeBonus;
  roll.opposition = roll.baseOpposition + roll.oppositionBonus;
  return roll;
}

function assertRoll(roll) {
  requireRule(record(roll) && str(roll.id) && str(roll.actorId) && ACTIONS.includes(roll.action)
    && APPROACHES.includes(roll.approach), 'INVALID_ROLL', 'Roll identity, action, and approach are required.');
  requireRule(Array.isArray(roll.dice) && roll.dice.length === 4 && roll.dice.every(die => [-1, 0, 1].includes(die)), 'INVALID_ROLL', 'A roll contains exactly four Fate dice.');
  requireRule(integer(roll.approachBonus, 0, 5) && finite(roll.stuntBonus) && integer(roll.invokeBonus)
    && integer(roll.oppositionBonus) && finite(roll.baseOpposition) && finite(roll.total) && finite(roll.opposition), 'INVALID_ROLL', 'Invalid roll modifiers.');
  requireRule(Array.isArray(roll.paidAspectIds) && roll.paidAspectIds.every(str) && unique(roll.paidAspectIds)
    && Array.isArray(roll.usedFreeInvokes) && roll.usedFreeInvokes.every(use => record(use) && str(use.aspectId) && str(use.invokeId))
    && unique(roll.usedFreeInvokes.map(use => JSON.stringify([use.aspectId, use.invokeId]))), 'INVALID_ROLL', 'Invalid invocation ledger.');
  const checked = recomputeRoll(clone(roll));
  requireRule(checked.total === roll.total && checked.opposition === roll.opposition, 'INVALID_ROLL', 'Roll totals disagree with dice and modifiers.');
}

export function createRoll({ id, character, action, approach, opposition, stuntBonus = 0 }, rng = Math.random) {
  assertCharacter(character);
  requireRule(!character.takenOut, 'ALREADY_TAKEN_OUT', 'A taken-out character cannot act in this scene.');
  const roll = recomputeRoll({ id, actorId: character.id, action, approach, dice: roll4dF(rng).dice,
    approachBonus: character.approaches[approach], stuntBonus, invokeBonus: 0,
    baseOpposition: opposition, oppositionBonus: 0, paidAspectIds: [], usedFreeInvokes: [] });
  assertRoll(roll);
  return roll;
}

/** Transaction result must replace ALL returned state, including external aspects. */
export function invokeAspect({ character, roll, aspect, mode, effect = 'bonus', justification, freeInvokeId }, rng = Math.random) {
  assertCharacter(character); assertRoll(roll); assertAspect(aspect);
  const ownedAspect = character.aspects.find(item => item.id === aspect.id)
    ?? Object.values(character.consequences).find(item => item?.id === aspect.id);
  requireRule(!ownedAspect || JSON.stringify(ownedAspect) === JSON.stringify(aspect),
    'STALE_OWNED_ASPECT', 'Use the current aspect from the character when invoking an owned aspect.');
  requireRule(str(justification), 'JUSTIFICATION_REQUIRED', 'Explain why the aspect applies.');
  requireRule(['paid', 'free'].includes(mode) && ['bonus', 'reroll', 'opposition'].includes(effect), 'INVALID_INVOKE', 'Unknown invoke mode or effect.');
  requireRule(effect !== 'reroll' || roll.actorId === character.id, 'INVALID_INVOKE_TARGET', 'You can reroll your own dice; use a bonus to help an ally.');
  requireRule(effect !== 'opposition' || roll.actorId !== character.id, 'INVALID_INVOKE_TARGET', 'Opposition invokes make someone else’s action harder.');
  requireRule(aspect.kind !== 'boost' || mode === 'free', 'BOOST_REQUIRES_FREE_INVOKE', 'Boosts are consumed with their one free invocation.');
  const nextCharacter = clone(character), nextRoll = clone(roll), nextAspect = clone(aspect);
  if (mode === 'paid') {
    requireRule(character.fatePoints >= 1, 'NO_FATE_POINTS', 'A paid invoke costs one Fate point.');
    requireRule(!roll.paidAspectIds.includes(aspect.id), 'ASPECT_ALREADY_PAID', 'An aspect can be invoked with a Fate point only once per roll.');
    nextCharacter.fatePoints -= 1;
    nextRoll.paidAspectIds.push(aspect.id);
  } else {
    const index = aspect.freeInvokes.findIndex(grant => grant.id === freeInvokeId);
    requireRule(index !== -1, 'NO_FREE_INVOKE', 'That free invocation is unavailable.');
    requireRule(aspect.freeInvokes[index].authorizedActorIds.includes(character.id), 'FREE_INVOKE_NOT_AUTHORIZED', 'This actor is not authorized to spend the free invoke.');
    requireRule(!roll.usedFreeInvokes.some(use => use.aspectId === aspect.id && use.invokeId === freeInvokeId), 'FREE_INVOKE_ALREADY_USED', 'That free invocation was already used on this roll.');
    nextAspect.freeInvokes.splice(index, 1);
    nextRoll.usedFreeInvokes.push({ aspectId: aspect.id, invokeId: freeInvokeId });
  }
  if (effect === 'reroll') nextRoll.dice = roll4dF(rng).dice;
  else if (effect === 'opposition') nextRoll.oppositionBonus += 2;
  else nextRoll.invokeBonus += 2;
  recomputeRoll(nextRoll);
  assertRoll(nextRoll);
  const ownIndex = nextCharacter.aspects.findIndex(item => item.id === aspect.id);
  if (ownIndex !== -1) nextCharacter.aspects[ownIndex] = clone(nextAspect);
  for (const severity of Object.keys(CONSEQUENCE_SHIFTS)) {
    if (nextCharacter.consequences[severity]?.id === aspect.id) nextCharacter.consequences[severity] = clone(nextAspect);
  }
  assertCharacter(nextCharacter);
  return { character: nextCharacter, roll: nextRoll, aspect: nextAspect,
    removeAspect: nextAspect.kind === 'boost' && nextAspect.freeInvokes.length === 0 };
}

export function absorbDamage(character, { shifts, stressBox = null, stressBoxes,
  consequences = [], context, attackerId, hitId }) {
  assertCharacter(character);
  requireRule(!character.takenOut, 'ALREADY_TAKEN_OUT', 'A taken-out character cannot absorb another hit in this scene.');
  requireRule(integer(shifts), 'INVALID_DAMAGE', 'Damage must be a nonnegative safe integer.');
  requireRule(stressBoxes === undefined && (stressBox === null || integer(stressBox, 1, 3)), 'ONE_STRESS_BOX', 'Select at most one stress box, numbered 1, 2, or 3.');
  requireRule(Array.isArray(consequences) && consequences.every(item => record(item)
    && Object.hasOwn(CONSEQUENCE_SHIFTS, item.severity) && str(item.name))
    && unique(consequences.map(item => item.severity)), 'INVALID_CONSEQUENCE_SELECTION', 'Select each consequence severity at most once and give it a name.');
  requireRule(shifts > 0 || (stressBox === null && consequences.length === 0), 'ZERO_HIT_ALLOCATION', 'A zero-shift result does not consume stress or consequences.');
  requireRule(stressBox === null || !character.stress[stressBox - 1], 'STRESS_BOX_USED', 'That stress box is already checked.');
  for (const item of consequences) requireRule(character.consequences[item.severity] === null,
    'CONSEQUENCE_SLOT_USED', `The ${item.severity} consequence slot is occupied.`);
  if (consequences.length) {
    assertContext(context);
    requireRule(str(attackerId) && str(hitId), 'MISSING_DAMAGE_PROVENANCE', 'Consequence creation needs attacker and hit ids.');
  }
  const next = clone(character);
  let absorbed = stressBox ?? 0;
  if (stressBox !== null) next.stress[stressBox - 1] = true;
  for (const item of consequences) {
    const id = `${character.id}:consequence:${item.severity}:${hitId}`;
    next.consequences[item.severity] = {
      ...createAspect({ id, name: item.name, kind: 'consequence',
        freeInvokes: [{ id: `${id}:free:1`, authorizedActorIds: [attackerId] }] }),
      severity: item.severity, shifts: CONSEQUENCE_SHIFTS[item.severity], incurred: clone(context),
    };
    absorbed += CONSEQUENCE_SHIFTS[item.severity];
  }
  const remaining = Math.max(0, shifts - absorbed);
  next.takenOut = remaining > 0;
  assertCharacter(next);
  return { character: next, absorbed, remaining, takenOut: next.takenOut };
}

export function endScene(character) {
  assertCharacter(character);
  const next = clone(character);
  next.stress = [false, false, false];
  next.takenOut = false;
  return next;
}

export function beginSession(character, { sessionId, sessionIndex }) {
  assertCharacter(character);
  requireRule(str(sessionId) && integer(sessionIndex, 1), 'INVALID_SESSION', 'Sessions need a stable id and positive chronological index.');
  if (character.lastSession?.id === sessionId) {
    requireRule(character.lastSession.index === sessionIndex, 'SESSION_ID_REUSED', 'The same session id cannot change its index.');
    return clone(character);
  }
  requireRule(character.lastSession === null || sessionIndex > character.lastSession.index,
    'SESSION_NOT_NEWER', 'A new session must follow the previous session chronologically.');
  const next = clone(character);
  next.fatePoints = Math.max(next.fatePoints, next.refresh);
  next.lastSession = { id: sessionId, index: sessionIndex };
  for (const stunt of next.stunts) if (stunt.kind === 'oncePerSession') stunt.usedSessionId = null;
  return next;
}

export function useSessionStunt(character, { stuntId, sessionId }) {
  assertCharacter(character);
  requireRule(str(sessionId) && character.lastSession?.id === sessionId, 'SESSION_NOT_ACTIVE', 'Start the campaign session before spending a session stunt.');
  const next = clone(character), stunt = next.stunts.find(item => item.id === stuntId);
  requireRule(stunt?.kind === 'oncePerSession', 'INVALID_STUNT', 'Select a once-per-session stunt.');
  requireRule(stunt.usedSessionId !== sessionId, 'STUNT_ALREADY_USED', 'This stunt has already been used this session.');
  stunt.usedSessionId = sessionId;
  return next;
}

export function resolveCompel(character, { decision, aspectId, complication }) {
  assertCharacter(character);
  requireRule(str(aspectId) && str(complication), 'INVALID_COMPEL', 'A compel requires an aspect id and a negotiated complication.');
  requireRule(['accept', 'decline'].includes(decision), 'INVALID_COMPEL', 'Resolve an accepted or declined compel.');
  requireRule(decision !== 'decline' || character.fatePoints >= 1, 'NO_FATE_POINTS', 'Declining a compel costs one Fate point.');
  const next = clone(character);
  next.fatePoints += decision === 'accept' ? 1 : -1;
  assertCharacter(next);
  return next;
}

export function applyMilestone(character, { id, type, minorAdjustment = null,
  approachIncrease = null, highConceptName = null, majorStunt = null }) {
  assertCharacter(character);
  requireRule(str(id) && ['minor', 'significant', 'major'].includes(type), 'INVALID_MILESTONE', 'A milestone needs an id and type.');
  requireRule(!character.appliedMilestoneIds.includes(id), 'MILESTONE_ALREADY_APPLIED', 'This milestone was already applied.');
  requireRule(type !== 'minor' || approachIncrease === null, 'INVALID_MILESTONE', 'Minor milestones do not raise approach ratings.');
  requireRule(type === 'minor' || APPROACHES.includes(approachIncrease), 'APPROACH_CHOICE_REQUIRED', 'Choose the approach raised by a significant or major milestone.');
  requireRule(type === 'major' || (highConceptName === null && majorStunt === null), 'INVALID_MILESTONE', 'Only major milestones allow high-concept renaming or an additional stunt purchase.');
  const next = clone(character);
  if (type === 'major') next.refreshBase += 1;
  if (minorAdjustment !== null) {
    requireRule(record(minorAdjustment), 'INVALID_MINOR_ADJUSTMENT', 'Choose one minor adjustment object.');
    switch (minorAdjustment.kind) {
      case 'swapApproaches': {
        const { first, second } = minorAdjustment;
        requireRule(APPROACHES.includes(first) && APPROACHES.includes(second) && first !== second,
          'INVALID_MINOR_ADJUSTMENT', 'Choose two different approaches to swap.');
        [next.approaches[first], next.approaches[second]] = [next.approaches[second], next.approaches[first]];
        break;
      }
      case 'renameAspect': {
        const aspect = next.aspects.find(item => item.id === minorAdjustment.aspectId);
        requireRule(aspect && aspect.kind !== 'highConcept' && str(minorAdjustment.name),
          'INVALID_MINOR_ADJUSTMENT', 'Rename an existing aspect other than the high concept.');
        aspect.name = minorAdjustment.name;
        break;
      }
      case 'exchangeStunt': {
        const index = next.stunts.findIndex(item => item.id === minorAdjustment.stuntId);
        requireRule(index !== -1, 'INVALID_MINOR_ADJUSTMENT', 'The exchanged stunt must exist.');
        assertStunt(minorAdjustment.stunt);
        next.stunts[index] = clone(minorAdjustment.stunt);
        break;
      }
      case 'addStunt':
        assertStunt(minorAdjustment.stunt);
        next.stunts.push(clone(minorAdjustment.stunt));
        break;
      default: throw new FateRuleError('INVALID_MINOR_ADJUSTMENT', 'Unknown minor adjustment.');
    }
  }
  if (type !== 'minor') {
    requireRule(next.approaches[approachIncrease] < 5, 'APPROACH_CAP', 'Approaches cannot exceed +5.');
    next.approaches[approachIncrease] += 1;
  }
  if (highConceptName !== null) {
    requireRule(str(highConceptName), 'INVALID_ASPECT', 'The high concept cannot be empty.');
    next.aspects.find(aspect => aspect.kind === 'highConcept').name = highConceptName;
  }
  if (majorStunt !== null) { assertStunt(majorStunt); next.stunts.push(clone(majorStunt)); }
  next.refresh = next.refreshBase - Math.max(0, next.stunts.length - 3);
  next.appliedMilestoneIds.push(id);
  assertCharacter(next);
  return next;
}

/** GM approval is an explicit domain input, NOT an authentication mechanism. */
export function recoverConsequence(character, { severity, gmApproved, justification,
  phase, context, rested = false }) {
  assertCharacter(character); assertContext(context);
  requireRule(gmApproved === true && str(justification), 'GM_RECOVERY_REQUIRED', 'Recovery needs GM approval and a fictional explanation.');
  requireRule(Object.hasOwn(CONSEQUENCE_SHIFTS, severity) && character.consequences[severity] !== null,
    'NO_CONSEQUENCE', 'Select an occupied consequence slot.');
  const consequence = character.consequences[severity];
  requireRule(context.sessionIndex >= consequence.incurred.sessionIndex, 'INVALID_RECOVERY_TIME', 'Recovery cannot precede the injury.');
  if (severity === 'mild') {
    requireRule(phase === 'sceneEnd' && rested === true, 'RECOVERY_NOT_READY', 'Mild consequences need scene end and a chance to rest.');
  } else if (severity === 'moderate') {
    requireRule(phase === 'sessionEnd' && context.sessionIndex >= consequence.incurred.sessionIndex + 1,
      'RECOVERY_NOT_READY', 'Moderate consequences need the end of the next or a later session.');
  } else {
    requireRule(phase === 'scenarioEnd' && context.sessionIndex >= consequence.incurred.sessionIndex + 1,
      'RECOVERY_NOT_READY', 'Severe consequences need scenario end after spanning at least two sessions.');
  }
  const next = clone(character);
  next.consequences[severity] = null;
  return next;
}

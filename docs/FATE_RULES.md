# Fate Accelerated rules module

Independent, dependency-free ES module for integration into Fate After Hours. It contains plain JSON state and immutable reducers only. It does not read or write storage, call a network, render UI, authenticate users, or change a Sites project.

Run the behavioral suite with the project Node version:

```sh
node --test tests/*.test.mjs
```

## Exports

| Export | Contract |
| --- | --- |
| `createCustomCharacter`, `validateCharacter` | Authored name, high concept, trouble, one to three additional aspects and approaches 3/2/2/1/1/0. Validation returns `{valid, errors}`. Legacy templates remain only for compatibility tests. |
| `addStunt`, `removeStunt`, `renameCharacterAspects` | Preserve existing points, aspect identities and invocation grants; a spent session stunt cannot be removed during that session. |
| `createAspect`, `grantFreeInvoke` | Named aspects; free invocation tokens have stable ids and explicit authorized actor ids. |
| `roll4dF(rng)`, `createRoll(options, rng)` | Four independent draws in `[0,1)`; each maps to -1/0/+1. Pass RNG for deterministic replay/tests. |
| `resolveAction(options)` | Action-specific failure/tie/success/style effects, including separate create/discover/existing advantage modes. |
| `invokeAspect(options, rng)` | Atomic result `{character, roll, aspect, removeAspect}`. Costs/ledgers, paid once per aspect per roll, free stacking, rerolls, assistance, opposition, and boost consumption. |
| `absorbDamage(character, options)` | One stress box at most; any unused distinct consequences; attacker free invoke; explicit remaining shifts/taken-out outcome. |
| `endScene(character)` | Clear scene stress and taken-out flag; preserve consequences. |
| `beginSession(character, options)` | Monotonic stable session id/index; refresh to `max(points, refresh)` only once per new session. |
| `useSessionStunt(character, options)` | Once-per-session use tied to the active session id. |
| `resolveCompel(character, options)` | Accepted complication grants one point; declining costs one; proposal has no mutation path. |
| `applyMilestone(character, options)` | Single minor adjustment; significant approach increase; major refresh/high-concept/extra stunt options; +5 approach cap; duplicate milestone ids rejected. |
| `recoverConsequence(character, options)` | Explicit GM approval, fictional justification, and appropriate scene/session/scenario timing. |

All returned state must be committed together. For example, committing only an invocation's updated roll would fail to spend its Fate point or free token. Inputs are never mutated. Expected rule failures throw `FateRuleError` with a stable `code`.

## Small example

```js
import { createCustomCharacter, beginSession, createRoll, resolveAction } from '../lib/fate/domain.mjs';

let hero = createCustomCharacter({ id: 'hero-1', name: 'Your character',
  highConcept: 'Your concept', trouble: 'Your trouble', aspects: ['Your other aspect'],
  approaches: {careful:1, clever:2, flashy:0, forceful:1, quick:3, sneaky:2} });
hero = beginSession(hero, { sessionId: 'session-1', sessionIndex: 1 });
const roll = createRoll({ id: 'roll-1', character: hero, action: 'overcome',
  approach: 'quick', opposition: 2 }, () => 0.5);
const outcome = resolveAction({ action: roll.action, total: roll.total,
  opposition: roll.opposition });
```

Character schema version is 1. Approach/action ids are lowercase/camelCase as exported by `APPROACHES` and `ACTIONS`. `stress` is `[box1Used, box2Used, box3Used]`; values are booleans, not hit points. Character aspects contain high concept, trouble, and one to three other aspects. `refreshBase` starts at 3 and increases at major milestones; effective `refresh` subtracts one for each stunt beyond the first three. Fate points can exceed refresh.

Damage context is `{sceneId, sessionId, sessionIndex, scenarioId}`. A consequence records that context and uses a caller-provided `hitId` to build stable aspect/token ids. `stressBox` is either null or one number 1–3; the function rejects a `stressBoxes` list. Damage that is not fully absorbed marks the character taken out; it never silently invents consequences. The caller provides the fiction of being taken out.

An advantage result's `boost: true` instructs the caller to create a one-use boost. Its `freeInvokes` count describes a persistent aspect instead; a creation tie returns a boost and zero persistent-aspect free invokes. Opponent-benefiting failure requires explicit `failureChoice: 'opponentInvoke'`. An overcome failure can explicitly choose `failureChoice: 'succeedAtCost'`. GM narration supplies the cost.

## Integration responsibilities and limits

- The shared engine/API must authenticate roles, confirm character ownership, keep hidden aspects private, authorize targets, and supply canonical current state. `gmApproved: true` is a domain decision input, never proof of authorization.
- Apply transactions with a server-side expected revision and idempotency key. Local invocation ledgers catch same-roll token reuse, but they cannot stop stale state being submitted to two independent clients or rolls. Session, milestone, roll, hit, token, and actor ids must be stable and unique within their intended scope. Compel event deduplication belongs to the event store.
- Approach choice, aspect relevance, stunt conditions, costs, compels, concession fiction, and recovery remain human/GM decisions. `stuntBonus` is an explicitly approved aggregate modifier, not an automatic check of a stunt description. The module accepts integer modifiers; the caller decides which stunts apply.
- The optional default RNG is `Math.random`; inject an authoritative server RNG for shared rolls. Store individual dice with each event. This module does not claim secure, tamper-proof, or cryptographic rolling.
- Scene cleanup must separately expire scene aspects and unused boosts in the campaign state. `endScene` clears the character's scene state only. Taken-out narration may have persistent effects that belong in campaign state or consequences.
- Turn order, zones, inventory, migration and persistence live in the campaign adapter/kernel. Challenge/contest scoring, concession payout, a shared NPC Fate pool, and PvP delayed Fate-point transfer remain table rulings. `invokeAspect` returns spending/effects, not settlement of an opposing PC's later scene-end payment.
- Free invocation permissions are explicit. Grant allies permission through canonical campaign state before invoking. Invoking an owned aspect requires its current character-state copy; external aspects must likewise come from the canonical campaign state.
- `beginSession` cannot refill resources on reconnecting to the same session. Scene end, session end, and scenario end are separate explicit events. Approaches only need the starting rating distribution at character creation; advanced characters validate against the 0…5 range.
- Severe recovery uses the advancement chapter's additional qualification that the consequence span at least two sessions (`currentSessionIndex >= incurredSessionIndex + 1`), plus scenario end and GM-approved fictional recovery. This is deliberately explicit because the damage chapter's brief description mentions scenario end without repeating the two-session qualification. Moderate recovery similarly requires end of the next or a later session. Mild recovery needs scene end and rest. Milestones never silently erase consequences.

## Provenance and publication attribution

Rules checked against the official, Evil Hat-endorsed Fate SRD:

- [Character creation and approaches](https://fate-srd.com/fate-accelerated/who-do-you-want-be)
- [Actions and outcomes](https://fate-srd.com/fate-accelerated/how-do-stuff-outcomes-actions-and-approaches)
- [Aspects and Fate points](https://fate-srd.com/fate-accelerated/aspects-fate-points)
- [Damage and recovery](https://fate-srd.com/fate-accelerated/ouch-damage-stress-and-consequences)
- [Advancement and milestones](https://fate-srd.com/fate-accelerated/getting-better-doing-stuff-character-advancement)
- [Stunts](https://fate-srd.com/fate-accelerated/stunts)
- [Official licensing and downloadable assets](https://fate-srd.com/official-licensing-fate)
- [Required CC-BY attribution](https://fate-srd.com/official-licensing-fate/cc)

The original implementation and original template text adapt FAE mechanics; no font, logo, PDF, or website text asset was imported. Before publication, the parent application must include the exact Core/FAE attribution block prescribed on the licensing page, with all listed contributors and source/license links, at the same size as the rest of its copyright text. The relevant license is [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/). This module does not select a license for the parent repository's original code. Do not imply Evil Hat endorsement of the application. If later importing prose, use the official SRD download rather than copying the website's presentation text.

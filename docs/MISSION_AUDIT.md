# Corrected mission audit: human-authored campaign toolkit

Date: 2026-09-10. Status: requirements and acceptance correction during implementation. This document supersedes the previous adventure-oriented mission audit. It introduces no new test, browser, or deployment claim.

## 0. Decision

Fate After Hours, DCC/Lantern, and Yellow Call compress tabletop capabilities into a phone-friendly workspace that automates supported rules and bookkeeping for players and the GM/judge. They support human-authored campaigns. Release acceptance must establish authoring, functional automation, mobile use, shared design, and private table access.

## 1. Correction

The earlier audit misinterpreted the mission by treating structured branching, world facts, and a preset adventure ending as the next product goal. The user explicitly corrected that interpretation. Those recommendations are withdrawn. A built-in adventure, personality roster, automatic plot, or preset-story completion is not required.

If the earlier audit is retained, archive and label it historical. Its factual implementation/test receipts can remain useful, but its adventure-oriented priorities must not guide subsequent work.

The user's latest clarification also prevents an overly narrow interpretation as a note-taking toolbox. Mechanical automation remains central. Removing a mandated storyline does not remove calculated rolls, statistics, advancement, inventory, legal movement, or combat interactions from the mission.

## 2. Mission, vision, and users

**Mission:** compress tabletop capabilities into a phone-friendly workspace and automate mechanical/bookkeeping work for players and the GM/judge. The Melvor Idle analogy concerns bringing a broad system into manageable, short interactions.

**Vision:** privately play our own stories with friends online, with BG3-like convenience and freedom to lead our own campaign. Automatic rolls, statistics, leveling, inventory, movement, and combat interactions are UX references, adapted to each tabletop system's actual rules.

A GM brings or writes their material, prepares scenes/characters, controls visibility, and adjudicates the fiction. Players join, manage their permitted characters, roll/use system tools, and return to saved table state. Low-friction participation and automatic bookkeeping serve the humans running the game.

## 3. Product boundary

The toolkit supplies editable table state and system mechanics. Campaign content remains human-authored. New tables start blank with neutral structural defaults. Scene-library order has no story meaning; the GM selects the active scene. A field for GM-authored objectives is content, not an automatic mission engine.

Toolkit access is explicitly intended to be public. Campaign seats, campaign state and GM-only material remain private. This is the authorized access model; actual deployment still requires its own evidence.

## 4. Existing evidence

The prior implementation checkpoint had 65 passing Node tests: 29 domain, 20 adapter, 14 kernel, and 2 actual kernel/adapter integration tests. Its final TypeScript/build/package and publication succeeded. These are **historical checkpoint results**, not proof that the revised schema-2 authoring toolkit passes.

Earlier browser inspection observed entry, creation response, a return-link dialog, and GM Scene/Character navigation. Complete authenticated play in the HTTP-only managed preview was blocked by production Secure-cookie behavior. No complete friend playtest, independent keyboard/phone playthrough, or usable WebMCP runtime was established. No durable screenshot attachments were recovered. Revalidate revised behavior and record new receipts before making current-release claims.

## 5. Required table capabilities

The corrected baseline is blank creation; GM-editable scenes and free selection; zones/connections/movement; custom PCs with approaches/aspects; NPCs and unclaimed PCs; generic dice; Fate actions/invokes/stress/consequences/compels; a turn tracker; private/shared handouts; inventory/custom stunts; GM Fate-point adjustments; and persistence/backups. See TOOLKIT_CONTRACT for ownership and invariants. This is an acceptance list, not a passed-feature list.

Supported rules must calculate and apply changes rather than require duplicate manual arithmetic. Fate advancement follows milestones. Inventory weight/encumbrance belongs to each rules adapter; Fate Accelerated imposes no default encumbrance mechanic. Descriptive inventory fields do not prove carrying-rule automation.

## 6. Architecture

Retain separate kernel, system rules, authorized adapter, human-authored table state, and interface. The schema-2 integration retains active `scene`/`aspects` and adds a `scenes` library, `handouts`, and `conflict` state. Active and library copies must stay coherent without resetting live resources during ordinary edits.

The current Fate interface remains system-specific. A second adapter passing the same kernel/permission/portability contract is the evidence needed for shared architecture. Similar navigation or duplicated source alone is insufficient.

## 7. Main acceptance scenario

The GM creates a blank campaign, authors independently selectable scenes and a connected zone board, creates their own PC/NPC/unclaimed PC, and prepares private/shared handouts. A player joins and claims the intended PC, uses movement and dice/Fate controls, and observes turn state. The group pauses during an unresolved decision, reloads, and continues. A GM export/import restores the authored table and safely re-establishes ownership.

Use arbitrary material supplied by the tester. Do not require a particular setting, plot, outcome, or scene sequence.

## 8. Priorities and release gates

| Priority | Gate | Evidence required |
| --- | --- | --- |
| P0 | Author arbitrary table | Blank creation and editing/selection of user-authored scenes, zones, characters and handouts work through the UI. |
| P0 | Correct permissions | Direct player API attempts cannot mutate GM-only content/adjustments or retrieve private material, including inactive library entries. |
| P0 | Durable authoring and play | Reload/backup round trip preserves authored data, positions, tracker state, custom sheets and pending decisions without copying credentials. |
| P0 | Reliable mutations | Conflict, duplicate retry, changed replay and revocation retain the kernel's guarantees for the new authoring commands. |
| P0 | Mechanical automation | Supported dice/modifiers, outcomes, resource changes, advancement and movement/combat restrictions calculate and persist correctly; human decisions stay explicit. |
| P0 | Phone workspace | Both GM authoring/management and player action/resume work on a tested phone-sized touch viewport without desktop-only controls. |
| P1 | Shared design | Fate and a second adapter use the same navigation, ownership, save/conflict and recovery patterns with visible system-specific differences. |
| P1 | Real friend browser use | Public toolkit entry and separate private GM/player seats work over HTTPS; unaffiliated visitors cannot read campaign data. Keyboard results are separately recorded. |
| P1 | Shared implementation | Head auditor pins the contract and Fate plus another system adapter pass common conformance. |

## 9. Reuse and comparison

The prior primary-source scan remains a dated inventory of table platforms and open components, not a mandate to copy them. Its useful comparison dimensions are authoring, maps, sheets, ownership, dice, turn controls, materials, persistence and portability. No new research or comparator code integration occurred in this correction. Evaluate an existing component against the toolkit contract and its actual license before adoption.

## 10. Coordination

The shared hub remains canonical; Yellow Call is head auditor, Fate sub-auditor/Site owner, and DCC its system owner. Publish this mission correction to the hub, request acknowledgment, and record disjoint owned paths. The Fate owner is the sole Site writer. UI and adapter work may proceed in parallel against one agreed schema; new tests and deployment receipts belong to the actual resulting source.

## 11. Process integrity

The critical process failure was mission drift: implementation and research moved toward an authored adventure while the user wanted a toolkit. Correct it in README, shared coordination, acceptance criteria, UI copy and defaults, then test the revised goal directly. Do not reinterpret older metaphorical language to override the user's explicit correction.

The correction must preserve the clarified mission's breadth: a phone-friendly workspace with real rules automation for both players and the GM/judge. Maintain distinct mission and vision statements; do not replace either with a generic editable-notes goal.

Keep historical evidence labeled by revision. This documentation pass did not run new tests, write GitHub comments, change the Site, or validate a new deployment. Source inspection during drafting still included the earlier schema-1 implementation while schema-2 work was in progress. The integration owner must reconcile exact payloads/source status before treating this contract as a completed feature inventory.

## 12. Inference and robustness

The central requirement comes directly from the user, not an inference about player preferences. Expected benefits from shorter setup, consistent controls, or editable scenes remain hypotheses until observed. No measured time savings, enjoyment claim, effect size, or comparative usability ranking is supported.

A small real-table test can challenge those hypotheses: can the GM prepare and run their own material on a phone, can a player use calculated rules without manual duplicate bookkeeping or unauthorized edits, and can the group recover the saved table? Record assistance and failures. A meta-analysis or AMSTAR-style score would be inapplicable to this requirements/code audit.

## 13. Remaining uncertainties

Toolkit command coverage, migration of old backups, hidden scene/handout projection, referenced-object deletion, active-scene synchronization, mechanical calculations, phone operation, and deployed browser recovery need evidence from the revised source. Prior owner-private publication does not establish the newly authorized public toolkit audience. Any new release must record public entry and private campaign protection separately, with its actual audience and test limits.

## 14. Next handoff

Replace the active mission documents with this correction; archive earlier goal-setting if retained. Pin the accepted toolkit schema/commands, validate authoring/automation/permissions/persistence, and separately evaluate phone use and shared design. Perform the HTTPS public-entry/private-table scenario. Record exact source and publication receipts, then post them to the shared hub with acknowledgment status. Success is a functional phone-friendly workspace for our own human-run campaigns.

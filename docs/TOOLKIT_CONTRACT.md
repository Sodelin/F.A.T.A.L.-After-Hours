# Table toolkit contract

Status: corrected implementation baseline for the current toolkit work. This document specifies acceptance; it does not certify that every feature is implemented or deployed. Exact command names, payloads, limits, and migration behavior must be pinned to the accepted adapter source and its tests. The existing HTTP envelope remains defined by `API_CONTRACT.md`.

## Purpose and boundaries

**Mission:** compress tabletop capabilities into a phone-friendly workspace and automate mechanical/bookkeeping work for players and the GM/judge. The Melvor Idle analogy applies to breadth, convenience, and short interactions. Functional rules automation is part of this contract.

**Vision:** privately play our own human-authored stories with friends online, with BG3-like convenience and freedom to lead the campaign. Automatic rolls, statistics, leveling, inventory, movement, and combat interactions are UX references. Rules adapters implement the tabletop's actual mechanics, including Fate milestones rather than generic levels.

The toolkit lets a GM prepare and run arbitrary human-authored material with players. New campaigns contain neutral structural defaults only: no adventure text, required scene sequence, prewritten personalities, or automatic plot. The GM may write objectives and notes as ordinary content; the runtime does not require a narrative goal, route, branch, or ending.

Common infrastructure owns membership, storage, revision control, command receipts, backup envelopes, and the navigation framework. Each system adapter owns its sheet model, mechanical legality, authorized table operations, and projections. Humans own campaign content and fictional decisions. A map visualizes table space; it does not infer a story.

The application access target is public; individual tables remain private. The public entry screen must not enumerate other people's campaigns or expose campaign state. A valid seat is still required for reads and commands; role/ownership checks still protect GM material. Invitation/resume capabilities retain their distinct meanings. The release record must state whether public toolkit access has actually been deployed.

## Schema 2 integration shape

The Fate toolkit integration uses `schemaVersion: 2`. This is the agreed integration shape, not a claim that earlier schema-1 releases already provided it.

| State area | Meaning and invariant |
| --- | --- |
| `scenes` | GM-authored scene library. Stable IDs; presentation order has no progression meaning. |
| `scene` | Active scene retained for current UI/rules operations. Its identity must resolve consistently to the library. A neutral blank scene is allowed. |
| `aspects` | Live active-scene aspects, including mechanical invocation state. Editing descriptive scene content must not silently reset live invokes or resources. |
| `handouts` | GM-authored material with explicit private/shared visibility. Private content is omitted from player projections and exports. |
| `conflict` | Turn-tracker state associated with the table's conflict controls. Participant references and active position must remain valid. |
| Character and rules state | Owned/unclaimed PCs, NPCs, custom sheet data, inventory/stunts, Fate resources, pending actions/hits/compels and journal. |
| Campaign identity and membership | Remain in the kernel envelope and membership records. Authoring/import payloads cannot grant a role or recreate credentials. |

When active scene data appears both in the library and as a live snapshot, one adapter command must update the intended records atomically. Document which live resources persist when switching scenes. Do not permit ordinary scene text edits to clear stress, discard a pending roll, or duplicate free invokes. If the implementation cannot safely reconcile an edit affecting pending references, reject it with a clear recoverable error.

## Authoring and play baseline

| Capability | GM responsibility | Player responsibility and acceptance |
| --- | --- | --- |
| Blank campaign | Name the table and add their own material | Join without choosing a preset adventure or persona. |
| Scene library | Create/edit scenes, select any available scene, maintain private notes | Read only the active/shared material that the GM makes visible. Unpublished content must not leak through the library response. |
| Zone board | Add/edit zones and connections; place/control NPCs; adjudicate obstacles | See the board and move owned characters along legal routes when permitted. Provide a click/keyboard path, not drag-only interaction. |
| Custom characters | Create/edit permitted sheets, NPCs and unclaimed PCs; manage assignment | Create or claim a permitted PC and edit its allowed custom fields. Never mutate another player's sheet by changing an ID in a request. |
| Approaches/aspects | Apply system constraints and adjudicate changes when needed | Author a character without selecting a personality template; Fate approach/aspect legality remains adapter-owned. |
| Generic dice | Roll supported dice with server-validated bounds | Any permitted roller receives a stored result/receipt. Exact retries must not reroll; arbitrary expressions must not execute code. |
| Fate mechanics | Set opposition, adjudicate actions, recovery and advancement | Propose actions; invoke; absorb stress/consequences; accept or decline a compel under ownership checks. Pending decisions remain explicit. |
| Turn tracker | Choose participants/order and advance/end turns | See the current turn. Display order alone is not proof that every action is automatically restricted to that turn; enforcement must match documented rules. |
| Handouts | Author, edit, reveal or hide material | Read shared material only. Hiding prevents future delivery; it cannot erase content already seen by a player. |
| Inventory/custom stunts | Manage NPC data and adjudicate custom mechanics | Record permitted inventory/stunts on their own sheet. Free text is descriptive; only explicitly supported mechanics are automated. |
| Resource adjustments | Adjust Fate points within accepted bounds, with a reason and receipt | See acknowledged changes; no player request can acquire GM adjustment powers. |
| Persistence/backup | Full private export and independent restore | Reload owned/shared table state and export only the permitted projection. Restored ownership is reassigned explicitly. |

Inventory quantity, weight, carrying capacity and encumbrance are distinct concepts. Weight/encumbrance rules belong to the selected adapter; Fate Accelerated has no default encumbrance mechanic. A descriptive weight field must not silently reduce movement or apply penalties. If another ruleset defines carrying limits, its adapter calculates and explains those effects.

## Mechanical automation acceptance

| Area | Required observable behavior |
| --- | --- |
| Dice and statistics | The server generates permitted dice, applies validated modifiers/derived values, and stores the result once. The UI explains the calculation without requiring manual arithmetic. |
| Actions and combat | Supported actions calculate outcomes and legal damage/resource changes; pending invocations, costs, hits and compels remain explicit until resolved. Human fictional rulings remain with the table. |
| Advancement | The adapter validates and applies its own advancement changes. Fate milestones do not become an invented generic level system. |
| Inventory | Permitted quantity/data edits persist and validate bounds. Rules-defined carrying effects are computed only by an adapter that supports them. |
| Movement and turns | The adapter validates legal movement and supported conflict restrictions; the tracker presents the GM-controlled order. The UI distinguishes tracked order from any enforced turn rule. |
| Bookkeeping | Accepted actions update the relevant state and journal/receipt coherently. Reload and exact retries retain the result without duplicate spending, damage, advancement or adjustment. |

Mark unsupported custom mechanics as manual adjudication. Do not describe a text field, roll log or editable number alone as automation of the associated rule.

## API and permission baseline

Continue using the existing campaign endpoints and command envelope `{operationId, expectedRevision, type, payload}`. Toolkit authoring is expressed through adapter commands, not unrestricted client replacement of campaign state. Server-derived membership decides the actor and role. Type/payload validation and legal transitions run on the server even when controls are hidden or disabled.

Every mutation must participate in the existing atomic revision/receipt path. Reject stale revisions, retain draft input in the UI, and retry an ambiguous request with its original operation ID. Random results and GM resource adjustments are persisted once. Adapter operations must have no external side effects before their state commit.

Private projections must cover active and inactive scenes, GM notes, handouts, journal, character fields declared private, and command results. A hidden panel is not authorization. An unclaimed PC is a stored character with no player owner; accepting an unclaimed PC must atomically prevent a second claimant. NPC ownership remains GM-controlled. Capability/session secrets never appear in exports or authored data.

## Editing, deletion, and recovery invariants

- Reject dangling zone connections, unknown character/scene/participant references, duplicate IDs, and non-finite/out-of-range numeric values.
- Decide explicitly what happens to characters when a zone is removed or a scene is selected. Require relocation or reject the change; do not leave invisible or invalid tokens.
- Scene switching, participant deletion, and character edits must not erase unresolved hits, rolls, costs, or compels. Require explicit resolution/cancellation where necessary.
- Validate imported schema-2 scenes, live aspects, handouts, turn state, sheet extensions, and all nested fields using allow-lists. Imported material is untrusted.
- Preserve human-authored text and stable content identity across a valid round trip. Create new campaign/membership credentials, reset player ownership as documented, and require an explicit claim or GM assignment.
- Schema-1 backups require an explicit, tested migration or a clear unsupported-version response. Do not silently replace their saved material with blank or preset content.
- The GM retains a full private backup; players receive only safe exports. A published handout can be hidden prospectively, but prior copies remain outside server control.

## UI baseline

The start screen provides Create / Join / Resume/Import as appropriate and explains personal return links separately from player invitations. A successful create/join/import response must preserve its recovery secret even if the next fetch fails. Show connection failures separately from acknowledged save state.

Keep Scene / Character / Journal / Manage in the same order. Scene contains table play and GM authoring access; Character contains sheets, inventory and stunts; Journal contains notes and receipts; Manage contains membership, backups and sessions. Use GM labels that describe editing and table administration. Empty states should invite the user to add their own content. Product copy must not imply a built-in setting or story is required.

Provide labeled controls, visible keyboard focus, meaningful disabled-state explanations, accessible status updates, and workable small-screen layouts. WebMCP hooks are optional convenience; the interface must remain usable when the browser has no WebMCP support.

Phone acceptance covers the GM as well as players: create/edit scenes and zones, manage characters/turns, reveal a handout, roll/resolve a supported action, and resume a session on a narrow touch viewport. Controls must remain reachable and legible without horizontal page scrolling or hover-only interactions. Record the tested device/viewport and any blocked step rather than inferring phone usability from responsive CSS.

Shared-design acceptance compares purpose and behavior across systems: the same navigation order, role/ownership cues, save/retry states, return-link flow and basic authoring interactions. Fate, DCC and Yellow Call retain clearly labeled rules differences instead of silently assigning different meanings to the same control.

## Required conformance scenarios

1. Blank start: a new campaign has no imposed adventure or personality roster and allows the GM to author a table immediately.
2. Authoring: the GM creates two independently selectable scenes, zones/connections, a custom PC, NPC and unclaimed PC, private/shared handouts, inventory and a custom stunt. The acceptance test uses arbitrary user-supplied labels, not plot content.
3. Play: a player joins, claims the permitted PC, uses the zone board and dice, completes a supported Fate action with the GM, and sees the turn tracker and shared handout.
4. Isolation: player direct requests cannot alter GM-only authoring, other owners, or resource adjustments, and cannot retrieve private inactive scenes/notes/handouts through reads, command results, or export.
5. Durability: authored material, positions, turns, custom sheets and pending decisions survive refresh; export/import preserves the table while re-establishing ownership safely.
6. Conflict/replay: concurrent authoring changes conflict explicitly; exact retries do not repeat rolls or adjustments; altered replay is rejected.
7. Automation: verify the calculated roll, resource/cost/damage application, advancement change, supported inventory behavior and legal movement for the selected adapter; unresolved human choices must remain pending.
8. Mobile: complete both GM authoring and player play/resume on a phone-sized touch viewport. Record exact results independently of server tests and desktop/keyboard results.
9. Shared design: compare common navigation, authoring, permissions, save/conflict and recovery interactions across Fate and a second adapter; document expected rule differences.
10. Access/browser: complete the GM/player scenario over HTTPS with public toolkit entry and separate private campaign seats. A visitor without a seat cannot read campaign state or GM data. Record the actual deployed audience.

Run these against the revised source. Earlier version-1 test totals are historical evidence only. The shared kernel becomes a demonstrated cross-system baseline when Fate and a second adapter pass the agreed common scenarios; system-specific rules remain separate.

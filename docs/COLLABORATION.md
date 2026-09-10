# Shared tabletop toolkit collaboration

Canonical home: [shared campaign hub](https://github.com/Sodelin/websites-for-game-master-prototype-). Yellow Call is head auditor and integrator; Fate is sub-auditor and Fate Site owner; DCC owns Lantern. A posted handoff is not acknowledgment. Read current branches, issues, and ownership before changing shared files.

## Mission and vision

**Mission:** compress tabletop capabilities into a phone-friendly workspace and automate mechanical/bookkeeping work for players and the GM/judge. The Melvor Idle analogy describes convenient access to the breadth of the system. Dice, character statistics, advancement, inventory, movement, combat interactions, and persistence must function together.

**Vision:** privately play our own stories with friends online, with BG3-like convenience and freedom to remain the campaign leader. Its automatic rolls, stats, leveling, inventory, movement, and combat interactions are experience references; system adapters retain their own rules. Fate uses its own milestones and resources.

The GM controls scene selection, fictional developments, and adjudication. Players control their permitted characters and decisions. The application calculates supported rules and applies acknowledged state changes, reducing manual work for both roles.

Earlier recommendations to build automatic branching adventures or require completion of a preset story are superseded by the user's explicit correction. New campaigns start blank. Neither an authored plot nor a personality roster should be injected by default.

The toolkit access target is public. Campaign memberships, state and GM material remain private. Public application access must not expose a campaign directory, bypass a seat, or grant GM permissions. Record the deployed audience separately from this authorization.

## Shared experience

Create / Join / Resume lives on the entry screen. Keep the following destinations in this order across systems. Character is the common destination label; each system can use its appropriate sheet terminology inside it.

| Destination | Player | GM / judge / keeper |
| --- | --- | --- |
| Scene | Published active scene, permitted zone movement, dice/actions, visible turn state and handouts | Same shared table plus scene library/editor, board authoring, NPC control, turn management, and visibility controls |
| Character | Create/edit own permitted sheet, inventory, stunts, resources and pending decisions | Create NPCs/unclaimed PCs, manage ownership, adjudicate advancement/recovery and resource adjustments |
| Journal | Shared notes, visible rolls and receipts | Same chronology plus private notes and authoring/adjustment receipts |
| Manage | Personal return link and permitted export | Invitations, access revocation, full backup/import and session administration |

Show the campaign, member role, active character, and save/connection status consistently. Only acknowledged writes say saved. Keep pending drafts on conflict and reuse the original operation ID for uncertain retries. Server projections must exclude private material from every player response and export, including inactive scene-library entries and handouts.

## Ownership and parallel work

| Lane | Owned responsibility | Reviewable handoff |
| --- | --- | --- |
| Head auditor / shared integrator | Canonical API/schema decisions and adoption of shared kernel | Pinned source, accepted contract, two-adapter conformance status |
| Fate owner / sub-auditor | Fate adapter, toolkit UI/content editing, integration and sole Site publication | Source SHA, changed paths, rules boundaries, test/deployment evidence |
| DCC and Yellow system owners | Their system mechanics, sheet controls, and toolkit conformance | Adapter commits and explicit common-contract gaps |
| Delegated UI or validation agent | Only assigned disjoint paths or a bounded read/test scenario | Findings/patch with exact scope; no independent Site publication |

Claim paths and an acceptance scenario before concurrent editing. Do not silently replace another system's runtime or declare a second canonical standard. Fetch current work, preserve unrelated changes, and never overwrite another Site identity or force-push over its lane.

## Shared acceptance

1. A GM creates a blank campaign and authors their own scenes, connected zones, custom characters/NPCs, and private/shared handouts.
2. The GM chooses scenes freely from the library; no preset sequence or plot-completion state controls access.
3. Players join, own the intended characters, use their system's dice/actions and permitted movement, and see only authorized material.
4. Turn state, custom sheet data, materials, and pending decisions survive reload; a GM backup restores an independent table without copying credentials.
5. Concurrent edits, exact retries, altered replays, revocation, malformed imports, and role denials behave consistently across at least two adapters.
6. Mechanical automation calculates supported rolls/outcomes, applies legal resource changes, handles advancement and inventory according to the adapter, and validates movement/combat transitions. Explicit human rulings remain clear. Fate Accelerated has no default inventory-weight/encumbrance mechanic.
7. Phone use is its own gate: GM setup/editing and player play/resume remain operable with touch, readable controls, usable scrolling and no dependence on a desktop pointer.
8. Shared design is its own gate: repeat the same navigation, ownership, save/conflict, recovery and authoring scenarios across two adapters while preserving meaningful system differences.
9. An HTTPS GM/player browser scenario verifies public toolkit entry plus private campaign access. Keyboard review and mobile review are recorded separately from server tests and from each other.

## Handoff discipline

Read README, this document, TOOLKIT_CONTRACT, RELEASE, and live coordination issues. Report exact branch/commit, owned paths, schema versions, passed/failed/blocked checks, and audience/deployment state. Historical test and publication receipts retain their original scope. Publish only the tested source through the sole Site writer, then post receipts and acknowledgment status in the hub.

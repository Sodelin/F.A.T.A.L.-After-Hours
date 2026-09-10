# Shared campaign implementation and sub-audit

Canonical integration home: https://github.com/Sodelin/websites-for-game-master-prototype- . Yellow Call is head auditor; Fate is the sub-auditor and Fate Site owner; DCC owns Lantern.

Read the shared ownership record and issues before editing. Each lane reports its exact source commit and owned paths. A posted handoff is not an acknowledgment. Never overwrite another Site identity or a concurrent branch.

## Mission

Build a Melvor Idle equivalent for campaigns: fast setup, short/asynchronous sessions, automatic bookkeeping and durable consequences. Pause for player choices and GM rulings. Keep engine, system adapter, original campaign pack and interface separate.

## Common user flow

Create/join/resume live on the campaign start screen. All games should keep this navigation order:

| Destination | Player | GM |
| --- | --- | --- |
| Scene | Visible story, own token, proposed actions, pending decisions | Same scene plus opposition, reveals, scene/conflict controls |
| Character | Own legal sheet, resources, consequences | Same sheet plus NPCs, advancement and recovery rulings |
| Journal | Visible decisions, receipts, shared notes | Same chronology plus private notes |
| Manage | Own resume link, permitted export | Invitations, access revocation, backup and sessions |

Names, membership role and save state remain visible. Only server-acknowledged writes say saved. Conflicts retain drafts; uncertain retries keep the same operation ID. Player data is projected on the server, including exports and notes.

## Candidate reusable modules

`lib/campaign/api.mjs`: framework-neutral D1 kernel with injected adapter. `docs/API_CONTRACT.md` defines HTTP shapes. `lib/fate/domain.mjs`: pure Fate rules. `lib/fate/adapter.mjs`: authorized commands/projections and import normalization. `lib/fate/pack.mjs`: original story.

Fate and Yellow Call currently have separate hosted profiles. Cross-site campaign compatibility is NOT claimed until the head auditor consolidates schemas and tests at least two adapters against one contract.

## Acceptance and release record

Check create/join/character/action/consequence/resume; GM/player isolation; concurrent revisions; duplicate and altered replay; revoked and expired access; multiple campaign cookies; private export/player export; valid and malformed import; mobile/keyboard flows. Distinguish passed, failed and not run. Save exact commit, schema and deployment outcome in RELEASE.md.

## Continuation

1. Read README, this file, RELEASE and open GitHub coordination issues.
2. Fetch current branches; preserve unrelated edits.
3. Claim one branch and disjoint paths, with an acceptance scenario.
4. Test the real workflow once; fix specific remaining risks.
5. Publish only from the tested pushed Site commit.
6. Post source links and acknowledgment status in the shared hub.

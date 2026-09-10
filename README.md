# Fate After Hours

A fast, persistent Fate Accelerated campaign table: create or join, build a character in minutes, play a short scene, and return to the same campaign later. The larger mission is the Melvor Idle equivalent for tabletop campaigns: automate setup, rules bookkeeping and saved consequences while preserving player choices and GM rulings.

## Ownership and collaboration

This is the owning GitHub repository: https://github.com/Sodelin/F.A.T.A.L.-After-Hours .
The historical repository spelling does not change the rules system: this application uses Fate Accelerated, not F.A.T.A.L.

This Work lane is the **Fate implementation owner and cross-project sub-auditor**.
**The Yellow Call lane is head auditor** and shared integration coordinator: https://github.com/Sodelin/Yellow-Call/issues/1 .
The shared campaign home is https://github.com/Sodelin/websites-for-game-master-prototype- ; its head-auditor charter/implementation is pending verification.
All lanes should read and report through that shared home and the linked coordination issues before claiming shared paths.

Accepted target contract: [DCC cross-campaign proposal](https://github.com/Sodelin/DCC-Website/blob/bea3bb30a0d9d83a2212a02556e3d222c4a054ac/docs/CROSS_CAMPAIGN_WORKFLOW.md).
[Fate acknowledgment and current handoff](https://github.com/Sodelin/F.A.T.A.L.-After-Hours/issues/1).
[DCC implementation lane](https://github.com/Sodelin/DCC-Website).

The replaceable boundaries are campaign engine, system adapter, campaign pack, and site interface. Share membership/persistence/command contracts and consistent player/GM navigation. Rules and settings remain separate modules.

## Parallel work

One writer per Site and one owned path set per task. Use distinct branches/worktrees, report exact base/head revisions, and integrate through reviewable commits. Sub-agents currently cover Fate rules/domain logic and cross-project infrastructure/UX conformance. Shared engine/API files are not claimed by this lane while their active owner is being reconciled.

## Verified starting state — 2026-09-10

The registered Fate Site is appgprj_6a9c57d7283c8191a985542ccc71738c.
The Sites source remote has no refs and the project has no saved/published version. This repository was also empty on inspection. No recovered or newly deployed functionality is claimed yet.

## Acceptance

Create campaign → invite/join → create character → scene/zone/action → persisted consequence → close/rejoin.
Hosted state belongs in D1. The server enforces player/GM permissions and excludes hidden content from player responses. Commands require conflict detection and idempotency. Resume/export must preserve state without exporting credentials.
Record tests actually run and publish only a known source revision; a successful build alone does not establish multiplayer usability.

## Resume instructions

Read this README and issue #1, then inspect the shared head-auditor record, current branch/PRs and Site state. Preserve unrelated changes. Claim a bounded path set before writing. Check for a shared runtime revision before implementing an alternative. Update evidence and exact next action before handoff.

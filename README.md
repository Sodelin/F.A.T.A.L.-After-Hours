# Fate After Hours

[Open the private review release](https://fate-after-hours.sodelin.chatgpt.site) · [Release evidence](docs/RELEASE.md) · [Mission audit](docs/MISSION_AUDIT.md) · [Tool/reuse research](docs/RESEARCH.md)

A persistent Fate Accelerated campaign table for short sessions with friends. Create a campaign, invite players, choose a character, act in a scene, and return to the same saved consequences.

## Vision and mission

The vision is the Melvor Idle equivalent for tabletop campaigns: a focused, browser-based Baldur’s Gate Lite with quick entry, meaningful decisions, automatic bookkeeping, and durable progress. The mission is a repeatable Sites workflow with separate campaign engine, rules adapter, world pack, and interface. Human choices and GM rulings remain explicit.

Owning repository: https://github.com/Sodelin/F.A.T.A.L.-After-Hours . The historical spelling does not change the rules: this uses Fate Accelerated, not F.A.T.A.L.

## One collaboration home

**All three lanes must read and report through https://github.com/Sodelin/websites-for-game-master-prototype- .** Yellow Call is head auditor and shared integrator; this lane owns Fate and acts as sub-auditor; DCC owns Lantern. Shared implementation adoption needs exact commits and acknowledgment, not three independently declared standards.

- [Head-auditor coordination](https://github.com/Sodelin/Yellow-Call/issues/1)
- [Fate handoff](https://github.com/Sodelin/F.A.T.A.L.-After-Hours/issues/1)
- [Reviewable Fate source](https://github.com/Sodelin/F.A.T.A.L.-After-Hours/pull/2)
- [DCC contract](https://github.com/Sodelin/DCC-Website/blob/bea3bb30a0d9d83a2212a02556e3d222c4a054ac/docs/CROSS_CAMPAIGN_WORKFLOW.md)

Use one writer per Site, distinct branches/worktrees and disjoint sub-agent ownership. Save working source and remaining failures before prolonged research or handoff. Never force-push over another lane.

## What is implemented

D1-backed campaigns; hashed invitation and resume capabilities; HttpOnly per-campaign sessions; GM/player authorization and secret projections; atomic revision checks and idempotent commands; import/export without credentials. Scene / Character / Journal / Manage navigation stays consistent for both roles.

Fate supports templates, approaches, four dice, actions, invokes, stress, consequences, compels, advancement and recovery rulings. Last Train Home is an original three-scene urban-fantasy pack. It still requires a GM and does not claim a fully automated branching adventure. Detailed boundaries are visible at `/credits`.

| Boundary | Source |
| --- | --- |
| Campaign membership, persistence and commands | `lib/campaign/api.mjs` |
| Pure Fate rules | `lib/fate/domain.mjs` |
| Authorized Fate operations and import normalization | `lib/fate/adapter.mjs` |
| Original story and zones | `lib/fate/pack.mjs` |
| Current Fate interface | `app/table.tsx` |
| Durable database schema and migration | `db/schema.ts`, `drizzle/` |

The shared kernel is a candidate for head-auditor consolidation. Cross-game save compatibility is not claimed until two adapters pass one contract. The present interface still contains Fate-specific controls; it is not yet a fully extracted generic shell.

## Verify and continue

Read `AGENTS.md`, `docs/COLLABORATION.md`, `docs/RELEASE.md`, and the current shared GitHub issues before edits. See `docs/API_CONTRACT.md` and `docs/FATE_RULES.md` for contracts. Use the Sites skill for installation, build, source push and publication; runtime instructions are retained in `docs/RUNTIME.md`.

Run `node --test tests/*.test.mjs` for server/rules changes and `node node_modules/typescript/bin/tsc --noEmit` for interface checks. Test the actual create/join/action/consequence/resume journey. Record failed and not-run checks, source revision, and deployment separately. See the release record for current evidence rather than interpreting this README as a live-service guarantee.

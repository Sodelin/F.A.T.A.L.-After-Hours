---
title: "Fate After Hours: mission, architecture, and playability audit"
date: 2026-09-10
status: "published private release; verification limits recorded"
scope: "Current Fate implementation, shared campaign direction, and next iteration"
tags: [fate-after-hours, audit, architecture, playability, research]
---

# 0. Verdict

Fate After Hours now provides a persistent, GM-assisted Fate table: campaign creation, player membership, character ownership, proposed actions, saved rolls, consequences, private GM information, and backup recovery. This is a useful working foundation for the requested campaign experience. The larger mission remains incomplete: the original pack progresses through three linear scenes, meaningful story outcomes remain chiefly GM narration and journal text, and a second game system has not demonstrated the common architecture.

The private release was published successfully at [Fate After Hours](https://fate-after-hours.sodelin.chatgpt.site). Publication success establishes deployment, not a completed authenticated browser playthrough or friend access. The next product increment should make two player decisions visibly alter later scenes or an ending and preserve those effects through a return visit and backup restoration.

# 1. Scope and decision

This audit assesses mission fit, implementation boundaries, playability evidence, reusable infrastructure, and coordination. It combines direct source inspection with the integration owner's execution and deployment receipts. It does not certify security, full Fate coverage, accessibility conformance, or comparative usability.

Decision: continue from this release, with a small consequential campaign increment and an HTTPS friend playtest. Preserve the tested access and persistence behavior while the head auditor resolves the shared runtime. Do not replace the engine solely because another tool advertises more features; require a bounded compatibility demonstration.

# 2. Mission and success criteria

The user's target is a Melvor Idle-like compression of tabletop campaigning for friends: quick entry, understandable choices, automatic bookkeeping, durable consequences, and short sessions that can resume without reconstructing the entire table. GM judgment and player agency remain valid pauses in that loop. “Idle” does not require automating every fictional decision.

Mission completion requires more than sheets and dice. A player should understand the current objective, select or propose a meaningful action, understand its consequence, stop, and return to the next unresolved decision. Across DCC, Yellow Call, and Fate, Create / Join / Resume should lead to the same Scene / Character / Journal / Manage navigation. Rules-specific controls can differ while their purpose and placement remain recognizable.

# 3. Methods and evidence boundaries

Source inspection covered `app/table.tsx`, `app/globals.css`, `lib/campaign/api.mjs`, `lib/fate/domain.mjs`, `lib/fate/adapter.mjs`, `lib/fate/pack.mjs`, the actual kernel/adapter end-to-end tests, and runtime/collaboration/release documentation. Source and test definitions were inspected; the 65-test execution, current TypeScript result, browser observations, and deployment outcome below are supplied by the integration owner.

The companion [RESEARCH.md](RESEARCH.md) contains a bounded primary-source scan of six comparable tools, eleven substantive documentation pages, and three license checks, accessed 2026-09-10. Vendor capability descriptions are distinguished from measured experience. No human study, timing benchmark, head-to-head usability experiment, or systematic literature review was conducted.

# 4. Verification evidence

| Evidence | Result | What it establishes and what remains open |
| --- | --- | --- |
| Pure Fate domain tests | 29 passed | Includes all 81 possible four-die combinations and invoke/stress/recovery boundaries; does not establish complete tabletop rules coverage. |
| Authorized Fate adapter tests | 20 passed | Ownership, private information, import normalization, pending decisions, and outcome costs in tested cases. |
| Campaign kernel tests | 14 passed | Revisions, replay, transactions, access revocation, invitation behavior, and capacity in the test environment. |
| Actual kernel plus Fate adapter | 2 passed | Uses generated SQL migration and a local SQLite/D1-shaped harness: create/join/character/roll/finalize/reload/export/import/reclaim and title limits. This is stronger than adapter-only tests but is not a production browser or D1 run. |
| Total executed Node tests | **65 passed** | Integration-owner execution receipt; no additional tests are implied by this audit. |
| TypeScript and build | Current TypeScript and final build/package passed | Integration owner reports the final verification after interface corrections; publication subsequently succeeded. |
| Browser inspection | Entry form, successful creation response, personal return-link dialog, GM Scene and Character navigation observed | Screenshots inspected in session. No durable screenshot files were recovered. |
| Complete authenticated browser playthrough | **Blocked in managed preview** | HTTP-only preview could not retain production Secure cookies. The browser workflow was not completed; secure-cookie behavior was not weakened to make the preview pass. |
| WebMCP | Unavailable in current browser context | Optional status and navigation hooks exist in code; runtime use was not validated. Ordinary UI operation does not require them. |
| Mobile, keyboard, human usability | Partial source review; complete playtests not run | Responsive and control fixes are evidence of implementation, not proof of phone usability or accessibility conformance. |
| Publication | **Succeeded** | Exact source/version/deployment receipts appear in section 14. Friends' separate Site access list is not yet configured. |

# 5. Playability findings

The working loop is concrete: a player creates a quick character, sees a scene and zone position, proposes an action, and waits for the GM to set opposition and roll. The stored request supports invocations and later resolution. Compels remain negotiated. Pending hits require absorption or being taken out. Acknowledged state persists and can be reloaded or exported.

`Last Train Home` supplies three original scenes, connected zones, objectives, and private GM prompts. Its final scene suggests several fictional outcomes, but `scene.advance` increments a fixed scene index. The implementation has no structured branch conditions, durable world-fact registry, consequence-triggered route unlocks, or machine-readable ending resolution. The GM records those outcomes in the journal. The product can host a short guided session; autonomous or richly branching campaign play is not established.

Fate remains partly adjudicated: narrative relevance, opposition, some outcome choices, external opposition consequences, and eligibility for rest/recovery rely on GM judgment. That boundary should stay explicit in the interface and credits. Additional automation should preserve negotiated costs and unresolved choices instead of silently deciding them.

# 6. Architecture findings

| Layer | Current evidence | Consequence for reuse |
| --- | --- | --- |
| Campaign transport and persistence | `lib/campaign/api.mjs` injects an adapter; membership, capability recovery, revisions, receipts, and export envelopes are generic. | Strong candidate for common infrastructure, subject to canonical owner agreement and a second adapter. |
| Fate rules | `lib/fate/domain.mjs` holds pure mechanical operations. | Testable independently; Fate mechanics belong here rather than in a common DCC/Yellow rules layer. |
| Authorization and game transitions | `lib/fate/adapter.mjs` supplies initial state, projection, commands, and import validation. | Useful separation of server roles and game legality from transport. |
| Campaign content | `lib/fate/pack.mjs` holds the original scenes. | Separation exists, but pack schema and branch/world-state behavior remain tied to this implementation. |
| Interface | `app/table.tsx` implements common destinations with Fate-specific types and controls. | Common navigation is an agreed convention, not a demonstrated reusable cross-system component library. |

Cross-game save compatibility and plug-in replacement of systems are not established. A second adapter should reuse the same kernel tests before further extraction. Versioned pack content, live story state, and membership credentials should remain distinct: restoring a save must not grant old identities or silently substitute a different pack.

# 7. Interaction and recovery findings

The review produced specific fixes: create/join/import retain the full successful response and personal recovery secret before any refresh; connection failure no longer appears as an unqualified “Saved online”; small-screen entry precedes the introductory story; interactive text is at least 14 px and secondary labels at least 12 px; obvious pending-hit and duplicate-action invalid controls are disabled. Server validation remains authoritative.

The command client retains an operation ID when the outcome is uncertain, so retrying cannot create a new roll merely because a response was lost. Revision conflicts trigger a refreshed view and preserve the user's draft. Recovery links restore a seat and rotate its active session; an invitation and a personal return link have different meanings and should remain clearly labeled.

Next, the resumed Scene should explicitly answer: “Where am I?”, “What changed?”, and “Whose decision is pending?” Current saved data enables this, but a clear return summary has not been validated with players. Keep Scene / Character / Journal / Manage order, keyboard access, focus visibility, and accessible status messages consistent. These are requirements supported by [WCAG 2.2](https://www.w3.org/TR/WCAG22/), not a claim that this release conforms to the full standard.

# 8. Comparable tools and reuse choices

The detailed evidence and license receipts are in [RESEARCH.md](RESEARCH.md). No comparator code was integrated during this work.

| Comparator | Supported lesson | Decision for this project |
| --- | --- | --- |
| [Fari](https://fari.app/) and [historical source](https://github.com/farirpgs/fari-app) | Current landing offers legacy export/replacement information; historical repository is AGPLv3. A working current shared table was not verified. | Recover and test an exact version before selecting it as a runtime or import target. |
| [Foundry FAQ](https://foundryvtt.com/article/faq/) and [Fate Core Official](https://github.com/Sk1mble/fate-core-official/blob/main/README.md) | Browser player/GM platform; Fate module documents presets, tracks, scene aspects, and refresh accounting. Platform, GPLv3 module code, and CC BY content have separate licensing. | Use as a Fate feature checklist; no assumption of portable saves or Worker compatibility. |
| [Owlbear rooms](https://docs.owlbear.rodeo/docs/rooms/) and [permissions](https://docs.owlbear.rodeo/docs/permissions/) | Link entry, anonymous player participation, GM approval, and ownership controls are documented. | Compare onboarding and reassignment. Its MIT SDK licenses the SDK, not the whole hosted platform. |
| [Roll20](https://roll20.net/) | Integrated maps, sheets, dice/macros, invitations, and campaign organization. | Use a single-action bookkeeping comparison; no reusable platform license or portable export was established in the retained page. |
| [Alchemy](https://alchemyrpg.com/) | Scene-oriented presentation and a system builder. | Put the current situation before configuration; use original assets. Fate automation and portable state were not verified. |
| [boardgame.io](https://github.com/boardgameio/boardgame.io) | MIT game engine with moves, phases, multiplayer, state management, logs, and view-independent integration. | Run an isolated adapter/auth/reconnect/concurrency/deployment spike before any engine migration. |

# 9. Next-iteration acceptance

| Priority | Deliverable | Concrete acceptance |
| --- | --- | --- |
| P0 | Real HTTPS friend workflow | With Site access configured for intended friends, separate GM/player browsers create/join, create a character, propose/roll/resolve, reload, and resume. The player never receives private GM notes. Record passed/failed/blocked per step. |
| P0 | Consequential story slice | At least two explicit decisions change later available content or the ending. Their facts and pending choices survive reload and GM export/import; a GM can still adjudicate an unlisted action. |
| P0 | Return-to-play view | A returning player can identify their character, current objective, last meaningful change, and pending decision owner from the interface. Verify by observed explanation, not an invented time target. |
| P1 | Shared-runtime proof | Head auditor pins the common kernel/contract; Fate and one second adapter pass the same membership, private projection, conflict, retry, revocation, and import conformance scenarios. |
| P1 | Pack/live-state contract | Pack identity/version, scene IDs, choices, conditions, effects, and ending IDs are separate from current world facts and membership. Unsupported versions fail clearly; restored PCs require explicit ownership assignment. |
| P1 | Usability and accessibility check | Complete the same join/action/pause/resume scenario by keyboard and a small-screen browser. Record assistance and failure points; preserve a non-drag movement path and announced status changes. |
| P2 | Reuse experiment | boardgame.io spike runs the same core scenario and deployment target. Compare implementation burden and failed cases before deciding whether to adopt it. |

Documentation drift identified during this audit was corrected by the integration owner: `docs/API_CONTRACT.md` now aligns its title limit and paths with the runtime and real integration tests. The supported title limit is 100 characters. All 65 server/rules tests passed against the released engine and adapter; final interface changes passed TypeScript and build/package gates.

# 10. Coordinated owner lanes

The canonical integration home remains [the shared campaign hub](https://github.com/Sodelin/websites-for-game-master-prototype-). The current collaboration document names Yellow Call as head auditor, Fate as sub-auditor and Fate Site owner, and DCC as Lantern owner. These are documented roles; this audit does not imply that every other work account has acknowledged the latest handoff.

| Lane | Bounded ownership | Handoff required |
| --- | --- | --- |
| Yellow Call / head auditor | Canonical contracts, shared runtime selection, schema/version policy, cross-system acceptance | Exact branch/commit and owned paths; acknowledge Fate and DCC proposals before consolidation. |
| Fate owner / sub-auditor | Fate rules adapter, original pack, Fate interface and deployment, adapter conformance | Release source, passed and blocked tests, changes requested of common interfaces. |
| DCC owner | DCC rules and content plus the second-adapter trial against the agreed contract | Exact adapter commit and conformance failures without silently forking common behavior. |
| Separately claimed experience lane | Common navigation/status/return-view specification and focused accessibility checks | Shared scenarios and permitted role differences; implementation ownership explicitly assigned before editing. |
| Separately claimed validation lane | HTTPS multi-seat workflow, portability and observed playtest evidence | Reproducible receipts and unresolved findings; sole Site writer remains the Site owner. |

Parallelize disjoint paths and test scenarios. An issue comment or handoff is not proof another account read it. Each lane should read current ownership, claim a branch and acceptance scenario, report source receipts, and wait for an acknowledgment only where integration depends on another owner. Proposed lanes are not evidence that workers have already accepted them.

# 11. Process integrity

Strengths: concrete implementation and deployment receipts, a real kernel/adapter test rather than only isolated mocks, explicit failed/blocked/not-run distinctions, separation of vendor facts from recommendations, and preserved ownership boundaries. Browser findings caused targeted recovery and save-state fixes before release.

Limitations: the implementation owner supplies execution evidence; this sub-audit inspected source and tests but did not independently rerun the entire release. Shared-account acknowledgment is not demonstrated. Browser screenshots were inspected but not durably transferred. No human playtest or final authenticated browser end-to-end result exists yet.

Process judgment: adequate for a reversible private review release; incomplete for declaring the mission finished or the architecture proven across three systems. A numerical quality score would imply unsupported precision. AMSTAR-2, a systematic-review appraisal instrument, is not applicable to this source/code/product audit. The next improvement is the HTTPS friend scenario and second-adapter conformance, not more unbounded feature searching.

# 12. Robustness and residual risks

The tested design uses server-derived roles, player projections, hashed capabilities, Secure HttpOnly session cookies, same-origin writes, revision checks, idempotent receipts, and atomic commits. Import normalizes allowed fields, creates a separate campaign, and resets player ownership. Pending rolls and hits constrain later actions; agreed costs require a recorded resolution note. These controls support the tested guarantees; they do not constitute a penetration test or proof of every possible imported-state invariant.

Most consequential remaining uncertainties are operational and product-level: production cookie recovery with separate real browsers; friends' Site access; deployed D1 behavior beyond the local harness; a second rules adapter; and whether players can resume without GM explanation. No quantitative pooled effect, usability ranking, or causal improvement estimate is available. The researched tools are structurally different, so adding feature counts would not resolve those questions.

The recommendation would change if a tested open engine preserves the same ownership/recovery/concurrency guarantees with materially less custom maintenance, or if a playtest shows an existing tool serves these friends better. Existing code is not a reason to ignore that evidence. Conversely, a passing HTTP API test should not be promoted into a claim of a successful browser session.

# 13. References and knowledge continuity

Retain [RESEARCH.md](RESEARCH.md) alongside this audit for dated primary sources and license receipts. Link both from the shared architecture decision and the Fate release record. Keep documentation separate from copyrighted campaign books; the current three-scene pack is original content.

For Zotero or Obsidian continuation, use tags `project:fate-after-hours`, `evidence:primary`, and the relevant architecture/interaction/licensing topic. Preserve software repository and license links together, with access dates and version receipts where available. No Zotero records or external knowledge-base entries were created by this audit.

Implementation source: [GitHub release checkpoint](https://github.com/Sodelin/F.A.T.A.L.-After-Hours/tree/63bf8bd86ab9d85c8c080357fe1ff6e6784793c8), [PR 2](https://github.com/Sodelin/F.A.T.A.L.-After-Hours/pull/2). Coordination: [Fate issue 1](https://github.com/Sodelin/F.A.T.A.L.-After-Hours/issues/1), [Yellow Call issue 1](https://github.com/Sodelin/Yellow-Call/issues/1). Live issue acknowledgment was not re-audited in this final documentation pass.

# 14. Release receipts and next handoff

| Receipt | Recorded value |
| --- | --- |
| Hosted release | https://fate-after-hours.sodelin.chatgpt.site |
| GitHub implementation source | `63bf8bd86ab9d85c8c080357fe1ff6e6784793c8` — PR 2 |
| Site source | `4449fdebe71df6ec1bc3ef7231b2716d3222fd4d` |
| Saved version | Version 1; `appgprj_6a9c57d7283c8191a985542ccc71738c~appgver_d8aae59ad564819184ca69321ff8f92a` |
| Deployment | `appgdep_6aa20247b5a88191a966cc646643e615` |
| Deployment result/time | Succeeded, `2026-09-10T01:05:42Z`, integration-owner receipt |
| Audience | Existing owner-private Site audience; friends' Site allowlist not configured |
| Remaining browser gate | Complete authenticated GM/player playthrough over HTTPS |

This audit is retained with the source and release documentation; the publication receipts have been posted to the shared handoff. The shared hub was refreshed at commit `6ac793d418cb436d7cd414a1ad7894116a1dd108`, according to the integration owner; a hub update alone does not prove another work account has acknowledged it. Campaign invitations grant an application seat; they do not grant access through the separate private Site gate. Configure intended friends' Site access before treating invitations as a usable friend onboarding flow. Do not attach or link screenshots that were not durably recovered.

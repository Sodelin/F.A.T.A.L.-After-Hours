# Release evidence — 2026-09-10

Status: ready for first private review deployment; production result will be recorded by a follow-up documentation commit.

## Source and identity

Registered Site: appgprj_6a9c57d7283c8191a985542ccc71738c. Original source remote had no refs or saved versions. Complete GitHub implementation checkpoint: d2b6752ff1ed9b731ea54d13b10c49836abe4b31, PR #2. This release includes subsequent audited interface fixes. The exact release source SHA is recorded in the GitHub handoff and saved Sites version.

## Verification

| Check | Result and limit |
| --- | --- |
| Domain rules | 29 tests passed, including all81 four-die outcomes, invoke/stress/recovery boundaries |
| Fate authorized adapter | 20 tests passed, including ownership, hidden notes, import sanitization, pending decisions and costs |
| Kernel and migration | 14 tests passed, including atomic CAS/idempotency, revocation, invitation rotation and capacity |
| Actual kernel + Fate adapter | 2 end-to-end server tests passed using generated migration: create/join/character/roll/finalize/save/reload/export/import/reclaim and title limits |
| TypeScript | Passed after final interface corrections |
| Production build | Initial build passed; final source build is a required publication gate |
| Browser | Entry form, creation response, private return-link dialog, GM scene and character navigation observed; lobby and GM scene screenshots inspected |
| Authenticated browser playthrough | Blocked: supervised preview is HTTP-only and cannot retain production Secure __Host cookies. No production-cookie weakening added. Server workflow tests do not substitute for this browser result |
| Mobile/keyboard | Responsive source and primitives reviewed; no independent phone or complete keyboard-only playthrough completed |
| WebMCP | Optional status/read and navigation tools implemented; current browser reports modelContext unavailable, so runtime validation unavailable |
| Human usability | Not run; no invented completion times, enjoyment or comparative rankings |

The browser review revealed that a follow-up read failure could hide a successful creation and its return link. Create/join/import now immediately use the acknowledged server response. Connection failure no longer displays an unqualified live-save status. Invalid movement during conflict and duplicate/pending-damage proposals are disabled. Control typography is at least14px; secondary labels at least12px; small-screen entry precedes the introductory story.

Screenshot bytes were inspected in the browser session, but transfer did not yield durable files; no screenshot attachment is claimed.

## Audience and product limits

Publication uses the existing owner-private Site audience. A campaign invitation grants an in-application player seat; it does not add a viewer to the separate Sites access list. Friends need Sites access before the private invitation can work. No broader audience was selected or configured.

This is a GM-assisted Fate table, not a fully automated branching campaign. The original Last Train Home pack contains three linear scenes. Fictional outcomes and endings use GM rulings/journal entries; durable story flags and branch conditions are future work. Detailed mechanics boundaries and attribution are at `/credits`.

The generic kernel is a shared integration candidate. Yellow Call owns canonical consolidation; no cross-game save compatibility or tested second adapter is claimed. See docs/RESEARCH.md for primary-source reuse evidence and docs/COLLABORATION.md for ownership.

## Next release acceptance

1. Head auditor acknowledges/pins one common runtime and assigns conformance work across two adapters.
2. Add a versioned world-fact/choice layer: two decisions change a later scene or ending and survive export/import.
3. Review release in a real HTTPS browser with GM and friend seats; verify return links, private projections and pending rolls across reload.
4. Run one small-group playtest: identify where participants need help, then reduce those steps. Measure actual behavior only.

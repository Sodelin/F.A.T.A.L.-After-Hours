# Toolkit overhaul — 2026-09-10

The current release replaces seeded adventure creation with a blank campaign toolkit. Mission: compress tabletop capabilities into a phone-friendly workspace and automate mechanical bookkeeping for players and GM/judge. Vision: privately play our own stories with friends, with BG3-like convenience and human campaign leadership.

## Implemented

- Authored FAE character builder; editable aspects, inventory and stunts; GM Fate-point adjustments, advancement, recovery and compels.
- Empty campaign creation; arbitrary scene library, private GM preparation, editable connected zones with map backgrounds, shared/private handouts and journal.
- Server dice, action proposals, opposition, invokes, advantage creation/discovery/exploitation, optional costs and style trades, attack damage, legal stress/consequence absorption, conflict order and rounds.
- D1 persistence, invite/return links, server role projections, exact retry receipts, revision conflict protection, exports/imports and legacy-save migration.

## Verification for this overhaul

**99 automated tests pass, zero failures/skips.** Includes rules, the retained mechanics regressions, new custom character/stunt/action modes, actual API + generated SQLite/D1 migration integration, schema-2 tools, private projections, recovery and legacy preservation. Existing migration SQL was not modified.

TypeScript and the standard Sites production build pass. The production JavaScript contains Secure/HttpOnly/SameSite=Strict campaign cookies and excludes the development request/cookie helpers. The development-only reflow route returns 404 in production; it grants no permissions and changes no campaign rules.

Actual managed-browser play-test used the real API/local D1 through normal UI controls:

1. Created a fresh campaign: empty roster, neutral scene, no authored adventure.
2. GM authored an Observatory test scene, private GM note, two connected zones, a custom NPC and a shared handout.
3. A separate player seat joined by invitation and created a custom sheet. Its view excluded GM notes and authoring controls.
4. Player moved to the connected roof and proposed an action; GM rolled against chosen opposition and applied the calculated outcome.
5. GM ran an NPC attack; it produced one pending damage shift. The player absorbed it with stress box 1. The spent box persisted after return-link recovery, reload and reopening the saved table.
6. Utility dice produced a journal-backed result; the player saw the shared handout and common history.
7. In a 390px iframe (373px usable content width), the actual player UI saved a journal note and GM UI created a draft scene. Both measured scrollWidth equal to clientWidth. This is browser reflow/interaction evidence, not a physical-phone or touch-device test. One later cropped screenshot attempt timed out; the preceding screenshot and DOM measurements succeeded.

Browser testing found and fixed request-constructor compatibility in local development, unavailable randomUUID on HTTP by using cryptographic random bytes for operation IDs, and a misleading optional builder-field label. Kernel authorization remained active throughout. The local HTTP transport is compile-time development-only and exact-host gated; production removes it.

The test browser shares one cookie jar across tabs. GM/player roles were exercised sequentially with separate seats and real return-link recovery; this is not simultaneous two-device or live friend play-testing. Automated API tests cover independently authenticated clients, stale revisions, retries and revoked seats. Production hosted-Sites access/deployment confirmation is recorded separately below.

## Limits and collaboration

Maps are connected zones with optional HTTPS image backgrounds, not a tactical grid/pathfinder, fog of war or procedural encounter generator. Inventory stores names, quantities and notes; FAE has no default weight calculation. Group rulings still decide approach fit, stunt applicability, opposition, costs, concessions and recovery. Ruleset import/export is supported through campaign backups, not arbitrary external character-sheet formats.

Shared navigation and a capability parity contract are posted to the hub, Yellow Call and DCC. Source and tests are reusable candidates; cross-site runtime/design parity and adoption by the other accounts are not verified. See PARITY.md. No fictional QA material is seeded into new production campaigns.

## Publication

Version 2 is published successfully at https://fate-after-hours.sodelin.chatgpt.site with public Site access (access revision 2). Campaigns remain private to capability-authorized seats; public entry does not list or expose other people's campaigns.

- Runtime source: `39fd74e6cf854b1f8599c4e8e75ee0d426b819aa`
- Saved version: `appgprj_6a9c57d7283c8191a985542ccc71738c~appgver_137539dcf82481918d66b1f7524376a2`
- Deployment: `appgdep_6aa20d59c7988191b7a6c1a76b83ca8a`, succeeded 2026-09-10T01:52:47.635965+00:00
- Packaged archive SHA-256: `053774ecc0d49d0c2cef5d8e0f9018ab8a6efdabe4d57ac32b7d152d445200bb`
- Owning review: https://github.com/Sodelin/F.A.T.A.L.-After-Hours/pull/3

This publication record is a documentation-only update after the runtime build. Deployment success and public audience were confirmed through Sites; the detailed browser journeys above ran against the managed local preview, not the production URL.

---

## Historical release record (superseded)

# Release evidence — 2026-09-10

Status: **version 1 successfully published** on 2026-09-10 at 01:05:42 UTC.

- Review URL: https://fate-after-hours.sodelin.chatgpt.site
- Audience: existing owner-private access.
- Published Sites source: `4449fdebe71df6ec1bc3ef7231b2716d3222fd4d`.
- Equivalent application source in GitHub: `63bf8bd86ab9d85c8c080357fe1ff6e6784793c8` (PR 2).
- Saved version: `appgprj_6a9c57d7283c8191a985542ccc71738c~appgver_d8aae59ad564819184ca69321ff8f92a`.
- Successful deployment: `appgdep_6aa20247b5a88191a966cc646643e615`.
- Packaged artifact SHA256: `737a8ec94a92ba4c40a2558ed59a919b952506e19d3e9e3320cfba83107a86ae`.

This documentation update records the published revision. It does not claim a new runtime deployment.

## Source and identity

Registered Site: appgprj_6a9c57d7283c8191a985542ccc71738c. Original source remote had no refs or saved versions. Complete GitHub implementation checkpoint: d2b6752ff1ed9b731ea54d13b10c49836abe4b31, PR #2. This release includes subsequent audited interface fixes. The exact release source SHA is recorded in the GitHub handoff and saved Sites version.

## Verification

| Check | Result and limit |
| --- | --- |
| Domain rules | 29 tests passed, including all 81 four-die outcomes, invoke/stress/recovery boundaries |
| Fate authorized adapter | 20 tests passed, including ownership, hidden notes, import sanitization, pending decisions and costs |
| Kernel and migration | 14 tests passed, including atomic CAS/idempotency, revocation, invitation rotation and capacity |
| Actual kernel + Fate adapter | 2 end-to-end server tests passed using generated migration: create/join/character/roll/finalize/save/reload/export/import/reclaim and title limits |
| TypeScript | Passed after final interface corrections |
| Production build | Final production build and archive packaging passed; default Worker fetch entrypoint present |
| Browser | Entry form, creation response, private return-link dialog, GM scene and character navigation observed; lobby and GM scene screenshots inspected |
| Authenticated browser playthrough | Blocked: supervised preview is HTTP-only and cannot retain production Secure __Host cookies. No production-cookie weakening added. Server workflow tests do not substitute for this browser result |
| Mobile/keyboard | Responsive source and primitives reviewed; no independent phone or complete keyboard-only playthrough completed |
| WebMCP | Optional status/read and navigation tools implemented; current browser reports modelContext unavailable, so runtime validation unavailable |
| Human usability | Not run; no invented completion times, enjoyment or comparative rankings |

The browser review revealed that a follow-up read failure could hide a successful creation and its return link. Create/join/import now immediately use the acknowledged server response. Connection failure no longer displays an unqualified live-save status. Invalid movement during conflict and duplicate/pending-damage proposals are disabled. Control typography is at least 14px; secondary labels at least 12px; small-screen entry precedes the introductory story.

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

# Campaign kernel contract

Import `handleCampaignRequest` from `lib/campaign/api.mjs` and call it for `/api/campaigns`, `/api/campaigns/*`, and `/api/import`. Pass the native D1 database binding, not a Drizzle query builder. `db/schema.ts` defines the logical schema; checked-in `drizzle/*.sql` migrations are the deployment authority. Every D1 prepared statement contains one SQL statement. Multi-statement changes use D1's atomic `batch()`.

The adapter supplies these asynchronous or synchronous methods:

- `initialState({title})` returns a JSON object for a new campaign.
- `project(state, member)` returns state safe for that member. A member contains server-derived `{id,name,role}` and no capabilities.
- `command(state, member, type, payload)` returns `{state,result}` or throws. Domain errors preserve explicit status 400, 403, 404, or 409; other command rejections return 400. Domain ownership, legal transitions, rule calculations, and random rolls belong here. Never include membership credentials or GM-only information in player command results.
- Optional `validateImport(state)` returns a normalized, validated JSON object or throws. Import is unavailable without it. Treat imported content as untrusted.

The `campaigns.state` database column stores an internal `{title,state}` envelope. The adapter only receives the inner state. JSON state size is limited to 2 MiB; request bodies to 3 MiB; command payloads to 64 KiB. Name/title limits are 80/100 characters (character names and the current UI use a 60-character limit). Campaigns allow at most 32 active members including the GM; the join SQL checks capacity at commit. Listing checks at most 40 session cookies. Unknown JSON fields never define an actor or grant permissions.

POST requests need `Content-Type: application/json` and an `Origin` matching the request origin. Browser same-origin fetches provide Origin automatically. Use `credentials: 'same-origin'`. Every response disables caching. API query strings are rejected, so capabilities must travel in request bodies. UI can offer copyable `{campaignId,secret}` access codes; never add secrets to URL query strings or path segments.

| Route | Request | Response |
| --- | --- | --- |
| POST `/api/campaigns` | `{title,name}` | Campaign view plus `resumeSecret`; sets GM session cookie |
| GET `/api/campaigns` | Cookies | `{campaigns:[{id,title,revision,member}]}` |
| GET `/api/campaigns/:id` | Campaign cookie | `{campaign:{id,title,revision,state},member,members}` |
| POST `/:id/invite` | `{}`; GM cookie | `{secret,expiresAt}`; expires in seven days and atomically invalidates prior campaign invitations |
| POST `/:id/join` | `{secret,name}` | Player campaign view plus `resumeSecret`; sets session cookie |
| POST `/:id/resume` | `{secret}` | Campaign view; sets a fresh session cookie |
| POST `/:id/resume-link` | `{}`; own cookie | `{secret}`; invalidates previous resume capability |
| POST `/:id/revoke` | `{memberId}`; GM cookie | `{revoked:memberId}`; atomically revokes player session, resume capability, and campaign invitations |
| POST `/:id/commands` | `{operationId,expectedRevision,type,payload}` | `{operationId,revision,result}` |
| GET `/:id/export` | Campaign cookie | `{format:'campaign-backup-v1',access:'gm'|'player',campaign:{title,revision,state}}` |
| POST `/api/import` | `{name,title?,backup}` | New campaign view plus new GM `resumeSecret` |

The abbreviated `/:id/*` rows use the `/api/campaigns` prefix. Invitations are reusable until expiry, invitation rotation, or player revocation. After removing a player, the GM must generate and share a fresh invitation with intended recipients. A membership has one active session hash: resuming replaces its previous browser session. Resume capabilities remain valid until rotated or revoked. GM backup imports create a new independent campaign at revision 0 with one new GM; player projected exports are not importable. Exported data has no session or resume credentials.

Commands are member-scoped and idempotent. Retrying the exact request returns its original receipt and never reruns the adapter. Reusing an operation ID with changed revision/type/payload returns 409. Canonical key ordering prevents object-key order from changing content identity. Distinct requests based on a stale revision return 409. After success, reload the campaign view; after conflict, reload before presenting a new attempt with a new operation ID. Never automatically reroll after an ambiguous response: retry the original request.

The atomic commit checks both expected campaign revision and the actor's still-active session. A random commit token connects the state update to receipt insertion in the same transaction. Concurrent speculative adapter calls can occur, but only one outcome commits; losing rolls have no durable effect. Adapter code must not perform external side effects, since discarded speculative calls cannot roll those back.

Verification: `node --test tests/kernel.test.mjs tests/e2e.test.mjs` (Node 24; uses `node:sqlite`). Tests cover session restore, projection, actor spoofing, role denials, revision conflict, replay without reroll, concurrent duplicate/different commands, revocation during command execution, export/import, resume rotation, origin rejection, and atomic transaction rollback. This SQLite wrapper validates transaction semantics locally; complete authenticated browser playthrough in the deployed HTTPS environment remains unverified.

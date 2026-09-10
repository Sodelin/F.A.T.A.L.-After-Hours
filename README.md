# Fate After Hours

[Open the site](https://fate-after-hours.sodelin.chatgpt.site) · [Release evidence](docs/RELEASE.md) · [Toolkit contract](docs/TOOLKIT_CONTRACT.md) · [Mission audit](docs/MISSION_AUDIT.md)

Fate After Hours is a phone-friendly campaign workspace for **human-authored Fate campaigns**. It calculates supported mechanics and keeps table state synchronized for players and the GM, who retains control of the campaign.

## Mission

Compress tabletop capabilities into one phone-friendly workspace and automate mechanical and bookkeeping work for players and the GM/judge. The Melvor Idle analogy is about making a broad system manageable in short interactions: dice, stats, advancement, inventory, movement, combat interactions, and saving should work together. Functional rules automation is central.

## Vision

Privately play our own stories with friends online, with the convenience associated with Baldur's Gate 3 and the freedom to lead our own campaign. Its rolls, statistics, leveling, inventory, movement, and combat interactions are UX references. Each tabletop adapter implements its own rules; Fate advancement uses milestones rather than importing a level system.

Create a blank campaign, prepare your own scenes and characters, invite players, run the session, and return to the saved table. Story content and fictional decisions belong to the people playing. There is no required adventure, preset personality roster, or automated plot progression.

The toolkit is intended to be publicly accessible. Individual campaign seats, campaign state, and GM-only material remain private and permission-controlled. Public access to the application never grants access to someone else's table. The release record states the audience actually deployed.

## Toolkit baseline

The current implementation work targets:

- GM-authored scenes in an unordered library, with direct scene selection and editable zone boards.
- Custom characters and approaches/aspects, NPCs, unclaimed PCs, inventory, and custom stunts.
- Generic dice plus Fate actions, invokes, stress, consequences, compels, and GM resource adjustments.
- Calculated rule outcomes and resource changes, legal movement, and system-appropriate advancement with explicit GM rulings where needed.
- A GM-controlled turn tracker, private/shared handouts, and a session journal.
- Player ownership, invitations, personal return links, server persistence, and credential-free backups.

Scene / Character / Journal / Manage is the shared navigation order for players and GMs. Controls differ according to role and rules. See [release evidence](docs/RELEASE.md) for what was actually tested and deployed; this baseline is not a claim that every target has passed validation.

Inventory weight and encumbrance are ruleset-specific. The Fate Accelerated baseline imposes no default encumbrance mechanic; another adapter may implement its own carrying rules.

## Shared architecture and collaboration

**All three work lanes coordinate through [the shared campaign hub](https://github.com/Sodelin/websites-for-game-master-prototype-).** Yellow Call is head auditor and shared integrator; Fate owns this Site and serves as sub-auditor; DCC owns Lantern. Work uses distinct branches, disjoint owned paths, exact commit handoffs, and one writer per Site.

Keep campaign access/persistence, system rules, human-authored table data, and interface components separate. Shared infrastructure should support Fate, DCC, and Yellow Call without imposing the same mechanics or campaign content. Cross-system compatibility is established by two adapters passing one contract, not by matching filenames.

| Boundary | Source |
| --- | --- |
| Campaign membership, persistence, command receipts | `lib/campaign/api.mjs` |
| Pure Fate mechanics | `lib/fate/domain.mjs` |
| Fate table authoring, authorization, projection, import | `lib/fate/adapter.mjs` |
| Fate table interface | `app/table.tsx` |
| Database schema and migrations | `db/schema.ts`, `drizzle/` |

The repository's historical name is [F.A.T.A.L.-After-Hours](https://github.com/Sodelin/F.A.T.A.L.-After-Hours); the implemented rules are Fate Accelerated. Historical adventure-oriented documentation is superseded by this mission and should remain labeled as historical if retained.

## Verify and continue

Read `AGENTS.md`, [collaboration](docs/COLLABORATION.md), [toolkit contract](docs/TOOLKIT_CONTRACT.md), [API contract](docs/API_CONTRACT.md), and current shared ownership before editing. Keep framework/publication instructions in `docs/RUNTIME.md` and the applicable Sites workflow.

Validate authoring, mechanical automation, phone use, and shared design as separate acceptance areas. A GM builds an arbitrary table, players use calculated rules with correct permissions, and reload/export/import preserves it. Run the relevant Node tests and TypeScript/build checks for the actual revised source. Record failed, blocked, and not-run checks alongside passed checks and the exact release revision. Earlier tests do not automatically validate newly added toolkit behavior.

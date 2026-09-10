---
title: "Fate After Hours: comparable tools, reuse decisions, and interaction evidence"
date: 2026-09-10
status: research-draft
scope: "Six-product primary-source scan; private-friends campaign experience and shared system adapters"
tags: [fate-after-hours, product-research, tabletop, architecture, accessibility]
---

# Decision brief

Fate After Hours should concentrate on a persistent, immediately understandable campaign loop: enter the story, know what is happening, choose an action, see its consequence, and return later to the same unfinished decision. A character sheet, map, and dice roller are necessary components; their presence alone does not establish the user's Melvor Idle-like compression of a tabletop campaign.

The strongest immediate reuse choices are: retain our common campaign API and Fate adapter boundary while improving the player loop; use Owlbear Rodeo's documented invite/ownership patterns as a comparison; use the Foundry Fate module as a mechanics-and-sheet feature checklist; evaluate boardgame.io in an isolated technical spike before changing the current persistence engine. Fari's current landing page is a migration/replacement shell, so its historical reputation is insufficient evidence of a working hosted alternative today. These are engineering judgments from the sources below, not measured usability rankings.

Evidence strength: **high** for directly inspected license declarations and documented feature existence; **moderate** for vendor descriptions of their own workflows; **low / untested** for which experience will be faster or more enjoyable for Nolan's friends. No head-to-head trials, completion-time estimates, or effect sizes were found or inferred.

## Evidence table

All sources were accessed **2026-09-10**. “Not established” means the retained pages did not establish the capability or permission; it is not a claim that the product lacks it.

| Tool | Verified features, roles, persistence, and entry flow | Actual reuse/license boundary | Concrete choice for Fate After Hours |
| --- | --- | --- | --- |
| **Fari** | The current landing page offers legacy-browser export and advertises a forthcoming installation. The historical repository describes an open VTT and local development with Node 16. Current hosted GM/player operation, durable shared campaigns, and map behavior were **not verified**. [Current landing](https://fari.app/), [historical source README](https://github.com/farirpgs/fari-app/blob/master/README.md). | The repository's license file is **AGPLv3**. Direct modification/reuse needs its applicable license and source-offer obligations; it is not an MIT component. [License](https://github.com/farirpgs/fari-app/blob/master/LICENSE). | Treat as a historical source candidate and possible import-format target. Recover a specific version and prove its storage/join behavior before adopting code or recommending it as the immediate play destination. Do not anchor our persistence on an unverified legacy browser store. |
| **Foundry VTT + Fate Core Official** | Foundry provides browser participation through a host's invitation URL, integrated sheets/maps/dice, and separate GM/player views. Its FAQ describes a purchased host license and explicitly says mobile is not core-supported. The Fate module documents Core, Condensed, and Accelerated presets, configurable tracks, refresh auditing, and visibility-aware scene aspects. [Foundry FAQ](https://foundryvtt.com/article/faq/), [Fate module README](https://github.com/Sk1mble/fate-core-official/blob/main/README.md). | Foundry is a licensed host platform. The module README separately declares **GNU GPLv3 software** and **CC BY 3.0 Fate content**. Platform, module code, and game text have different permissions. Module-specific legacy world import is documented as no longer supported. | Best established Fate feature checklist and a possible separately hosted play option. Reuse the ideas of scene-relevant aspects, explicit track types, and refresh accounting. Do not transplant its Foundry-dependent runtime into our Worker or assume interoperable campaign saves. |
| **Owlbear Rodeo** | GM-created rooms are joined by browser link and GM approval. Anonymous players can join, but creating saved rooms/scenes/images requires an account. Saved scenes and images are independent of a room. Owner-only permissions constrain player token changes; GMs can reassign ownership. [Rooms](https://docs.owlbear.rodeo/docs/rooms/), [permissions](https://docs.owlbear.rodeo/docs/permissions/). | Extensions are hosted web interfaces described by a manifest; the platform loads them in an iframe and exposes a TypeScript SDK. The **SDK is MIT**, which does not license the complete hosted VTT. [Extension architecture](https://docs.owlbear.rodeo/extensions/getting-started/), [SDK license](https://github.com/owlbear-rodeo/sdk/blob/main/LICENSE). | Closest documented entry/ownership pattern for casual friends. Keep campaign membership distinct from browser presence; allow explicit GM character reassignment after recovery. A future optional map-side extension is plausible. Do not add a second map state authority until bidirectional ownership and save semantics are specified. |
| **Roll20** | The product documents account signup, friend-invite links, integrated sheets/dice, macros, campaign pages/folders/assets, and fog/lighting. This establishes a broad browser tabletop workflow, not a measured setup time. Fine-grained role controls and export portability were not verified in the retained source. [Official product page](https://roll20.net/). | No reusable platform-code license was established by this page. A hosted feature, macro interface, or available game sheet is not permission to copy the entire platform or paid content. | Borrow the interaction goal of one action applying its mechanical bookkeeping. Keep an external reference/play option instead of replacing our application with a campaign-organizer clone. A sheet/import integration needs its own format and license check. |
| **Alchemy** | The official site documents a scene-oriented storytelling interface, audiovisual atmosphere, games/characters/universes, and a homebrew system builder. The retained page does not establish Fate-specific automation, guest access, private-state rules, an export schema, or self-hosting. [Official product page](https://alchemyrpg.com/). | No open-source runtime or portable content license was established. Its official partner content and hosted access do not confer reuse rights for our pack. | Strong presentation reference: place the current situation and consequential choice ahead of configuration. Create our own optional scene art/audio and original content. Do not assume cinematic presentation supplies automatic campaign logic or permission to reuse marketplace assets. |
| **boardgame.io** | Its source README documents move-based JavaScript rules, server/client/storage state management, realtime multiplayer, phases, a lobby, plugins, logs, and a view-independent client. These are reusable engine features, not a ready-made Fate campaign. [Official source README](https://github.com/boardgameio/boardgame.io/blob/main/README.md). | **MIT** permits code reuse with the required notice. This scan did not verify a production Cloudflare Worker/D1 deployment, our capability membership model, or a current Fate adapter. [License](https://github.com/boardgameio/boardgame.io/blob/main/LICENSE). | Highest-priority engine candidate to evaluate technically. Implement one Fate command, secret projection, reconnect, concurrent writes, and a pending GM decision in an isolated spike. Adopt only if it improves those outcomes without losing our audited persistence/access guarantees. No migration is recommended on feature-list evidence alone. |

## Prioritized implementation implications

These are proposed work items for the current application, not claims that the researched tools have already been integrated.

1. **Make the campaign itself playable.** Each scene needs a current objective, interactable people/objects, several concrete example actions, and a clearly permitted “something else” path. Actions should change discoverable facts, resources, relationships, accessible routes, or the next decision. Preserve open-ended GM adjudication. This is our mission-derived requirement, not an effect established by vendor testimonials.
2. **Make return-to-play a first-class state.** The resumed view should identify the character, location, recent consequences, and exactly whose decision is pending. Preserve drafts separately from committed actions. A reconnect must not turn an unresolved outcome into a fresh roll.
3. **Use one spatial vocabulary with adapter-specific rules.** Fate uses zones and narrative obstacles. Present reachable locations and interactive actors visually, with a list alternative. The shared map contract can carry nodes/routes/visibility; DCC and Yellow Call adapters decide how movement, time, or checks work.
4. **Separate reusable pack data from a live save.** Version pack identity, scenes, original actors, clues, routes, choices, consequences, and ending conditions. Store play state and membership separately. Reusing the same theme or schema must not reset choices or transfer credentials. None of the retained competitor sources establishes a universal interchangeable campaign-pack format.
5. **Prove a second adapter before extracting more generic code.** Shared membership, revisions, receipts, import envelopes, role projections, and common navigation have immediate value. Fate stress, DCC combat, and investigation-specific discoveries remain in system adapters. Review boardgame.io against this boundary in a small spike.

## Interaction requirements grounded in a primary standard

WCAG 2.2 is an accessibility standard, not evidence that one VTT is more fun or faster. It requires consistent repeated navigation and identification, keyboard access, accessible status messages, and an alternative to dragging where dragging is not essential. For our interface: keep Scene / Character / Journal / Manage in the same relative order, preserve visible focus, announce save/conflict states, and offer click-select movement alongside dragging. [WCAG 2.2](https://www.w3.org/TR/WCAG22/#consistent-navigation), [consistent identification](https://www.w3.org/TR/WCAG22/#consistent-identification), [keyboard](https://www.w3.org/TR/WCAG22/#keyboard), [status messages](https://www.w3.org/TR/WCAG22/#status-messages), [dragging movements](https://www.w3.org/TR/WCAG22/#dragging-movements).

The standard does not require identical character mechanics across games. Consistency belongs in the control's purpose and placement; meaningful differences in permitted actions and system rules remain visible.

Proposed evaluative tasks for our own playtest:

| Task | Observe and record | Failure worth fixing |
| --- | --- | --- |
| Join and enter the first scene | Completed independently, assistance requested, abandonment point; actual elapsed time if measured | Participant cannot identify the next action or needs the GM to explain account/storage mechanics |
| Make a consequential choice | Intended action, control selected, resulting state, comprehension of outcome | Dice result appears without an understandable effect on the story |
| Use a zone map | Keyboard/touch completion, ownership errors, visibility errors | Map requires dragging or exposes hidden GM information |
| Pause during a negotiated outcome | Pending decision before/after reload, correct decision owner | Outcome auto-finalizes or is lost across sessions |
| Resume later | Recovery success, ability to explain current goal and recent consequence | Save exists but participant cannot reconstruct what to do next |
| Switch campaign/system | Navigation errors and mistaken rule assumptions | Same-looking controls silently perform incompatible actions |

Do not turn these tasks into an invented benchmark. First measure the existing release, then the revision, with the same scenario and record order/practice effects. Private playtest notes require participants' agreement; no monitoring has been configured by this research.

## 11. Process-integrity assessment

This was a bounded purposive product scan, not a systematic review. It retained eleven substantive primary pages across six products and W3C, plus three license-file checks. Sources were selected for direct relevance to the current project; third-party rankings, vendor testimonials, search snippets, and unverified performance claims were excluded from conclusions. Some direct help URLs failed; Roll20's detailed permissions and portability therefore remain unestablished rather than inferred from memory.

Process verdict: **adequate for a reversible implementation decision; incomplete for procurement, security certification, or comparative usability ranking**. Primary documents were distinguished from our recommendations, access date was recorded, and unavailable details are explicit. AMSTAR-2 is not applicable to a product-documentation scan; a numeric review-quality score would imply a validation that was not performed. The main fix is to execute a bounded boardgame.io integration spike and a real small-group playtest before changing the architecture.

## 12. Robustness assessment

No pooled effect size or quantitative comparison is available. Heterogeneity is structural: a licensed self-hosted VTT, hosted scene/map platforms, a changing Fari application, and an embeddable game engine solve different problems. Combining their feature counts into one numerical quality score would be misleading.

The recommendation survives that uncertainty because it is conditional: use verified patterns now; change the persistence engine only after an actual compatibility test. What would change the decision: an exact maintained Fari build with an appropriate license plan and proven shared recovery; a boardgame.io spike that passes our role, conflict, retry, and deployment cases with materially less custom maintenance; or a playtest showing our supposedly simpler loop requires more explanation than an existing tool. Existing implementation effort is a prior that favors retaining our kernel; the spike is intended to challenge that prior rather than justify sunk cost.

## Source receipts and reuse ledger

| ID | Primary source and document type | Specific receipt / limitation |
| --- | --- | --- |
| S01 | [Fari current landing](https://fari.app/) — product page | Replacement/install notice and legacy-browser export; no operational multiplayer claim used. |
| S02 | [Fari historical README](https://github.com/farirpgs/fari-app/blob/master/README.md) — software documentation | Repository redirect resolved from fariapp/fari to farirpgs/fari-app; README blob `2a27f457eaaebe4d795dd08892d22e2f9319dd65`. Development text includes Node 16; current runtime compatibility not tested. |
| L01 | [Fari LICENSE](https://github.com/farirpgs/fari-app/blob/master/LICENSE) — license file | AGPL version 3 text inspected. |
| S03 | [Foundry FAQ](https://foundryvtt.com/article/faq/) — official documentation | Page states updated 2026-03-18; host/browser/license/mobile claims attributed to its own documentation. |
| S04 | [Fate Core Official README](https://github.com/Sk1mble/fate-core-official/blob/main/README.md) — maintainer documentation | Accelerated presets, tracks, visibility and software/content license declarations; README blob `2876ed7cd5f52b7af14a331ba2f6367a21e9a076`. The guessed `LICENSE` filename returned 404; license classification here comes explicitly from README. |
| S05 | [Owlbear rooms](https://docs.owlbear.rodeo/docs/rooms/) — official documentation | Anonymous entry, approval, account-dependent saved asset creation, room/data distinction. |
| S06 | [Owlbear permissions](https://docs.owlbear.rodeo/docs/permissions/) — official documentation | Owner-only interaction and GM ownership reassignment. |
| S07 | [Owlbear extensions](https://docs.owlbear.rodeo/extensions/getting-started/) — official developer documentation | Manifest, hosted iframe UI, TypeScript SDK. |
| L02 | [Owlbear SDK license](https://github.com/owlbear-rodeo/sdk/blob/main/LICENSE) — license file | MIT notice inspected; scope is SDK, not hosted platform. |
| S08 | [Roll20](https://roll20.net/) — official product page | Signup, friend links, sheets, macros, maps and campaign organization; vendor ease claims not treated as measured outcomes. |
| S09 | [Alchemy](https://alchemyrpg.com/) — official product page | Scene-based presentation and system builder; testimonials excluded from evidence. |
| S10 | [boardgame.io README](https://github.com/boardgameio/boardgame.io/blob/main/README.md) — software documentation | State management, multiplayer, phases, lobby, plugins, logs, view independence. |
| L03 | [boardgame.io license](https://github.com/boardgameio/boardgame.io/blob/main/LICENSE) — license file | MIT notice inspected. |
| S11 | [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — W3C Recommendation | Normative interaction/accessibility requirements; not an empirical product comparison. |

Zotero/Obsidian integration: import product pages as Web Page, software repositories as Computer Program where appropriate, and WCAG as Report or Standard supported by the local Zotero type mapping. Use `project:fate-after-hours`, `evidence:primary`, and one of `topic:architecture`, `topic:interaction`, `topic:licensing`. Link license entries to their software item using Related; link this note to the shared campaign architecture decision rather than duplicating rule claims in every site. No Zotero records were created during this pass.

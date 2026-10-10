# OSOGBO LIFE design and interaction audit

Audit date: 2026-10-10. This is a source-level audit of the existing TanStack Start, React, Supabase, MapLibre, and Three.js application. Routes and current claims were checked against the route tree, components, service modules, migrations, and tests. A configured browser session and staging Supabase account were not available, so live gameplay and visual behavior remain unverified.

## Baseline before this overhaul

- `npm.cmd run build`: passed with the Cloudflare Module Nitro target.
- `npm.cmd test`: 119 tests passed in 29 files.
- `npm.cmd run dev -- --host 127.0.0.1`: Vite started on port 8081 because port 8080 was already occupied. An HTTP smoke request to the new server timed out; the request caused an aborted-request 500 in the dev log. This is not counted as a successful browser check.
- The prior release audit measured an approximately 335 KiB entry module (104.8 KiB gzip), a 1,067 KiB map module (285 KiB gzip), and a 915 KiB house scene (239 KiB gzip). These route-specific assets are deferred from the landing entry.
- The codebase contains 180 files under `src`, 21 route-related files (including the route README), and 29 game components. The routed game uses Supabase RPCs for authoritative changes, React Query for server state, and a shared game-time provider.
- Reference review: Lagos Life returned only its page title to the text browser; Lagos Love was inaccessible; EA's public Sims page describes character/world design and player storytelling. The redesign follows those broad usability patterns without copying assets or interface layouts.

## Screen inventory and findings

| Screen / flow                    | Existing behavior to preserve                                                               | Audit finding and priority                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Welcome / title (`/`)            | Osogbo photography, account links, game identity                                            | Previously a long promotional page with no valid-save-aware Continue action. P1: now a focused title screen with conditional resume, saved character preview, live gameplay entry points, and responsive art direction.        |
| Sign-up / login                  | Supabase auth, guest flow, account recovery                                                 | Preserve existing AuthCard and callbacks. P1: verify email confirmation, expired sessions, and recovery in a real staging account.                                                                                             |
| Continue / new life              | Authenticated route guard, saved character routing                                          | Previously depended on login/create routes; title screen now checks session and character before showing Continue. P1: validate this branch against live RLS and existing users.                                               |
| Character creation               | Appearance layers, name, age, personality, career preference, `create_character` RPC        | Existing preview and controls were functional. P1: add reset/randomize actions, keyboard-group semantics, trimmed-name submission, and duplicate-submit/network error protection. No separate life-background mechanics exist. |
| Main game shell / HUD            | Shared simulation clock, wallet, weather, unread count, desktop rail, mobile navigation     | Functional shared layout. P1: test at actual viewport sizes and check that panels/nav do not obscure map or interior controls. No separate pause screen is present.                                                            |
| City map                         | MapLibre map, player marker/movement, location search, routes and travel services           | Main city route and route service exist. P1: exercise provider errors, routing availability, touch controls, and actual arrival state in browser.                                                                              |
| Location detail                  | Location metadata, visits, available contextual actions and travel                          | Real route exists. P1: compare every displayed action to the location type and backend behavior in seeded play.                                                                                                                |
| Travel                           | Existing transport and authoritative travel RPCs                                            | Keep the current location/time/economy path; do not introduce a parallel travel engine. P1: test costs, interruption, and arrival in staging.                                                                                  |
| Home / room navigation           | `/home` owns the cloud/local housing save, room navigation, furniture, and power conditions | Main home is an interactive 3D scene with local backup and cloud conflict handling. P1: verify reload/offline/conflict flows and input on touch devices.                                                                       |
| Property (`/house`)              | Route retained for property access                                                          | It links to canonical `/home` rather than maintaining a second independent house state. Property purchase/rent scope remains limited to existing backend support.                                                              |
| Furniture / Build Mode           | Furniture catalog and placement are in home components                                      | Existing route/component tests cover selected placement rules. P1: browser-test price confirmation, invalid placement, repositioning, and mobile controls.                                                                     |
| Inventory / market               | Inventory and purchases use shared item/economy RPCs                                        | Core systems and service tests exist. P1: test insufficient balance and inventory consistency against staging.                                                                                                                 |
| Wallet / transactions            | Wallet history and authoritative economy operations                                         | Preserve RPC authority; browser must not write balances directly. P1: exercise retries and duplicate prevention in staging.                                                                                                    |
| Careers / work                   | Job board, applications, location gating, shifts, work activities, server-side pay          | Services and RPCs exist. P1: validate schedules and one-time salary against staged game data.                                                                                                                                  |
| Needs / character status         | Life simulation panel and profile stats                                                     | Shared simulation systems exist. P2: consolidate explanatory labels, validate feedback and avoid stale state after RPC failure.                                                                                                |
| NPC / social                     | Routine simulation, contextual interactions, relationship progression/history               | Social route and simulation exist. P1: verify routine recovery, consent gates, persistence, and repeat-interaction limits.                                                                                                     |
| Missions / education             | Mission progression and education routes                                                    | Routes and service coverage exist. P2: verify unlock copy matches actual prerequisite logic.                                                                                                                                   |
| Notifications / city events      | Notification route and world environment/events                                             | Existing events use simulation state. P2: verify lifecycle and notification deduplication over reloads.                                                                                                                        |
| Settings / audio / accessibility | Audio opt-in and volume settings, account actions, reduced motion                           | Controls exist. P1: test keyboard, screen-reader announcements, reduced motion, and browser audio restrictions.                                                                                                                |
| Save / error / empty states      | Cloud home save and local housing backup, typed page errors                                 | Home save recovery has explicit conflict paths. P1: full account/game state is not represented by one browser-side save slot; test other durable records and expired sessions in staging.                                      |

## Prioritized implementation

1. **P1 — Entry validation:** verify save-aware Continue, location display, and session recovery with signed-in and guest accounts against live RLS.
2. **P1 — Character-creation validation:** exercise reset/randomize, required fields, duplicate clicks, and RPC failure recovery against staging.
3. **P1 — Responsive gameplay:** manually test desktop/tablet/mobile map, home, movement controls, and the five-item mobile dock with the phone launcher.
4. **P1 — End-to-end regression:** exercise travel, economy, work, NPCs, furniture, and save recovery in a seeded staging account.
5. **P2 — Visual consistency/performance:** review route-specific panels against the new tokens, collect actual route-level load profiles, then decide whether to split the MapLibre or Three.js scenes further.

## Verification after the first implementation stage

- `npm.cmd test`: 125 tests passed in 30 files (6 new appearance tests).
- `npm.cmd run lint`: passed with 14 existing Fast Refresh warnings.
- `npx.cmd tsc --noEmit`: passed.
- `npm.cmd run build` and `npm.cmd run build:dev`: both passed. Existing large MapLibre/Three.js chunk warnings remain.
- `git diff --check`: passed.
- Local Vite route smoke check: `/`, `/login`, `/signup`, `/home`, `/map`, `/social`, and `/location/oke-fia` returned HTTP 200; an unknown path returned HTTP 404. This checks server route fallback only; it is not a rendered or authenticated gameplay test.
- Desktop/tablet/mobile visual checks, accessibility tooling, authenticated end-to-end flow, and live backend tests remain outstanding.

## Current implementation boundaries

- No new backend or state-management dependency is introduced.
- Starting property/background choices, a cinematic arrival tutorial, vehicle ownership, player-owned business, clubs, and player-to-player systems are not currently supported; the title flow does not present them as available actions.
- Public-world photos are credited in the interface; game artwork remains the project's original bundled miniature-city image and SVG character renderer.
- Build/test results do not establish browser accessibility, responsive quality, security policy, real map-provider availability, or cloud-save correctness. These need live verification.

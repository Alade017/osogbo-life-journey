# OSOGBO LIFE improvement plan — Phase 0

Date: 2026-10-23 (Africa/Lagos). Status: owner approved Phase 1 stabilization and Phase 2 planning with “proceed”; implementation beyond that scope remains gated.

## Scope and evidence standard

Follow root `AGENTS.md`: present architecture and game-loop changes and wait for explicit approval. The attached master prompt authorizes this audit/document, then requires a stop. Proposed continuation is Phase 1 stabilization followed by Phase 2 planning only. Phases 3–8 remain separately gated.

“Verified” below means inspected repository source or a command executed during this audit; it does not imply authenticated runtime success. Historical QA is explicitly historical. Missing evidence is not a confirmed gameplay defect.

## Repository baseline

- Verified: branch `main`, HEAD `9208a960` (auth-card styling); initial short status, unstaged diff summary and staged diff summary were empty. Recent commits include `706028c2` database fixes, `fc9a731a` career work and `937b25a9` room/purchase work. Preserve these commits and any subsequent user edits.
- Verified: npm lockfile `package-lock.json`, npm package-manager declaration 11.6.2; Node requirement 24.x, installed Node v24.12.0. `npm.cmd ls --depth=0 --offline` exited 0, reporting two extraneous packages; no install was performed.
- Installed: React/React DOM 19.3.0, TypeScript 5.9.3, Vite 8.1.5, Vitest 4.1.10, TanStack Start 1.168.60, Router 1.170.41, Three 0.186.1, Fiber 9.8.1, Drei 10.7.9, Phaser 3.90.0, MapLibre 6.13.0, Colyseus 0.18.0, schema 5.0.8, SDK 0.18.5, legacy colyseus.js 0.16.0, Supabase JS 2.117.2. Installation alone does not establish an active renderer/client.
- Verified: strict TypeScript with indexed-access restrictions; ESLint flat config includes Prettier and hooks; Vitest uses jsdom and `src/test/setup.ts`. Tests do not establish WebGL, hosted permissions or device performance.
- Verified: Vite game and independent public-site configs use separate caches. Game builds use TanStack Start and Nitro; Three Clock compatibility is handled by `src/lib/three-timer-clock.ts` and a Vite resolver. Preserve that compatibility arrangement pending evidence.
- Environment names were inspected only in `.env.example`; actual secret files were not read. Browser config includes publishable Supabase settings, map/routing settings and multiplayer endpoint; privileged credentials remain server-only.

## Current architecture and reuse map

| System | Verified repository implementation | Evidence boundary / reuse decision |
| --- | --- | --- |
| Map and navigation | `src/routes/_authenticated/_game/map.tsx` renders `CityMapDashboard`; dashboard imports `components/map/MapCanvas.tsx`, town JSON, housing markers, place actions and world clock. MapCanvas uses Fiber/Drei/Three. State/town selection, search, categories and accessible fallback already exist. | Stabilize this renderer first. Legacy SVG/MapLibre/Phaser code does not establish the active map path. |
| Travel and map actions | `src/lib/map-api.ts`, server map/action modules and `/api/map/*`; `src/lib/game.ts` retains travel/location RPC wrappers. | Preserve action payloads, retry keys, authoritative costs/arrival and ownership. Inspect current routes before changing contracts. |
| Housing | `/house` directly renders `housing/HouseRoom3D.tsx` with slots, placements, editMode, moveEnabled and selection/move callbacks; also supplies houseTypeId and accessoryBand. `HouseRoomScene.tsx` exports shared placement/slot types and an alternate scene implementation. | Do not assume older QA's home/house description remains current. Keep route-owned mutations and canonical state. |
| House persistence | `house-api.server.ts:141–150` calls get_house_state, house_place, house_move, house_remove. `/api/house/*` delegates to authenticated handlers. `house-state-sync.ts` maintains owner query keys/private broadcast invalidation. | RPCs take player ID on trusted server; placement takes item/slot, move takes from/to slots, removal takes slot. Preserve the authenticated identity boundary. |
| Models | HouseRoom3D has HEAD availability checks, `useGLTF` with `/models/draco/`, model boundaries and procedural fallbacks. `public/models/rooms/development-room.glb` exists (7,784 bytes); `public/models/furniture/` is absent. | Missing optional models are not proof of broken rendering. Successful GLB loading, compression compatibility and licensing have not been established. |
| Time and needs | `GameTimeProvider.tsx`, `life-simulation.ts`, `simulation-service.ts` use personal simulation commands; pause/resume sends settings. `use-world-clock.ts` separately queries world_clock every 15 seconds. | Keep personal simulation, world time and Lagos calendar-day accounting distinct. Authoritative rewards must remain server-confirmed. |
| Career, wallet and economy | `career-service.ts` exposes catalog, shifts, steps, claim, promotion and leaving; `career-rules.ts`, CareerPanel, career tests and `drizzle/migrations/0076_career_progression.sql` exist. `game.ts` also retains legacy jobs/promotion, wallet/shop RPCs. | Trace active job UI before extending; never add a competing career system. Business/investment service/UI and database tests already exist. |
| NPCs and relationships | `npc-simulation.ts`, NPC interaction RPC wrapper, player-social services/components and tests exist. | Local simulation helpers do not prove durable relationship rewards. Validate each authoritative path before expansion. |
| Phone, messaging, notifications | PhoneLauncher and phone apps, PlayerSocial, notifications route; player-social-service reads conversations/messages and reply metadata. Social delivery migration includes thread preferences and inbox events. | Messaging and preferences already have infrastructure. Audit existing access controls, rate limits, pin/mute/replies before declaring gaps. Do not add voice notes. |
| Parties and venues | party-service calls enter/leave club, activity/drink/dance, host_party_event and respond_to_event. October 19 migrations contain mood, visits, events, requirements and RLS. | Hosting and mood already exist; successful-party reputation and real-player invitations need a specific gap audit. |
| Stalls, goals, missions | CourseAndStallApps, CommunityPhoneApps, business systems, missions route, claim_mission/visit_location wrappers and mission-reward migration exist. | Do not equate existing missions with complete Lagos daily tasks, or business dividends with complete stall income. Completion of daily resets, streaks, weekly events and exploration rewards remains unverified. |
| Supabase | Client/session integration, server handlers, migration SQL and local PGlite tests exist. Server house migration revokes direct placement writes and reserves its RPCs for service_role. | Hosted ledger, deployed function definitions, grants and RLS outcomes were not inspected. No database connection or SQL application in this phase. |
| Multiplayer | `multiplayer/neighborhood-room.ts` validates token through Supabase, checks saved location, uses authoritative movement, maxClients 32 and input limits. Redis/server files and party room exist. | Historical NeighborhoodGame path is absent. Do not infer current map multiplayer integration or two-client success from server existence. Trace active client in Phase 1. |

## Confirmed discrepancies and issue candidates

1. **Confirmed documentation/tooling discrepancy:** `scripts/neighborhood-browser-smoke.mjs` referenced throughout `docs/release-qa.md` does not exist. Present checks include `scripts/map-runtime-browser-check.mjs`, `phone-ui-browser-check.mjs`, and `verify-live-map.mjs`. The map runtime script starts Chrome and targets a local Vite fixture; it is not equivalent to historical neighborhood movement/collision coverage. Proposed fix after approval: inventory the intended coverage, run supported checks and document missing coverage accurately.
2. **Historical issue, current reproduction pending:** QA records October 12 GPU/cache/browser renderer failures and purchase/placement timeouts. October 13 subsequently records 282 passing tests. Neither result establishes today's outcome. Investigate failing cases in isolation and under full-suite load; inspect timers, query caches, async waits and selectors without increasing timeouts or weakening assertions.
3. **Historical Colyseus error, current applicability unverified:** QA says MapSchema collection callbacks were replaced with room onStateChange in an older client. Installed versions are confirmed above, but the referenced NeighborhoodGame file is absent. Locate any active subscriber and capture actual stack/version before proposing a fix. Do not reintroduce obsolete collection callbacks.
4. **Potential obsolete request details:** Current MapCanvas is an R3F implementation. No `geo.attributes.position!` occurrence was found in that file. Only an actual compiler error can justify a typing edit.
5. **Provider issue not established:** `community-phone-apps.test.tsx` already wraps its component in QueryClientProvider. Confirm any failing provider and actual component dependency before changing setup or production tree.
6. **Town expectations need current evidence:** dashboard tests import town data and assert an eight-district, 14×10 grid and fictional venue actions. October 22 expanded-town migration exists. Compare test failures with current product data; do not shrink the map to satisfy an old expectation.
7. **Assets incomplete for migration assessment:** furniture GLB directory absent; one development room exists. Phase 2 must inventory actual GLB JSON/extensions, decoder files, source/license records and room URL mapping. No PlayCanvas compatibility claim is made here.

These are evidence boundaries and candidates, not an assertion that map gameplay is currently broken.

## Proposed architecture and game-loop changes

### Phase 1 — approval requested

Keep the existing loop: authenticated player → choose place/home → send action or travel request → authoritative response → update canonical query state → render result. No new reward, clock, fee or progression rule.

Create `docs/map-issues-inventory.md` with path, symptom, exact evidence, classification, player impact, minimal fix and verification for every issue. Reproduce failures first. Candidate affected files are MapCanvas, CityMapDashboard, map marker/style helpers, town data expectations, relevant map/housing/phone tests and browser scripts; edit only when evidence identifies a defect. Preserve design tokens and public component contracts. Add a meaningful regression for every confirmed product fix and demonstrate before/after failure where safe.

No database/schema work is expected for renderer/test stabilization. If diagnosis points to a server contract or security change, document it and obtain a scope decision before implementation. No dependency additions are proposed.

### Phase 2 — planning only, after Phase 1

Create `docs/playcanvas-home-slice-plan.md`, limited to HouseRoom3D and the house route. Preserve all current props, server payloads and route-owned state; propose a lazy renderer adapter behind a feature flag, with the existing R3F renderer as fallback. Design overlay event ownership, drag/click suppression, pending mutation handling and renderer disposal explicitly. The flag and adapter are proposals, not work authorized during Phase 2.

Verify upstream version/tooling/license evidence at that time; inspect real assets and compression. Mark statements Verified/Assumed/Unverified. Loading tests requiring PlayCanvas installation/prototype must wait for approval. Propose measurable frame-time, load, memory and bundle budgets after collecting current baselines; include 375px, budget Android, keyboard/touch, placement/move/remove, error/fallback and duplicate-input checks. Stop after the document: no package install, renderer replacement or Phase 3–8 work.

### Later roadmap — no implementation approval requested now

Daily tasks, calendar streaks and weekly events must first be reconciled with missions/events; use Lagos calendar dates for daily claims and trusted time for eligibility. Career extends existing shift/promotion RPCs. Party rewards reuse eligibility/attendance infrastructure. Stall accrual reuses applicable economy receipts with authoritative elapsed time/caps. Messaging extends existing conversations/preferences. Goals derive from authoritative tables. Landmark schedules use world time, and exploration ties to validated travel. Each feature needs its own architecture/game-loop review and acceptance criteria before edits.

## Data and security implications

No migration, auth, RLS, RPC or data change in Phase 0. Preserve server-only service credentials and authenticated identity derivation. A future approved schema change must use a new Supabase migration, never edit applied SQL. Both `drizzle/migrations` and `supabase/migrations` exist; drizzle.config.ts points to the former. Reconcile migration ownership/order and the actual local workflow before generating any migration; do not assume the historical HUD-only runner applies later SQL. No hosted SQL, migrations, deployments or account changes are authorized.

## Verification strategy

Phase 0 runs a typecheck and four focused suites as a limited baseline; results recorded below when complete. Full lint/build/browser/database validation is deferred to approved Phase 1, not claimed passed.

After approval use actual scripts: `npm.cmd run typecheck`, `npm.cmd run lint`, focused Vitest map/housing tests, `npx.cmd vitest run` where practical, `npm.cmd run build`, `npm.cmd run build:public`. Use a single-worker rerun only to diagnose load sensitivity and report its flags. Record exact counts, skips, failures and timeouts. Browser harness must have its local server/prerequisites inspected; classify browser startup/GPU failures separately from product bugs. No authenticated or real-device pass without actually exercising that environment. Recheck git status/diff to preserve concurrent user work.

## Approval and reporting

Owner decision: approve Phase 1's evidence-based current-renderer stabilization and subsequent Phase 2 planning only, or revise scope. Root AGENTS.md explicitly requires approval before feature edits; the master prompt explicitly requires stopping after Phase 0 when that gate applies.

Only this document is added in Phase 0. Migrations: none. No implementation, branch creation, commit, push, PR, merge, history rewrite or deployment. Known limits: hosted RLS/RPC/persistence, authenticated multiplayer, current browser/device rendering and budget-phone performance remain unverified. PlayCanvas and all later gameplay implementation are deferred.

## Current audit check results

- `npm.cmd run typecheck`: failed, exit 1, 31 diagnostics. Files: `src/components/game/GameUIOverlay.tsx`, `src/components/game/map/InteractiveMap.tsx`, `MapCamera.tsx`, `MapPin.tsx`, and `src/store/mapSlice.ts`. Examples: missing react-redux / @reduxjs/toolkit and store modules; invalid toneMapping string; missing MapLoading; unsupported CameraControls rotateSpeed; undeclared controls/target variables; removed Fiber MeshProps export. These are confirmed compiler defects in the initial source, not evidence that these alternate components are reachable in the active map. Proposed Phase 1 task: trace references and repair the intended implementation minimally; do not automatically install Redux or delete components.
- `npx.cmd vitest run src/test/map-housing-markers.test.ts src/test/osogbo-map-style.test.ts src/test/city-map-dashboard.test.tsx src/test/community-phone-apps.test.tsx --maxWorkers=1`: failed, exit 1; 4 files, 2 passed/2 failed; 16 tests, 10 passed/6 failed, none skipped, 61.73 seconds. Marker/style suites passed. Dashboard: 3 passed/2 failed, including absent accessible Civic court button and town-data expectation mismatch. Community: all 4 failed on expected controls/content; provider wrapper already exists, so a missing query provider is not established as the cause. No timeout occurred in this run. Reconcile asynchronous server-backed UI and fixture expectations before fixing.
- The dashboard run emitted duplicate React keys `river-quarter`, `south-quarter`, `east-gate`. This is a confirmed render warning; inspect district uniqueness and repeated data before selecting a fix. Actual visual/player consequences remain unverified.
- Full regression, lint, game/public builds, house browser checks and real devices were not run in Phase 0. Historical QA passes are not current results.

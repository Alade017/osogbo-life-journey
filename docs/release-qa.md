# Milestone 9 release QA

## Approved map stabilization — 2026-10-23–24 (Africa/Lagos)

Scope: Phase 1 of `docs/osogbo-life-improvement-plan.md`, approved by the owner's “proceed”; followed by Phase 2 planning only. Earlier QA entries below remain historical.

### Completed changes

- Removed identical duplicate town records (three districts, ten landmarks and ten building records); retained the expanded 24×18 layout, 11 unique districts and all 22 unique venues.
- Corrected housing-marker bounds/origin to match town scenery through the existing shared grid projection. Server rent/status/ownership values and action rules remain unchanged.
- Repaired the unused map preview's compile/hook failures without installing Redux: local view reducer/controlled props, supported camera transition, numeric Three tone mapping, loader import and Group type. This preview is not wired into `/map`.
- Replaced stale phone demo tests with server-backed service/reaction assertions, isolated dashboard queries and cleared query clients, supplied compatible housing slots, and corrected the map activity button expectation. No timeout increases or gameplay changes.
- Aligned four local PGlite auth stubs with `auth.users.is_anonymous`. As in the existing career harness, these empty-schema tests omit exactly 0075's data-only, hosted-count-guarded cleanup. No published SQL was changed or applied to a hosted database. This is not validation of that operational cleanup or the hosted migration ledger.
- Excluded only upstream Draco JavaScript bundles from ESLint after debug output confirmed ESLint was processing those vendored files. Upstream files/licenses were not reformatted.

### Verification record

| Check | Recorded outcome |
| --- | --- |
| `npm.cmd run typecheck` | Initial check failed with the same 31 Phase 0 diagnostics; both subsequent checks, including final source, passed (exit 0). |
| `npx.cmd vitest run src/test/town-data-integrity.test.ts --maxWorkers=1` before duplicate repair | Failed 1/1: 14 district records but only 11 unique IDs. |
| `npx.cmd vitest run src/test/map-housing-markers.test.ts --maxWorkers=1` before projection repair | Failed 2 / passed 1: old origin and discarded expanded-edge cell. |
| First full `npx.cmd vitest run --maxWorkers=1 --reporter=verbose` | 113 files: 6 failed / 107 passed; 486 tests: 3 failed / 430 passed / 53 skipped. Four suite setup failures at missing auth.users.is_anonymous; stale map activity label and the deliberately failing pre-fix marker regression also present. Source was still being repaired during this diagnostic run; it is not a final snapshot. |
| Intermediate 10-suite acceptance | 35 passed / 1 failed; dashboard async availability assertion expired under concurrent load. Queries/cache were then isolated rather than extending timeouts. |
| Focused final UI acceptance (`npx.cmd vitest run src/test/city-map-dashboard.test.tsx src/test/community-phone-apps.test.tsx src/test/map-housing-markers.test.ts src/test/town-data-integrity.test.ts src/test/map-camera.test.tsx src/test/home-interior.test.tsx src/test/house-edit-sheets.test.tsx src/test/place-action-menu.test.tsx --maxWorkers=1 --reporter=verbose`) | All 30 tests in 8 files passed, none skipped (84.62s). Three CJS deprecation warning remains. |
| Four local DB suites (`npx.cmd vitest run src/test/housing-database.test.ts src/test/shared-hud-database.test.ts src/test/business-database.test.ts src/test/business-investment-database.test.ts --maxWorkers=1 --reporter=verbose`) | All 53 tests in 4 files passed, none skipped (69.25s), after fixing the Auth stub and excluding only operational cleanup 0075. The intermediate rerun correctly rejected that cleanup's unmatched live counts before this harness correction. |
| `npm.cmd run lint` | Final completed run: **330 errors / 12 warnings**, 310 auto-fixable. Existing errors in unedited source/scripts/Edge Function/public site remain; no global --fix or unrelated reformat was performed. Initial lint was interrupted without results; debug rerun identified vendored decoder processing. |
| Scoped `npx.cmd eslint` | All edited TS/TSX files plus eslint.config.js passed with 0 diagnostics; exact file list below is the scoped target set, excluding JSON and Markdown. |
| `npm.cmd run build` | Initial restricted build failed in nitro:externals with EPERM readlink C:\\Users\\user. Permitted retry passed. Final build after marker repair also passed (client, SSR and Nitro). Existing >1,000 kB client-chunk warning and plugin timing notices remain. Largest client JS is 1,828,078 bytes raw; no device load/performance claim follows from a build. |
| `npm.cmd run build:public` | Passed; 17 modules, entry JS 228.29 kB raw / 71.03 kB gzip. No public-site code changed. |
| `node scripts/map-runtime-browser-check.mjs 375` | Restricted run exited without completing DevTools Runtime.enable (unsettled top-level await). Permitted retry exited 1 with undefined lifecycle result and captured errors/warnings/failures all empty. **No browser pass**: absence of captured errors does not establish successful navigation/rendering. Game Vite server was on port 3002; build/optimizer reloads occurred during this attempt. Temporary fixture was removed, local Vite server stopped. |
| Historical neighborhood smoke | `scripts/neighborhood-browser-smoke.mjs` is absent. Current map lifecycle checker does not replace movement/collision/two-player acceptance. |
| `git diff --check` | Passed at review; final status recorded below. |

**Final full regression:** `npx.cmd vitest run --maxWorkers=1 --reporter=verbose` passed, exit 0: **486 tests across 113 files, no failures or skipped tests**, 543.50s. This fresh run uses the final source and replaces the diagnostic full run above as current regression evidence. Together with final typecheck, changed-file lint and both builds, it establishes local source readiness subject to the unresolved repository lint and browser/device gates.

### Exact changed files

Added documentation/tests:

- `docs/osogbo-life-improvement-plan.md` (Phase 0 document retained; approval status updated)
- `docs/map-issues-inventory.md`
- `docs/playcanvas-home-slice-plan.md` (Phase 2 planning only)
- `src/test/map-camera.test.tsx`
- `src/test/town-data-integrity.test.ts`

Modified:

- `docs/release-qa.md`
- `eslint.config.js`
- `src/components/game/GameUIOverlay.tsx`
- `src/components/game/map/InteractiveMap.tsx`
- `src/components/game/map/MapCamera.tsx`
- `src/components/game/map/MapPin.tsx`
- `src/components/map/map-housing-markers.ts`
- `src/data/osogbo-town.json` (duplicate removal only; original JSON formatting preserved)
- `src/store/mapSlice.ts`
- `src/test/business-database.test.ts`
- `src/test/business-investment-database.test.ts`
- `src/test/city-map-dashboard.test.tsx`
- `src/test/community-phone-apps.test.tsx`
- `src/test/house-edit-sheets.test.tsx`
- `src/test/housing-database.test.ts`
- `src/test/map-housing-markers.test.ts`
- `src/test/place-action-menu.test.tsx`
- `src/test/shared-hud-database.test.ts`

### Remaining gates and data impact

Repository-wide lint is not green. Automated WebGL lifecycle, responsive layout/overflow, authenticated two-client behavior, hosted RLS/RPCs and real-device performance remain unverified. The current map has no caller of joinNeighborhood; party presence is a separate integration. Local Drizzle fixture map seeds still cover ten places, while the newer Supabase expanded-town migration is a separate source; these local tests do not establish the hosted expanded-venue state. Do not claim all 22 venues are live merely because source data exists.

Migrations added/applied: **None**. No dependency install, PlayCanvas implementation, auth/RLS/RPC edit, production data operation, branch creation, commit, push, PR, merge, history rewrite or deployment. PlayCanvas benchmark/renderer work and gameplay Phases 3–8 remain gated. Owner decisions and the Phase 2 asset/performance proposal are recorded in `docs/playcanvas-home-slice-plan.md`. Work stopped after writing that plan; no PlayCanvas or later gameplay implementation followed.

## Milestone 10 local implementation verification — 2026-10-13

- The approved business/investment extension is included in the user's `c404ba70` commit. Its reusable finance UI is available through `/businesses` and Wallet, with phone integration retained. The earlier commit was preserved; no history was rewritten.
- Fresh full regression run passed: **282 tests across 64 files** (`npm.cmd test -- --maxWorkers=1 --reporter=verbose`, 495.59 seconds). No tests failed or were skipped. This current result is separate from the earlier timeout runs.
- Business coverage includes local migration-chain application, exact-once purchase/investment receipts bound to their inputs, denied ownership/direct writes, bounded pricing, old-price settlement, seven-day accrual cap, preserved total shares/dividends, no historical dividends for new investors, and fixed-term maturity/yield snapshots. Service/UI tests cover malformed data, offset timestamps, unchanged retry IDs, invalid amounts, owner-offer filtering and load errors. Local PGlite competing attempts are serialized internally and do not establish hosted multi-connection contention behavior.
- Repository readiness check passed: all 34 migration journal entries through `0032_player_businesses_and_investments` have matching SQL files and valid ordering. This does not inspect the hosted ledger or apply SQL.
- Final `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build` and `npm.cmd run build:public` passed. Lint has 0 errors and 16 existing Fast Refresh warnings. The earlier global lint attempt found formatting errors in concurrently added database scripts; the final rerun is clean. The earlier restricted build failed on Nitro's Windows `readlink` permission; the permitted build completed. Neither database script was executed.
- Fresh built preview is running at `http://localhost:4194/`; `/` and `/businesses` returned HTTP 200. The isolated browser check of `/businesses` redirected a signed-out visitor to `/login`, rendered the login form, and captured no JavaScript exceptions or failed requests. This verifies the route/authentication boundary, not authenticated business operations or real-device layout.
- No hosted database migration, provider setting, DNS, deployment or push was performed. Business functionality on a deployed site still requires separately authorized migration/deployment and hosted acceptance. Milestone 9's remaining device, permission and multi-service evidence gates remain open.

## Readiness audit — 2026-10-12

### Additional local control verification attempt — 2026-10-12

The existing `scripts/neighborhood-browser-smoke.mjs` was rerun for keyboard movement, collision, touch input, checkpoint and pause checks at its 1024×768 harness viewport. Neither the initial restricted Chrome run nor the permitted Chrome retry produced a result. Chrome reported GPU/cache process failures on the first run; the retry ended without a result. An ignored `.smoke/` copy of the same harness was attempted with isolated headless Edge and also ended without a result, with browser renderer diagnostics. All three invocations exited with failure; no current control-test pass is claimed. These failures do not identify a gameplay defect. Earlier historical passes below remain historical evidence only. A working browser harness is required to close this gate; responsive device/accessibility verification remains separate. No game source, database, deployment or user browser profile was changed.

- The user reports that authenticated testing has already been performed. This is user-reported verification; the exact travel, persistence, security, device and multi-service scenarios have not been independently reproduced.
- `node scripts/release-readiness-check.mjs` validates the local journal without loading `.env`, connecting to a database or applying SQL. All 33 registered migrations through `0031_server_validated_home_actions` have matching files, sequential journal indices and increasing timestamps. Both `0012` files have distinct journal entries; do not renumber published migrations.
- Migration 0030 depends on the personal simulation function introduced by 0024 and expects its original clock-rate expression. Migration 0031 replaces that function and retains the corrected 1:1 rate. Apply the journal order; do not rerun 0030 after 0031 as a repair.
- Existing `scripts/apply-shared-hud-migration.mjs` applies only 0024 and is not a general migration runner. It checks the travel RPC prerequisite and refuses an existing simulation table. Do not use it to apply later migrations or infer the hosted ledger.
- Read-only live checks passed: `https://osogbo-life-journey.vercel.app` returned HTTP 200 HTML; Railway `/healthz` returned HTTP 200 and `status: ok`; the game origin was echoed in the allowed-origin response; an unrelated origin received HTTP 403 without an allow-origin header. The initial sandbox network requests failed; the permitted network retry passed. No deployment, provider setting or database was changed.
- The checker makes GET requests only, prints no environment values or response bodies, and explicitly lists unverified authenticated and device checks. Health/origin checks do not prove Redis coordination, authenticated room joins or database permissions.
- Application type checking passed. Full lint passed with 0 errors and 16 existing Fast Refresh warnings. Game and independent public-site production builds passed. The built local preview at `http://localhost:4193/` returned HTTP 200 HTML.
- The existing browser startup checker rendered the local homepage with no captured JavaScript exceptions or failed requests after a permitted sandbox retry. The first restricted run failed at its DevTools connection. This is signed-out startup evidence, not authenticated interaction or mobile/accessibility verification.
- Full regression run: 262 tests passed and 4 hit the five-second timeout, across 60 files. The affected city and inventory tests passed on isolated rerun; a home-only rerun still timed out on purchase/placement. Its broad button queries were scoped to the existing furniture panel and the floor tile's accessible label, preserving all purchase/save assertions. The subsequent focused run passed those previously failing scenarios without increasing timeouts or changing game logic. This record does not claim the initial full run passed.

### Authenticated acceptance record

For each scenario, record the environment, date, accounts by non-sensitive aliases, outcome and relevant screenshots/logs. Never record access tokens, passwords or private message content.

| Scenario                                                      | Evidence required                                                 | Current evidence                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Two clients in the same area; movement and disconnect cleanup | Both views; no stale player after leaving                         | User reports shared-world testing; detailed evidence not captured              |
| Private messages and friendship/block permissions             | Delivery, invalid recipient, blocked path rejected                | User reports messaging works; negative permission cases remain unverified live |
| Travel between two districts and building entry/exit          | Correct room, spawn and return checkpoint                         | Source/local tests; hosted scenario details not captured                       |
| Reconnect/reload and a second session                         | Saved location, wallet, inventory and home restored               | User reports testing; scenario details not captured                            |
| Duplicate job, purchase and home-upgrade request              | One reward/debit and one receipt                                  | Local database acceptance; hosted behavior unverified                          |
| Desktop and narrow mobile layout                              | Usable navigation, touch controls, keyboard focus and no overflow | Local control harness; real-device/accessibility checks outstanding            |
| Multiple room services using Redis                            | Clients connected through separate endpoints share room state     | Not established by a single healthy service                                    |

Milestone 9 remains in progress until its outstanding gates have recorded outcomes. No new milestone is introduced.

## Milestone 9 verification update — 2026-10-11

### Follow-up verification — 2026-10-11

- User-reported manual verification: two signed-in players entered/tested the shared game and private message sending works. This is recorded as the user's test report, not as an independently reproduced production test.
- Additional local regression checks: travel-state, economy-service, job-board-service, inventory-service, and shared-hud-database suites passed (30 tests across 5 files). These exercise local code/database behavior and do not verify hosted Supabase RPCs or production persistence.
- `node scripts/neighborhood-browser-smoke.mjs` passed keyboard movement, diagonal speed, collision, checkpoint, NPC interaction, touch movement, and pause checks in its headless browser harness. This verifies world controls at the harness viewport; it does not establish responsive layout/accessibility or real-device behavior at both desktop and mobile sizes.

- A production map error exposed a Colyseus schema API mismatch: the installed `MapSchema` does not provide collection-level `onAdd`, `onChange`, or `onRemove` methods. `NeighborhoodGame` now synchronizes snapshots from the room's `onStateChange` signal. The deployed route bundle uses this signal and contains no `.onAdd()` call.
- The corrected client is deployed and Ready at `https://osogbo-life-journey.vercel.app`; the `/map` route and its route-specific JavaScript asset returned HTTP 200. Railway's configured `/healthz` endpoint returned HTTP 200 with `{"status":"ok"}`.
- After the correction, `npm.cmd run build` and `npm.cmd run typecheck` passed; the full suite passed (`npm.cmd test -- --reporter=verbose --pool=forks --maxWorkers=1`, 180 tests across 44 files), including the focused neighborhood component tests (3 tests). `node scripts/neighborhood-browser-smoke.mjs` passed movement, diagonal speed, collision, checkpoint, NPC interaction, touch movement, and pause checks.
- `npm.cmd run lint` passed with 0 errors and 15 existing Fast Refresh warnings.
- Earlier read-only production probes returned 204 and echoed unrelated origins, including on `/healthz`. Railway's configured `MULTIPLAYER_ALLOWED_ORIGINS` includes the production Vercel origin, has two entries, and contains no wildcard. Local reproduction showed Colyseus handles matchmaking preflight before the Express middleware; `server.ts` now overrides its matchmaking CORS hook and applies the origin middleware before `/healthz`. The correction was deployed to the existing Railway service. Live checks returned the configured origin for allowed requests, omitted `Access-Control-Allow-Origin` for a rejected matchmaking preflight, and returned 403 for a rejected health request. Railway reports the service Online. No authenticated room/data route was tested, and no Railway variables or services were changed.
- Railway CLI is installed and linked to the existing `multiplayer-setup` production project's `osogbo-life-journey` service. Railway reports the Colyseus service and its existing Redis database Online. The origin-policy fix was deployed to this service; no additional service or variable was created or changed.
- `node scripts/neighborhood-browser-smoke.mjs` was rerun after the Railway origin fix and passed movement, diagonal speed, collision, checkpoint, NPC interaction, touch movement, and pause checks.
- These checks verify the local browser harness, frontend delivery, Railway health, and allowed/disallowed origin responses. Alongside them, the user reports a successful two-account shared-world test and private message send; an independently reproduced authenticated production room join, multi-service routing, and live persistence remain unverified.

### Railway multiplayer preparation

- Added the Colyseus 0.18 Redis Presence and Redis Driver packages for shared multi-service matchmaking.
- Added Railway `PORT` binding on `0.0.0.0`, generated-domain room routing, and `/healthz`.
- Added a production requirement for `REDIS_URL` on Railway, with local in-memory mode retained for development.
- Browser endpoint configuration accepts a comma-separated list and retries another configured host when matchmaking fails.
- Railway does not provide sticky sessions, while Colyseus sockets must return to their room-owning process. The deployment guide therefore requires separate single-replica Colyseus services, each with an individual public domain, rather than multiple replicas behind one domain.
- At the time of this preparation update, these changes prepared the repository only; no Railway services, domains, variables, database settings, or deployments had been changed. Hosted two-client acceptance remains open.
- This update: production build passed; typecheck passed; all 180 tests across 44 files passed; lint passed with 0 errors and the existing 15 Fast Refresh warnings. Local Railway-like startup bound to `0.0.0.0`, `/healthz` returned 200, disallowed origins received 403, and a Railway environment without `REDIS_URL` failed fast as configured.
- Built-site preview returned HTTP 200 for `/`. No Redis instance or Railway environment was available, so Redis connectivity, direct multi-service room routing, and authenticated multi-client behavior remain unverified.

### Local checks

- `npm.cmd run typecheck`: passed.
- `npm.cmd run lint`: passed with 0 errors and 15 Fast Refresh warnings.
- `npm.cmd run build`: passed. Existing client chunks over 500 kB and plugin timing notices remain.
- `npm.cmd run build:public`: passed.
- Focused Vitest runs passed: `neighborhood-model.test.ts` (6), `authoritative-movement.test.ts` (6), `player-social.test.tsx` (2), and `shared-hud-database.test.ts` (12), for 26 tests across 4 files.
- The first local Colyseus startup failed because Node's native TypeScript runner could not resolve an extensionless import. `src/game/neighborhood-model.ts` now imports `../lib/city-world.ts` explicitly.
- After that fix, `npm.cmd run multiplayer:dev` started at `127.0.0.1:2567`. Read-only client probes confirmed empty-token joins and joins without an allowed Origin are rejected before Supabase access. The local server was stopped after the probes.
- `npm.cmd test -- --reporter=verbose --pool=forks --maxWorkers=1`: passed after the import fix, 180 tests across 44 files (202.88 seconds). The verbose reporter exposed progress that the earlier default-reporter runs did not show before they were interrupted.
- `git diff --check`: passed.

### Production delivery check

- Vercel reported the production deployment `osogbo-life-journey-opurvfq6j-alade017.vercel.app` as Ready and attached the `osogbo-life-journey-alade017.vercel.app` production alias.
- An authenticated read-only request returned the OSUN LIFE homepage HTML. Deployment Protection is enabled.
- This verifies frontend delivery only. It does not verify browser interaction, Supabase operations, or multiplayer behavior.

### Remaining acceptance gates

- The user reports successful two-account sign-in/shared-world testing and private message sending. Hosted Supabase migration state, RLS behavior, travel/economy RPCs, and persistence across sessions/devices remain unverified. No database changes were made.
- The hosted Colyseus health and origin checks now match the configured allow-list. Redis room coordination, multi-service routing, and independently reproduced authenticated production testing remain unverified.
- Responsive desktop/mobile rendering, accessibility, and device performance still need real browser/device checks. The local headless control smoke test includes touch input but is not a responsive UI or device test.
- Operational monitoring, routing-provider capacity/terms, and end-to-end save recovery still require a configured staging environment.

Milestone 9 is **in progress**, not complete. Production deployment readiness and local build/type/lint checks passed; the gates above remain prerequisites for release readiness.

## Baseline recorded before changes

- `npm.cmd test`: passed, 118 tests in 29 files.
- `npm.cmd run build`: passed with the Cloudflare Module Nitro target.
- `npm.cmd run lint`: failed on 9 Prettier violations in the legacy house UI/state files and reported 14 Fast Refresh warnings.
- Production client assets included a 335.2 KB entry chunk (104.8 KB gzip), a 1,068.1 KB map chunk (285.8 KB gzip), and a 915.1 KB house-scene chunk (238.7 KB gzip). The map and 3D scene are route/component split and are not part of the landing-page entry chunk.
- No Playwright, Cypress, or axe-core package is installed. Tests use Vitest/jsdom and do not exercise live Supabase or browser rendering.

## Release configuration

1. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in the build environment. These values are browser-visible; use only the Supabase publishable/anon key. Do not place a service-role key in any `VITE_*` variable.
2. Set server-only `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in the deployment platform's secret store when the server runtime needs them. Configure `CRON_SECRET` there only when scheduled endpoints are enabled. Keep `DATABASE_URL` restricted to the migration job.
3. Set a production map style in `VITE_OSOGBO_MAP_STYLE_URL`. If a Stadia key is required, `VITE_STADIA_MAPS_API_KEY` is public; restrict it to the production domain in the provider console.
4. Set `VITE_ROUTING_BASE_URL` to a supported production routing service with suitable capacity and terms. The source's `router.project-osrm.org` default is a development fallback, not a production service commitment.
5. Add the HTTPS production origin to Supabase Auth's site URL and redirect allowlist. Deploy the generated Node server output to your chosen Node hosting service and confirm HTTPS is enforced by the platform.
6. Apply all ordered SQL migrations through `0023_restore_travel_to_location_rpc.sql` through the controlled database migration workflow. `drizzle.config.ts` reads `DATABASE_URL`; the frontend does not apply migrations. Migration 0023 restores the mode-aware travel RPC and reloads PostgREST's schema cache.
7. Verify RLS and RPC behavior against a staging Supabase project with two accounts before release. The local build cannot establish those permissions.

## Manual release checklist

- At desktop and narrow mobile widths, sign in, open every primary route, reload a nested route directly, and use browser back/forward.
- On the map, test keyboard and touch movement, destination search/list fallback, provider failure/retry, multiple travel modes, and a successful/insufficient-funds trip. Confirm the server-returned arrival time and transaction match.
- Enter the home through `/home`; verify rooms, furniture, needs, cloud/local save status, offline recovery, and conflict resolution. `/house` links to the same saved interior to avoid a second active local-only house state.
- Exercise jobs, purchases, rent, and NPC interactions in staging; repeat requests and verify server-side idempotency and ownership boundaries.
- Test with browser reduced motion enabled and disabled. Enable audio explicitly, adjust each volume, and verify the game remains usable with audio blocked.
- Inspect mobile touch controls, keyboard focus order, screen-reader status announcements, and contrast with a real browser/accessibility tool.
- Review production logs after deliberately failing a map request and a non-sensitive server request; verify errors are diagnosable without logging auth tokens or private save payloads.

## Known limits to close before public release

- Phase 4.3's stall income migration `20261027104102_stall_passive_income.sql` is local only. Registered-owner/RLS, accounting and retry checks passed locally, but hosted prerequisites, independent-connection save/claim/deletion races and authenticated Market/device behavior remain unverified. See [phase-4-stall-income-implementation.md](phase-4-stall-income-implementation.md).

Phase 4.3 local checks (2026-10-27): 42 focused tests, final 16-test SQL rerun, typecheck, scoped lint, both builds, `git diff --check` and the 375px fixture passed. Full run: 670 passed / one failed, zero skipped; only the existing R3F/PlayCanvas default expectation failed. Global lint remains 335 errors / 12 warnings. The approved income policy is ₦10/server hour open, ₦100/account/Lagos earning day, retaining seven earning dates. No hosted migration or deployment occurred.

- Phase 4.2's career promotion guard and acceptance use the existing server rules. Authenticated promotion, concurrent promotion/shift operations and real-phone behavior remain staging checks. See [phase-4-career-progression-implementation.md](phase-4-career-progression-implementation.md).

Phase 4.2 local checks (2026-10-26): 27 focused tests, typecheck, scoped lint, both builds and the 375px fixture passed. Full run: 632 passed / one failed / three skipped; the renderer expectation remains unresolved, and the map-travel setup timed out before its three cases ran. Those three passed unchanged in isolation. Global lint remains 335 errors / 12 warnings. No migration or hosted change was introduced.

- Phase 4.1 party rewards require local migration `20261026162243_party_host_reputation.sql` plus the October 19 party prerequisites. It has not been applied to a hosted database. Independent-connection race/lock-wait checks and authenticated multi-player attendance remain unverified. See [phase-4-party-rewards-implementation.md](phase-4-party-rewards-implementation.md).

- Phase 3.4's Home living-cost dialog has an isolated 375px fixture; live authenticated prices, ownership and complete room/phone interactions still need staging verification. See [phase-3-living-costs-implementation.md](phase-3-living-costs-implementation.md) for the existing housing GET's rent-cycle side effect and the independent renderer-test mismatch.

Phase 3.4 local checks (2026-10-26): 27 focused cost tests, typecheck, scoped lint, game/public builds and the 375px fixture passed. Full-run snapshot: 587 passed / 2 failed; the cost-test isolation failure was subsequently corrected and passed in the focused rerun, while the renderer-default expectation remains unresolved. See the implementation report for the exact validation boundary.

- The core gameplay loop has unit/component coverage but no automated authenticated end-to-end test against a seeded Supabase project.
- Real mobile/desktop browser, screen-reader, contrast, and keyboard QA require a browser and staging account; they are not represented by a successful build.
- Live RLS, migration application, HTTPS, map-provider quotas, and cross-device persistence require staging/deployment verification.
- The current map and 3D house chunks are large when those screens are opened. They are deferred from the initial landing bundle; collect route-level load traces on target devices before choosing further optimization.

## 2026-10-25: optional home-renderer benchmark continuation

Validation: 501 tests passed across 115 files (zero skipped); typecheck, scoped lint, game build, public build and `git diff --check` passed. Global lint remains at 330 errors and 12 warnings in existing source.

R3F remains the default. The isolated PlayCanvas fixture passed at 375px and 1024px with mouse/touch commands, blocked gestures, actual GLB instantiation, and zero remaining input listeners/observers after disposal. These software-browser fixtures do not establish phone performance or authenticated housing behavior. Measurements, exact benchmark files, limitations and validation status are recorded in [playcanvas-home-benchmark.md](playcanvas-home-benchmark.md). No migrations or deployment were performed.

## 2026-10-25: approved Phase 3.1 daily tasks

Added three server-verified daily objectives to Missions: meal, study and socialize, each worth 5 XP once per account/task/Lagos day. Claim records and rewards are atomic; client state never awards XP. Existing missions and activity rules are retained. The dated migration is local only and requires the existing game baseline; the Drizzle runner does not apply it. No hosted migration, production data write or deployment occurred.

Focused checks: 22 tests across five files passed; final service rerun: 5 passed. Typecheck, scoped lint, game/public builds and the isolated 375px browser fixture passed. Final full suite: **521 tests across 118 files passed, zero skipped**, exit 0 (364.15 seconds). Fresh repository-wide lint remains at 330 errors and 12 warnings in existing source. Exact file manifest, migration prerequisites, commands/evidence and security/concurrency limits are in [phase-3-daily-tasks-implementation.md](phase-3-daily-tasks-implementation.md). Existing benchmark changes remain preserved; R3F remains the default.

## 2026-10-25: approved Phase 3.2 weekly events

Reconciled the existing three weekly events with stored server occurrences, fictional public venues, persistent attendance and validated server snapshots across the existing HUD, location page and map details. The legacy join RPC remains available; the updated UI pins an occurrence to reject delayed requests for another week. No rewards, prices, fees, mood or reputation effects were added.

Validation: 50 focused tests across seven files passed; typecheck, scoped lint, game/public builds and the isolated 375px browser fixture passed. Global lint remains at 330 errors / 12 warnings. Full suite: **541 tests across 121 files passed, zero skipped**, exit 0. The new dated migration is local only and requires the expanded-town location migration and existing game baseline. Hosted application, authenticated browser gameplay and independent-connection race checks remain unverified. Exact files, migration prerequisites and evidence: [phase-3-weekly-events-implementation.md](phase-3-weekly-events-implementation.md).

## 2026-10-25: approved Phase 3.3 daily check-in streak

Added automatic visible/online game-session check-in with server-computed consecutive Lagos days and a default 5 XP/day reward, capped at 5 with no multiplier or money. Account/day receipts, streak state and XP are atomic and replay-safe. Character recreation does not erase daily claims. Read-only snapshots never award rewards. Existing auth, daily tasks, events and renderer defaults remain preserved.

Focused checks: 20 tests across three files passed. Typecheck, scoped lint, game/public builds, `git diff --check` and the 375px synthetic browser fixture passed. Global lint reports 329 errors / 12 warnings in existing source. Full suite: **561 tests across 124 files passed, zero skipped**, exit 0 (455.98 seconds). The new dated migration is local only; hosted application, authenticated gameplay and independent-session race checks remain unverified. Exact files and evidence: [phase-3-login-streak-implementation.md](phase-3-login-streak-implementation.md).

## 2026-10-27: approved Phase 5.1 messaging hardening

Reused the existing phone messaging UI and RPC flow. Added a 16 KiB streamed payload cap and destination validation, a local SQL migration enforcing five sends per ten seconds alongside the existing twelve per minute, and account-owned offline preference queues that stop replay after a session switch or sign-out. No voice feature was added.

Focused checks: **45 tests across seven files passed**, including ten real-SQL messaging checks. Typecheck, scoped library/test/script lint, game/public builds, diff check, and the isolated 375px browser fixture pass. Including the changed `PlayerSocial.tsx` in lint reports its unchanged presence-query `any`; global lint remains 335 errors / 12 warnings. Full suite: **699 passed / 1 failed across 137 files, zero skipped** (737.29 seconds); the sole failure is the existing R3F-default expectation against the application's PlayCanvas default. Details: [phase-5-messaging-implementation.md](phase-5-messaging-implementation.md). Hosted migration application, authenticated multi-account browser checks, independent-connection contention, and physical-phone validation remain release checks; no hosted SQL or deployment occurred.

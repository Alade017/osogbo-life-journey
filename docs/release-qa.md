# Milestone 9 release QA

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

- The core gameplay loop has unit/component coverage but no automated authenticated end-to-end test against a seeded Supabase project.
- Real mobile/desktop browser, screen-reader, contrast, and keyboard QA require a browser and staging account; they are not represented by a successful build.
- Live RLS, migration application, HTTPS, map-provider quotas, and cross-device persistence require staging/deployment verification.
- The current map and 3D house chunks are large when those screens are opened. They are deferred from the initial landing bundle; collect route-level load traces on target devices before choosing further optimization.

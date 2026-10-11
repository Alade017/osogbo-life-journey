# Milestone 12 release QA

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
- These checks verify the local browser harness, frontend delivery, Railway health, and allowed/disallowed origin responses. An authenticated production room join with two independent accounts, multi-service routing, and live persistence remain unverified.

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
- An authenticated read-only request returned the OSOGBO LIFE homepage HTML. Deployment Protection is enabled.
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

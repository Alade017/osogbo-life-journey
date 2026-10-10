# Milestone 12 release QA

## Milestone 9 verification update — 2026-10-11

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

- Authenticated Supabase checks with two accounts, including RLS, migration state, realtime subscriptions, and travel/economy RPCs, remain unverified. No database changes were made.
- The Colyseus server still lacks a configured hosted endpoint and authenticated two-client production/staging verification.
- Desktop/mobile rendering, accessibility, touch behavior, and device performance require real browser/device checks.
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

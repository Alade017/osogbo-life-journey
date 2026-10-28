# Phase 5.2 — player stall discovery

The existing phone market now has a Player stalls tab. Visitors browse other players' open stall signs, owner display names and goods descriptions. Visitor cards are read-only; My Stall, passive income, NPC stalls and City Shops remain on their existing flows.

## Data and access boundaries

Local migration `20261028143246_public_player_stall_discovery.sql` requires the phone-community baseline (`0060_phone_community_apps.sql`) and existing passive-income migration (`20261027104102_stall_passive_income.sql`). It replaces the permissive open-stall raw SELECT policy with owner-only SELECT, revokes browser write privileges, retains owner reads, and adds a partial index for open-stall paging.

The new `get_public_player_stalls(uuid,integer)` RPC requires a registered account and character. It is STABLE, uses an empty search path, has explicit authenticated-only execution permission, and returns only `id`, `ownerName`, `name`, and `goods`. It joins the stall to its actual owning character, excludes the caller's own stall and closed stalls before paging, and returns a next cursor only when another eligible row exists. Defaults are 20 rows, a hard maximum of 50, and deterministic UUID keyset order. No account/character IDs, location, income, wallet or private profile fields are returned. No new sign column, stall ownership model, map coordinates or visitor transaction was introduced.

`save_player_stall` and passive-income RPC definitions are unchanged. Discovery reads do not settle income, count visits, or award rewards. Raw stall rows remain available to their owner through the existing phone and property queries, and administrative service-role access is retained.

## Client behavior

`public-stall-service.ts` validates the page projection, UUIDs, sizes, cursor progress, duplicates and unexpected fields. Requests contain a cursor and page limit only; account identity is not an RPC parameter. Session checks before and after the RPC reject responses crossing an account switch.

`PublicStallDirectory` uses an account-keyed infinite query, mounts only on its selected tab, refreshes every 30 seconds while visible/online, and supports focus/manual refresh, pagination, empty/error/retry states and cached offline listings. The last-fetched time is displayed in Lagos time. Visitor text is rendered as text and wraps long unbroken signs and goods descriptions. Confirmed owner saves invalidate the directory query. A missing listing migration does not block My Stall or City Shops.

## Validation

- Focused acceptance: **50 passed across eight files**. The 23 new checks cover real-SQL projection/pagination/privacy and permissions, server-derived owner saves/open/close, absence of discovery side effects, strict service parsing/session isolation, and directory pagination/retry/offline/account/visibility behavior. Existing passive-income acceptance now applies the new policy migration before its 16 checks. Existing market/community/preview/property rent checks also pass.
- The isolated browser fixture (`node scripts/stall-discovery-browser-check.mjs`) passes at 375px with the real phone market, directory/service, income component and styles, using synthetic auth/RPC/query data. It verifies lazy tab loading, paging, long unbroken text, offline cache, unavailable listing with City Shops still usable, empty listings and refresh. No horizontal overflow was observed; screenshot `.smoke/stall-discovery-375.png` was visually reviewed. This is not authenticated hosted gameplay verification.
- TypeScript, scoped lint (all changed component/library/test/script files), game/public production builds and diff checks pass. Nitro needed an unsandboxed retry for its existing user-profile `readlink` restriction. The public JS remains 228.29 kB (71.03 kB gzip). Repository-wide lint remains **335 errors and 12 warnings**, matching the pre-change baseline.
- After the final RPC optional-argument correction and table-privilege refinement, service tests pass **10/10**, and directory/income database tests pass **24/24**.
- Final full suite: **722 passed / 1 failed across 140 files, zero skipped**, exit 1, 726.51 seconds. The sole failure is the existing `house-room-renderer.test.tsx:49` expectation that the renderer defaults to R3F; the application defaults to PlayCanvas. No renderer files were changed. All new directory and existing passive-income checks pass in this run.

Evidence logs: `.smoke/stall-discovery-{focused,service-final,database-final,typecheck,lint,global-lint,game-build,public-build,browser,full-tests}.log`.

Focused command: `npx.cmd vitest run src/test/public-stall-database.test.ts src/test/public-stall-service.test.ts src/test/public-stall-directory.test.tsx src/test/stall-income-database.test.ts src/test/phone-market-features.test.ts src/test/phone-community-database.test.ts src/test/course-and-stall-apps.test.tsx src/test/property-rent-cycle.test.ts --maxWorkers=1`.

## Release boundaries

No hosted migration, production data write, deployment, commit or push was performed. Verify the target migration prerequisites, then exercise owner/visitor/anonymous sessions against the actual RPC and raw table permissions before release. The policy intentionally removes visitor raw-table access; any external clients depending on that access must use the restricted projection. Test a physical phone separately. PGlite does not establish independent-connection behavior.

Official reference checked: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). The tool could not read the changelog Markdown endpoint, so no changelog verification is claimed. Existing historical migrations and existing owner gameplay functions were preserved.

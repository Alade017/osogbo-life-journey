# Phase 3.1 daily tasks

Date: 2026-10-25, Africa/Lagos. Scope approved by the owner after reviewing `phase-3-daily-life-plan.md`: daily tasks only. R3F stays the default; events, streaks, living-cost UI and later phases are deferred.

## Behavior and architecture

Missions now includes three daily objectives: complete a meal (`eat`), study (`study`), and socialize (`socialize`). Each gives 5 XP once per account/task/Lagos day, for a maximum of 15 XP/day and no money. Existing activity requirements, costs and lifetime missions are preserved.

`get_daily_tasks()` derives account/current character and reads existing server simulation receipts. The response supplies its Lagos date, server timestamp, next reset and task states. `claim_daily_task(task key, displayed date)` rejects stale dates and missing completion evidence. It locks the account and current character, captures the current clock after lock waits, and records a unique account/date/task claim atomically with `_grant_xp` and lifetime-mission recalculation. Retries return the stored claim without paying again, including after the rewarded character is deleted. No client progress, player ID, reward amount or clock is accepted.

RLS permits enabled-catalog reads and own-claim reads; browser writes are revoked. Both RPCs reject unauthenticated and anonymous users. Privileged functions use an empty search path and qualified references. New receipt timestamps are stamped by an insertion trigger using the actual database clock: transaction start time can predate a lock wait across midnight. Existing receipts are not rewritten.

The account-scoped query refreshes after successful activity completion, claims, focus and server reset; stale-day failures refresh without submitting a replacement-day claim. Pending/double-click and offline controls suppress duplicate submissions. Rewards display only after server confirmation. Missing-RPC responses display a user-facing unavailable message rather than schema-cache details.

## Migration and data boundary

New file: `supabase/migrations/20261025092415_daily_life_tasks.sql`, generated using installed Supabase CLI 2.121.0. It requires the existing game baseline through Drizzle 0076 (excluding the data-only hosted cleanup 0075 in empty local tests). The local PGlite suite applies the canonical Drizzle schema chain and then this exact dated migration once. Existing overlapping Supabase housing migrations are not replayed over that baseline. The migration is not copied to Drizzle or added to its journal.

The existing `sync-database-migrations.mjs` runner reads the Drizzle journal and does **not** apply this dated migration. Before any separately approved hosted application, reconcile the real target ledger/prerequisites and the dated migration ledger. No hosted migration, CLI reset, database connection credential read or production data write was performed. Schema types were updated from the reviewed migration; they were not generated from a hosted schema.

## Validation

- Focused: 22 tests across 5 files passed. Covers the existing authoritative completion command, all rewards, retries, midnight boundaries, timestamp insertion, actual role/RLS isolation, blocked writes, anonymous rejection, rollback, character recreation, parser validation, pending/error/offline UI, cache isolation and existing mission chips. The final service-only rerun passed all 5 tests, including the missing-RPC message.
- Final typecheck and scoped lint passed, both exit 0, with zero scoped lint errors/warnings. Production game build (client, SSR and Nitro) and public build passed; existing large-chunk warnings remain. Public JS: 228.29 kB / 71.03 kB gzip. Final full suite: `npx.cmd vitest run --maxWorkers=1 --reporter=verbose` passed **521 tests across 118 files, zero skipped**, exit 0, 364.15 seconds (`.smoke/daily-tasks-full-tests-final.log`).
- Real local Chrome fixture at exactly 375px passed: three cards, one claim on double click, confirmed XP, no horizontal overflow, no page errors or external requests. Screenshot: `.smoke/daily-tasks-375.png`; log: `.smoke/daily-tasks-browser.log`. Uses the actual component and generated design-token/Tailwind CSS with synthetic RPC responses. It is not an authenticated gameplay test. The fixture serves CSS without remote font imports; production styles remain unchanged.
- Initial browser attempts exposed fixture issues: an alias did not substitute the RPC client and issued a read-only missing-function request; no claim ran. Corrected to an explicit virtual-client alias. Chrome's desktop window minimum produced 500px, corrected with CDP viewport emulation. Remote font imports were subsequently removed from fixture responses, with external requests treated as failures.

The database suite applies the unmodified migration, then substitutes only the clock function calls in this disposable database for deterministic boundary tests. Production has no clock parameter, GUC override or test-clock helper. Existing `_grant_xp` is restored after the rollback fault injection. Tests use actual PostgreSQL role changes for RLS, not SQL substring assertions.

Diagnostic runs: the first database run had 6 passes / 2 failures caused by missing lifetime-mission fixture seeding and a fault-injection function's parameter names; both fixtures were corrected. The first client run had 9 passes / 1 failure from checking an asynchronous mutation before invocation; the test now waits for that observable call. An initial full run ended at 520 passes / 1 failure after the unavailable-message assertion changed while the worker retained the earlier service transform. The final service-only run passed; the source was then frozen for a fresh full rerun, which passed all 521 tests. No timeouts were raised or assertions weakened to mask these failures.

Known validation limits: PGlite is a single connection, so real cross-connection races and a lock wait spanning midnight remain unverified. The account lock, unique constraint, atomic payout and post-lock timestamp are implemented and retry-tested; this is not independent-session concurrency proof. Hosted RLS/RPC deployment, authenticated browser integration, actual phone behavior and accessibility-device QA remain unverified. The fresh `npm.cmd run lint` check reports unchanged existing debt: 330 errors / 12 warnings (exit 1). All edited source/test/script files pass scoped lint.

Reviewed upstream guidance: [database functions and function privileges](https://supabase.com/docs/guides/database/functions), [local migration files](https://supabase.com/docs/guides/local-development/database-migrations). The local CLI generated the timestamped filename; it did not apply the migration remotely.

## Exact implementation files

- `supabase/migrations/20261025092415_daily_life_tasks.sql`
- `src/lib/daily-task-service.ts`
- `src/components/game/DailyTasks.tsx`
- `src/components/game/GameTimeProvider.tsx`
- `src/routes/_authenticated/_game/missions.tsx`
- `src/integrations/supabase/types.ts`
- `src/test/daily-task-database.test.ts`
- `src/test/daily-task-service.test.ts`
- `src/test/daily-tasks.test.tsx`
- `src/test/game-time-provider.test.tsx`
- `scripts/daily-tasks-browser-check.mjs`
- `docs/phase-3-daily-life-plan.md`, this report, `docs/release-qa.md`

Existing uncommitted home-benchmark report, harness and release notes were preserved. No dependencies, commits, branches, pushes, PRs, merges or deployments were introduced.

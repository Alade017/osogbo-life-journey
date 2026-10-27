# Phase 4.3 stall income: implementation and evidence

Date: 2026-10-27, Africa/Lagos. The owner approved `phase-4-stall-income-plan.md`, including its new balance rules. Audit baseline `936ede86`; only the proposed plan was untracked. Existing career, party, renderer and routing work is preserved.

## Delivered game loop and balance

The existing saved stall earns **₦1 per 360 eligible server seconds (₦10/hour)** while its saved status is open, online or offline, with a **₦100/account/Lagos earning-day cap**. Only today and the previous six Lagos earning dates are claimable; older amounts expire. Maximum outstanding under version 1 is ₦700. Earnings are not based on visitors, goods, themes, personal simulation time or browser presence.

First post-feature Save enrolls a stall from trusted time. Existing open stalls get no historical windfall. Save settles the old interval before changing open status; closing stops future earnings but preserves materialized, unexpired account amounts. Renaming/saving/toggling does not reset daily caps or rounding residues. Reads preview without enrolling, moving the cursor or paying money. Claims explicitly settle and pay through the existing `_credit` wallet/transaction helper, which retains its normal wealth update. No fees, company-income changes, XP or reputation rewards were added.

The income panel uses persisted server state independently of unsaved form toggles. It shows policy, enrollment/open status, timestamped estimate, earning-day cap progress, latest confirmed receipt, offline/error/pending/nothing-to-claim/retry states. Saving invalidates income and owner stall/property queries. Claim confirmation refreshes wallet, transactions, character and income queries. It never sets an optimistic balance.

## Migration and accounting

New local migration: `supabase/migrations/20261027104102_stall_passive_income.sql`. Requires the existing game/auth/wallet baseline and `0060_phone_community_apps.sql`, including `player_stalls`, `_credit` and transactions. It preserves the existing `save_player_stall(text,text,boolean)` signature and adds `get_stall_income()` and `claim_stall_income(uuid)`.

The Supabase CLI generated the local filename after sandbox telemetry restrictions required an escalated invocation. No database was contacted or migration applied by that command. Generated CLI-version cache noise was restored. Published migrations and the Drizzle history are unchanged; verify the actual target ledger/prerequisites separately before any authorized deployment.

- `stall_income_policy`: version 1, activation, fixed constrained rate/cap/retention. Browser configuration reads/writes are denied. Rates cannot silently reprice settled earnings; a future policy version/change needs a separately reviewed prospective migration, not an in-place client setting.
- `stall_income_state`: account-owned enrolled stall ID, saved open state and settled cursor. No character/stall FK cascade: account caps must survive recreation.
- `stall_income_days`: account/date primary key; accumulated eligible **integer microseconds**, capped at 36,000 seconds/day, plus amount already paid. Whole-Naira rounding happens after aggregation. Sub-unit time survives repeated same-day requests but does not cross earning dates.
- `stall_income_receipts`: account/request UUID primary key; original character/transaction references set null on deletion; immutable JSON confirmation remains available for stable replay. A different request ID cannot repay amounts already marked paid.

Intervals split at explicit Lagos midnight boundaries, and settlement loops over at most seven dates, clipping long absences rather than reclassifying expired time. The cursor acts as a monotonic high-water mark on mutations; backwards clock movement cannot add duplicate elapsed time. An already paid day remains capped after reopening or character recreation.

Deletion/replacement is conservative: a deleted stall's **unsettled gap is discarded**. A replacement enrolls from its new trusted Save time. Previously materialized, unexpired account amounts remain claimable into the current character's wallet. Historical receipts can be replayed without a new character, without another payout. There is no deletion trigger that reverses lock order.

Save/claim use character → account advisory serialization → state → owned stall → affected ledger → wallet ordering. Trusted write time is captured after locks. Receipt, paid totals, wallet credit and transaction commit atomically; failure rolls everything back. Zero claims produce stable non-paying receipts and no zero-value wallet transaction. Same-request replay returns the saved confirmation before settling more time.

The pure preview helper and read RPC are `STABLE`; read time is `statement_timestamp()`. This keeps cursor, ledgers and latest receipt in one statement view without payout locks. Writes remain volatile and use post-lock `clock_timestamp()`. Guidance checked: [PostgreSQL function snapshots](https://www.postgresql.org/docs/current/xfunc-volatility.html), [Supabase function security](https://supabase.com/docs/guides/database/functions). The Supabase changelog markdown reader failed on its content type; no changelog contents are claimed verified.

## Security and files

New state/day/receipt tables have own-account SELECT policies and no authenticated write grants. Policy/configuration and private helpers are inaccessible to browser roles. Public RPCs derive the account/current character, reject signed-out/anonymous users, use fixed empty search paths and revoke public/anon execution. The browser supplies only a request UUID for a payout, never owner, amount, rate, seconds or time. Public stall discovery rows do not gain private earnings columns. No admin key is imported into the new client service.

- `src/lib/stall-income-service.ts`: typed RPC boundary and runtime estimate/receipt validation; friendly missing-migration and retry errors.
- `src/components/game/StallIncomePanel.tsx`: owner-keyed reads, immediate pending guard, stable retry UUID, no offline mutation queue, confirmed toast and lost-response recovery. A recovered receipt suppresses the stale failure without another claim/toast. Unmounted owners do not receive late toasts.
- `src/components/game/phone/PhoneMarketApp.tsx`: panel inside the current lazy Market screen and save invalidation. Existing shops, local themes and NPC stalls are retained.
- `src/integrations/supabase/types.ts`: new RPC signatures.
- `src/test/stall-income-database.test.ts`, `stall-income-service.test.ts`, `stall-income-panel.test.tsx`: real SQL and client acceptance.
- `scripts/stall-income-browser-check.mjs`: isolated real component/style/service fixture with synthetic RPC data.
- Approved plan, this report and release QA: scope and evidence.

No new dependency, provider, browser payout timer or competing stall/company system.

## Verification

Focused command:

```powershell
npx.cmd vitest run src/test/stall-income-database.test.ts src/test/stall-income-service.test.ts src/test/stall-income-panel.test.tsx src/test/phone-market-features.test.ts src/test/phone-community-database.test.ts --maxWorkers=1
```

Result: **42 passed across five files**, exit 0 (33.39 seconds), no skips. This includes 16 SQL checks, 11 service checks, eight UI checks and seven existing market/phone checks. After the read snapshot refinement, the final SQL-only rerun passed **all 16**, exit 0 (10.52 seconds).

SQL coverage includes enrollment/activation, no read reward, microsecond boundary, repeated saves/claims, close/reopen, Lagos midnight, daily cap, offline/long absence, seven-date expiry, backwards clock, owner/RLS/helper denial, anonymous/signed-out callers, rollback, failed saves, missing policy, closed claims, recreation/cap persistence and discarded deleted-stall gaps. Fixtures alter time only inside the local test database; production has no caller clock override.

Client checks verify no claim on mount, same-tick double click protection, UUID reuse on retry, recovered commits without duplicate toast, offline protection, saved rather than preview state, zero earnings, missing RPC, unmount and account-cache isolation. Tests wait for loaded/enabled controls rather than clicking a loading-disabled button.

The 375 × 812 browser fixture passed unenrolled/open/offline/pending/claimed/unavailable/retry states, one UUID-only claim, no overflow and no external requests. Screenshot `.smoke/stall-income-375.png` was inspected. This is a synthetic isolated panel, not authenticated hosted Market integration or a real Android measurement.

Typecheck, scoped lint, game build, public build and `git diff --check` passed. Global lint remains **335 errors / 12 warnings**, matching the prior repository baseline; changed stall files pass scoped lint. Existing large-chunk warnings remain; public JavaScript is 228.29 kB / 71.03 kB gzip. Logs are ignored local `.smoke/stall-income-*.log` artifacts.

Full regression: `npx.cmd vitest run --maxWorkers=1 --reporter=verbose` → **670 passed / one failed**, 135 files (134 passed / one failed), zero skipped, exit 1 (603.64 seconds). It ran after builds and lint completed, with source frozen. All stall checks passed. The sole failure is the existing `house-room-renderer.test.tsx` assertion expecting R3F while the owner's renderer contract defaults to PlayCanvas. That code and expectation were preserved; no green full-suite claim is made. The earlier map setup/social timeout failures did not recur in this run.

## Limits and release boundary

The database harness uses single-connection PGlite and the existing Drizzle baseline plus this migration. PostgreSQL/Docker executables were not found on PATH. Independent-connection save/claim races, real waits across midnight, deletion contention, hosted RLS/RPC/schema ledger and target-device behavior remain unverified. Lock ordering, exact accounting and receipts are implemented; local sequential tests do not certify concurrency.

No hosted SQL/data write, deployment, branch, commit, push, PR, merge or history rewrite was performed. Company/investment behavior, multiple stalls, acquisition fees/upgrades, public visitor interactions and Phase 5 onward remain deferred. The user's current work and renderer default are preserved.

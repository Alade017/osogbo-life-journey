# Phase 4.3: capped stall income

Date: 2026-10-27, Africa/Lagos. Status: approved by the owner and implemented locally; see `phase-4-stall-income-implementation.md` for evidence and limits. The proposal below is retained. Audit HEAD `936ede86` (`implemented career progression`); working tree was clean during the audit. Preserve the owner's commits and all subsequent work.

## Verified source findings

- `drizzle/migrations/0060_phone_community_apps.sql` provides `player_stalls`, unique per user and per character, and `save_player_stall(text,text,boolean)`. Saving validates identity and text and upserts name/goods/open status. There is currently no acquisition charge in this RPC; a saved stall must not be presented as a purchased asset.
- The same migration exposes active/public stall reads and owner reads through RLS, with authenticated SELECT and no direct browser writes. The save RPC is the existing owner-mutation entry point to preserve.
- `PhoneLauncher.tsx` lazily routes Market and Market Stalls to `PhoneMarketApp.tsx`. That app reads the current character's stall and calls the save RPC. It has no server-backed accrued earnings or claim flow. Its theme is a local preview, not income eligibility.
- `/property` lists the owner's saved stalls using the same table. `CourseAndStallApps.tsx` is explicitly a local preview and not a durable earnings source; do not attach money to it or introduce a competing stall table.
- `0032_player_businesses_and_investments.sql` and `business-service.ts` already implement company earnings/investments. Company ownership, shares and accrual are separate from these saved stalls. Reuse trusted wallet/transaction and request-receipt patterns; do not classify company dividends as existing stall income or change them.

These are repository findings, not a hosted schema audit. No new SQL or application code has been written for this slice. Root `AGENTS.md` requires approval of architecture/game-loop changes first.

## Proposed balance and game loop

Proposed new simulated-NGN income: **₦10 per real server hour open**, accrued as **₦1 per 360 eligible seconds**, capped at **₦100 per account per Africa/Lagos earning day**. Retain only **today and the six previous Lagos earning dates** for unclaimed income: maximum outstanding payout ₦700. Older unclaimed days expire rather than rolling into today's allowance. This is a new balance rule requiring explicit approval with this plan.

The saved stall must be open and owned by the account for elapsed time to qualify. Accrual starts no earlier than feature activation and the first authoritative enrollment/save for that stall; no historical windfall. Existing open stalls begin tracking on their first post-feature save, with explanatory UI. Creating/saving/renaming a stall adds no fee. Closing pauses future accrual but preserves already earned, unexpired amounts. Renaming, repeated saves and rapid close/open cycles must not reset daily totals or rounding residues.

“Offline income” means the open stall keeps earning without a connected browser. The same rule applies while online; do not attempt to infer eligibility from unreliable presence/disconnect events. Personal simulation time, browser time, simulated shop hours, visitors and theme selections do not determine this payout.

Loop: save/open the existing stall → server records an accrual cursor → leave or continue playing → reopen Market → read a server estimate and its timestamp → explicitly claim → server settles elapsed open time, validates ownership/account limits and atomically credits the existing wallet → show confirmed amount and refresh canonical wallet/transactions/stall data. No client timer awards money and no read RPC credits it.

## Accrual and persistence

Use a new dated Supabase migration after approval. Do not edit 0060 or 0032 or duplicate this schema into the Drizzle history. Confirm the local runner and prerequisites before generating it; no hosted application is authorized.

- Server-owned rate/cap/activation policy with an explicit version. Initial policy is the proposed 10/hour, 100/day and seven earning dates. Preserve the policy used for settled periods; future balance changes require prospective versioned application, never repricing old time at claim.
- Account-owned accrual state identifies the enrolled saved stall, its open/closed state and last-settled trusted timestamp. No browser UPDATE grants. Reads compute a bounded preview without moving the cursor or minting currency.
- Account/date ledgers accumulate eligible open seconds and already-paid amounts. Split intervals at Lagos midnight. For each day, earned amount is `min(100, floor(totalEligibleSeconds / 360))`; claimable is earned minus paid, limited to retained dates. Round after accumulating seconds, not on each request. Fractional seconds/remainders must survive frequent saves/claims within a day; sub-unit remainder does not carry across earning days. Retain paid/cap evidence so reopening or character recreation cannot reset it.
- Settlement processes only the retained seven dates, clipping old cursor intervals at the earliest retained midnight. Expired time is discarded, not reclassified as today's earnings. Bound ledger counters/amounts with appropriate integer constraints and indexes on account/date.
- Account state/ledger must survive character deletion so accrued-day caps cannot be reset. A newly created character/stall must enroll from the new trusted time; never accrue a deleted stall's unsettled gap onto a replacement. Already materialized, unexpired account earnings may be claimed into the account's current character wallet. Missing/deleted stall means no further accrual. Document this distinction in tests; avoid cascading away payout/cap history through a stall/character FK.

The exact schema and receipt layout should be resolved against current wallet constraints during implementation. Keep account identity derived from authentication throughout; the browser never submits rate, elapsed seconds, balance, account ID or a trusted clock.

## RPCs, ownership and transaction boundary

Preserve the existing `save_player_stall` signature. In a new migration, wrap/replace its implementation so it serializes owner state, settles the old open interval before applying a change and persists the new cursor/open state in the same transaction. A failed save must not create a partial earning transition. First enrollment or a replacement stall starts from the trusted enrollment time. Closing/opening does not automatically pay money.

Add an owner snapshot RPC returning server time/date, policy, enrolled/open state, unexpired claimable amount, earning-day cap progress and recent own receipt information. It may expose last-updated timestamps and reasons such as closed/not enrolled/unavailable. No privileged public view or other owners' earnings.

Add a claim RPC taking a request UUID only. Resolve registered account/current character/wallet from the session. Use the existing economy receipt mechanism or an account-keyed receipt linked to its canonical transaction; account-scoped replay evidence must survive character recreation. Verify exact existing FK/delete behavior before choosing the receipt store. Replay returns the original result and never settles or pays twice. New claims with different request IDs also cannot duplicate already-paid ledger amounts.

Use one documented lock order across save/claim paths, consistent with existing character/wallet operations: current character first, then account serialization/accrual state, owned stall, affected date ledgers and wallet. Capture `clock_timestamp()` after lock waits, split/settle bounded intervals, compute available amount, update paid totals, credit through the established wallet helper/transaction pattern and record the receipt atomically. No external calls while locks are held. Reads must not need payout locks. Resolve character/stall deletion and replacement conservatively; do not add a deletion trigger that reverses the lock order.

A zero-claim request should return a non-paying server result or clear “nothing to claim” state without inserting a zero-value wallet transaction. Pin a new UUID per deliberate claim attempt; a failed/lost response retry retains it. If the server committed but the response was lost, the snapshot/receipt must recover that confirmation without a duplicate toast or implicit new claim. No client optimistic credit. Whole safe-integer amounts and unchanged game NGN formatting are required.

Enable RLS on new exposed state/ledger/receipt tables; own reads only, no browser writes. Fix privileged function search paths, revoke public/anon execution, grant narrowly to authenticated and reject anonymous accounts. Administrative configuration is not browser-writable. No service/admin key in the client. Verify legacy helper grants rather than assuming underscore names imply privacy.

## UI and expected files

Add a compact income panel to the existing saved-stall area of `PhoneMarketApp.tsx`, with a typed service and account-scoped query key. Show rate, earning-day cap, enrollment/open status, server-estimated claimable amount and seven-date expiry policy. Clearly label the estimate's timestamp and cached/offline state. Display pending, nothing earned, confirmed, missing-migration and retry states independently of shops/NPC stalls. Opening the app must not save, open or claim automatically.

Reuse current stall-save mutations and query invalidation, including owner property listings where appropriate. Preview form toggles are not server-confirmed open state until Save succeeds. Claim actions must use the persisted snapshot, not unsaved form choices. Keep the existing lazy phone entry point, 375px layout, keyboard access and design tokens. No new dependency, global clock/provider, new public stall marketplace or visitor interaction.

Expected files: a new dated migration; typed stall-income service; small income panel; minimal Market save/invalidation integration; generated RPC types; database/service/component tests; an isolated browser fixture; implementation/QA documentation. Exact names follow current source on approval. Public stall discovery/owner display (Phase 5.2), acquisitions/upgrades/multiple stalls, company accrual and investments remain outside scope.

## Acceptance checks

- No accrual before activation/enrollment, while closed or after a deleted stall; open offline periods work without browser events. Non-owner/unauthenticated/anonymous requests cannot read private earnings or claim them.
- Seconds just below/at 360; frequent small claims/saves equal one long interval; no fraction inflation through toggles. Split midnight intervals into the right earning dates, with 100/day cap and no reclassification by claim date.
- Current plus six previous dates only; long absences have bounded processing and expired time does not backfill. Maximum eligible outstanding 700 at the proposed policy. Server clock moves backwards conservatively and never generates negative/duplicate time.
- Same request replay, different concurrent request IDs, repeated claims, close versus claim, replacement/deletion and account cap persistence. Wallet, ledger and receipt rollback together on failure; exact one canonical transaction per positive payout.
- Actual RLS role checks and direct-write/helper denial. Independent-connection locking/race tests if local PostgreSQL is available; single-connection PGlite is not concurrency proof. Record unverified cross-connection waits instead of claiming them passed.
- Service parsing, no amount/time/owner parameters, stable retry UUID, pending double-click guard, offline queue prevention, canonical wallet refresh, lost-response recovery and account-switch isolation.
- Focused checks, typecheck, scoped/global lint, game/public builds, full regression and real-component/style 375px browser fixture. Keep unrelated renderer and load-sensitive test findings visible; no broad timeout increases or weakened assertions.

## Approval boundary

Approve **Phase 4.3 only**, including this new income balance, open-state rule, earning-day caps, seven-date retention, account persistence, local migration and acceptance work. The daily cap belongs to earning days, not claim days. No fee or company-system change is proposed.

This turn adds only this plan and runs `git diff --check`; no new implementation test results are claimed. No application/SQL edits, dependency installation, Git writes, hosted data changes or deployment. Later phases remain deferred. Approval is required by root `AGENTS.md` before implementation.

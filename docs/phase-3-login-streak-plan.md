# Phase 3.3 login streaks

Date: 2026-10-25, Africa/Lagos. Status: source audit and architecture/reward proposal following the owner's “proceed”. The owner subsequently approved this plan, authorizing Phase 3.3 only. See `phase-3-login-streak-implementation.md` for implementation and evidence; the original proposal below is retained.

## Verified baseline

Audit started with a clean working tree at owner commit `54fae943`. Source and migration searches found no complete login-streak implementation. Authentication is handled by `AuthCard`, username server handlers, OAuth/password flows and the authenticated route's `getUser()` check. Root auth events invalidate route/query state and clear caches on sign-out; they do not award streak rewards.

The game layout loads the current character, then mounts the shared game shell. It is the appropriate place for a small check-in controller after a playable character is available. Keep reward logic out of auth subscriptions and login forms so password, username, OAuth and restored sessions use the same flow.

Phase 3.1 already implements server-derived Lagos dates, account-scoped daily receipts, account/character locking, `_grant_xp`, lifetime-mission recalculation, RLS and typed query validation. Reuse those patterns, not its task table or task eligibility: check-ins and completed activities are distinct records. Phase 3.2 remains unchanged. The earlier 541-test pass is historical evidence, not a check of this proposal. No hosted schema or ledger was inspected.

## Proposed product and reward rules

- A qualifying login means opening the authenticated game with a registered account and a playable character. A restored session qualifies; signing out and in again is unnecessary. Anonymous accounts and accounts without a character do not qualify.
- A visible, online session can check in on the next Lagos day after refreshing server state. Hidden/offline tabs do not queue check-ins or claim missed days. The existing inactivity sign-out remains unchanged.
- First check-in: streak 1. If the last check-in was yesterday in Lagos, add one. If any calendar day was missed, the next check-in starts at 1. Repeated check-ins today retain the same count.
- Award **5 XP once per account per Lagos day**, with no money, multiplier or milestone payout. Streak length is a counter, not a progressively larger reward. Proposed new balance ceiling: 5 XP/day from check-ins; combined with the three approved daily tasks, at most 20 XP/day from these two features. Existing jobs, missions and other reward systems are unchanged.
- Preserve account claims and streak state if a character is recreated. A new character cannot claim a second reward for the same account/day. Do not backfill historical logins or award offline/missed-day bonuses.

These are proposed rules, including the definition of a qualifying login and the 5 XP balance change; approval of this plan approves them explicitly.

## Architecture and game loop

Loop: playable game shell becomes visible/online → fetch authoritative streak snapshot → if today's check-in is unclaimed, submit its server-provided date → server validates and commits the claim, streak and XP atomically → refresh character, missions and streak state → show confirmed status. A stale-date rejection refreshes first; only a still-visible/online session may then attempt the newly returned date. There is no automatic replay of an old date as a different day's claim.

Propose two small server-owned tables: `login_streak_state`, keyed by account ID, with last checked-in Lagos date and streak count; and `login_streak_claims`, uniquely keyed by `(user_id, lagos_date)`, with resulting count, XP snapshot, server timestamp and rewarded character reference. Character deletion sets the receipt's character reference null instead of deleting the account/day claim. Use the existing account/profile ownership boundary and appropriate foreign-key indexes. A server-owned bounded reward setting defaults to 5 XP and may not exceed 5 in this slice.

`get_login_streak()` derives account/current character and returns server time, Lagos date, next reset, effective streak, today's claim status and configured XP. A missed-day snapshot must not imply the old streak is still consecutive. No progress is inferred from browser storage, auth-event frequency or personal simulation time.

`check_in_login(p_date date)` accepts only the date returned by the snapshot. Reject unregistered/anonymous users, missing characters and stale dates. Acquire the per-account transaction lock, resolve/lock the owned current character in the established lock order, then capture `clock_timestamp()` after waits. Return an existing same-day receipt without advancing the streak or granting XP again. For a new claim, compute the count from stored server dates, insert the unique daily receipt, update streak state, call `_grant_xp` and recalculate lifetime missions in one short transaction. Any helper failure rolls back all three changes. Return a stable receipt plus an explicit newly-awarded/duplicate flag so duplicate effects and success notifications are suppressed.

Enable RLS on both tables, allow authenticated users to read only their own rows, and revoke direct browser writes. Use direct ownership policies with `(select auth.uid())`; do not call a helper whose client EXECUTE grant is revoked. Privileged functions need fixed safe search paths, qualified references, narrowly granted execution, session-derived identity and the existing registered-account check. Clients cannot supply account/character IDs, streak counts, rewards or trusted timestamps. There is no production clock override or browser-accessible reward helper.

## Client integration

Add a typed streak service with validated snapshots/receipts and account-scoped cache keys. A small controller in the playable game shell coordinates a read and an explicit mutation; a query read itself must never award XP. Prevent parallel local submissions, but rely on server transactions and uniqueness across devices and React remounts. Token refreshes and repeated focus events may refresh state; they must not create additional daily rewards.

Refresh on visible focus/reconnect and near the reset interval supplied by the server. Refetch before a next-day mutation; do not derive authoritative dates using the browser clock. Disable background/offline mutation queuing and automatic unbounded retries. Network failures leave the existing game usable and expose a retry action in the streak summary. A lost success response is recovered through the stored server receipt. Missing migration/RPC responses get a user-facing unavailable message.

Display a compact daily check-in summary next to Daily tasks on Missions, using existing tokens and accessible status text. Show the confirmed streak count, today's received/unavailable status, 5 XP reward and Lagos reset rule. Notify only on a confirmed newly awarded claim, once per receipt; never optimistically increment XP or the streak. Invalidate canonical character and mission queries after confirmed rewards. No needs-rail redesign, new auth flow, household UI, phone app or renderer change is proposed.

## Expected implementation and migration boundary

Expected additions: `src/lib/login-streak-service.ts`, a focused check-in hook/controller, a small Missions summary component, database/service/controller/component tests, and one new dated migration generated by the installed Supabase CLI after approval. Expected edits: the playable game layout, Missions page, database types and QA documentation. No dependency is expected.

Local acceptance applies the reviewed canonical game schema and relevant dated daily-task/event prerequisites, then the new migration. Inspect current prerequisites and helper grants before authoring SQL; record the exact order used. Keep a single migration definition under `supabase/migrations/`; do not mirror it in Drizzle or rewrite applied migrations. The existing Drizzle-only runner does not apply dated files. No hosted application, ledger reconciliation write, production data write or deployment is included in approval of implementation.

## Acceptance criteria

- Execute the actual migration/RPCs locally: first day, repeated same-day requests, consecutive days, a missed day, multiple missed days, and account/character recreation. Each account/day may award only 5 XP; no wallet change occurs.
- Test Lagos midnight, UTC/local-date differences, month/year/leap-date transitions, stale snapshot dates, and a check-in whose character lock waits across midnight. Use clock substitution only in a disposable test database, never a production override.
- Verify atomic rollback of receipt, state and XP when reward processing fails. Exercise actual RLS roles: no cross-account reads, no direct writes, anonymous/unauthenticated rejection, no client-selectable owner/reward, and private helper restrictions.
- Test independent-connection simultaneous claims and the midnight lock-wait case if a real local Postgres environment is available. Single-connection PGlite is not concurrency proof; explicitly report any environment limitation.
- Client tests cover restored sessions, repeated mount/focus/token refresh, pending duplicate suppression, confirmation-only XP/status, offline/hidden suspension, reconnect read-before-mutation, reset refresh, stale-day handling, lost responses, account cache isolation and graceful unavailable state.
- Browser-check the Missions summary at 375px with claimed, pending, offline and unavailable states. Distinguish synthetic fixtures from authenticated gameplay. Run focused tests, typecheck, scoped/global lint, game/public builds and then the full suite against unchanged application/test source. Report existing global lint debt separately.

## Current changes and approval boundary

This turn adds only this plan. Source audit and `git diff --check` are the checks for this documentation-only change; no new implementation tests are claimed. No application code, SQL, dependency, database state, branch, commit, push or deployment changed.

Approval requested: **Phase 3.3 only**, including automatic visible/online game-session check-in, the registered/playable-character eligibility definition, server-computed consecutive Lagos-day counts and fixed 5 XP/day. Living costs (3.4), later gameplay and renderer adoption remain deferred.

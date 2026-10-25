# Phase 3 daily-life architecture and game-loop plan

Date: 2026-10-25, Africa/Lagos. Status: source audit and proposal prepared after the owner's “proceed”. The owner subsequently said "approve", authorizing implementation of 3.1 only. See `phase-3-daily-tasks-implementation.md` for the implementation and evidence; the original proposal below is retained. No default-renderer adoption is proposed.

## Verified source findings

| Requirement | Existing source | Gap / reuse decision |
| --- | --- | --- |
| Three daily tasks | `missions.tsx`, `game.ts`, migration `0000_osogbo_life_phase1.sql`, override `0039_mission_reward_claim.sql` | Missions are one-time: unique `(character_id, mission_id)`, lifetime progress and claimed status. Retain them and add a distinct daily section to the same page. |
| Trusted activity evidence | `0024_shared_hud_simulation.sql`, latest command definition in `0070_timed_home_sleep.sql` | `simulation_action_receipts` records completed activities with trusted timestamps and retry keys. Reuse these receipts; never accept client-reported task progress. The latest command inserts receipts only on its completion branch. |
| Weekly events | `0024_shared_hud_simulation.sql`, `world-simulation.ts`, `simulation-service.ts`; phone reminders in `0060_phone_community_apps.sql` | The existing `join_city_event` RPC already validates world-clock event windows, location and weather and records participation. Phone `town_events` separately supplies dates/reminders. Reconcile the existing recurring event system and UI before declaring any Phase 3.2 gap; do not create a competing event system. |
| Login streak | Source/migration search for login streak and daily-task identifiers | No complete streak implementation found. This is a repository finding, not a hosted-schema audit. Separate future slice. |
| Living costs | `/home` delegates to `HousePage`; `house.tsx` reads canonical rent status/due date and weekly rent | Reuse housing, food-menu and transport quote data for a later cost summary. Do not invent a transport price independent of a destination or introduce fees. |

These findings are source-verified only. No database connection, hosted migration ledger, authenticated session or production state was inspected. The previous benchmark's 501-test pass is historical evidence, not validation of this proposal.

## First implementation slice: 3.1 daily tasks only

Proposed daily objectives are **complete one meal (`eat`), one study session (`study`), and one social activity (`socialize`)**. These action IDs already exist in the authoritative simulation command and do not require furniture purchases. Each task awards **5 XP and no money**, at most once per account per Lagos day. This is a proposed balance change: maximum 15 additional XP per day, subject to approval with this plan. Existing activity eligibility, costs, needs effects and timing remain authoritative and unchanged.

Loop: open Missions → fetch today's server task snapshot → perform an existing activity → server commits its receipt → refresh task snapshot → claim an eligible task → server atomically records the claim and grants XP → refresh canonical character/mission state. The browser never submits progress, reward amount, account ID, character ID or a trusted clock. Completion evidence is read from receipts, so navigating away does not lose progress and no browser event is needed to unlock a task.

### Persistence and transaction boundary

Propose a small server-owned task catalog and claim table, separate from lifetime missions. Catalog entries carry stable task key, action ID, label and integer XP reward; constraints bound rewards and supported actions. Claims use a unique primary key `(user_id, lagos_date, task_key)`, include the rewarded character ID, reward snapshot and claim timestamp, and have appropriate ownership/foreign-key indexes. Account-level uniqueness prevents character recreation from enabling a second daily payout. No writable progress counter or midnight reset job is needed.

The read RPC derives identity/current character from the authenticated session and returns server time, Lagos date, next reset timestamp, task progress and claimed/reward state. Progress is existence of a matching receipt in the half-open UTC interval corresponding to that Lagos date. Evaluate date and boundaries from one server timestamp per invocation. Eligibility uses completion time: an activity started before midnight and completed after midnight counts toward the new day. Personal simulated time never determines the calendar day.

The claim RPC accepts only task key and the date shown by the server snapshot. It authenticates, resolves/locks the current character using the established lock order, captures the current Lagos date after any lock wait, rejects stale dates and unknown tasks, and validates today's receipt. Claim insertion and the existing `_grant_xp` helper run in the same short transaction. A unique claim key plus atomic transaction prevents double payout across concurrent devices; retries return the original claim result without granting XP again. Any reward/helper failure rolls back the claim. Already-claimed status takes precedence over rechecking a receipt, so retrying a committed claim is stable. Refresh lifetime mission progress through the existing helper when XP changes.

Enable RLS on both exposed tables; authenticated users may read enabled catalog entries and only their own claims. No browser INSERT/UPDATE/DELETE grant. RPC execution is explicitly revoked from public/anon and narrowly granted. Any required privileged function has a fixed safe search path, derives identity itself, rejects anonymous users consistently with existing economy rules, and never exposes a client-selectable owner. Catalog edits are trusted administrative changes only. Review all helper grants before implementation rather than assuming underscore names are private.

### Client integration

Add a typed daily-task service with response validation and a user-scoped TanStack Query key; extend the current Missions page with three cards using existing tokens/components. Keep lifetime missions intact. Buttons reflect eligibility, pending, claimed, offline and failure states. Claims show only server-confirmed rewards; retry retains task/date inputs. Invalidate task and character data after confirmed claims and task data after relevant authoritative activity completion. Refresh at server-provided reset and on focus; a stale-date response refreshes instead of silently claiming a different day. Cache invalidation is a UX mechanism, not reward protection. Verify the layout at 375px without horizontal scrolling.

### Expected files and migration workflow

Expected additions: `src/lib/daily-task-service.ts`, a small daily-task UI component, service/component tests, a real local database acceptance suite, and a new dated migration under `supabase/migrations/`. Expected edits: Missions page, relevant canonical query invalidation/simulation integration, generated database types, and QA documentation. Exact filenames and integration hooks will be resolved against current source when approved; no new dependency is expected.

The repo contains two SQL histories: `drizzle.config.ts` targets `drizzle/migrations`, while dated Supabase migrations also exist and have overlapping housing changes. Before authoring SQL, inspect the local migration runner and prerequisites, use the Supabase CLI's documented migration-generation workflow, and document how the new dated migration joins local acceptance setup. Do not duplicate schema definitions across histories or edit published migrations. If local CLI/database prerequisites are unavailable, report that concrete limitation; never substitute a hosted migration application. No hosted migration, deployment or production data write is authorized by this proposal.

### Acceptance checks

- Database tests execute the migration and RPCs: three objectives, incomplete/unknown task rejection, zero client-selected rewards, one claim per account/task/day, retry result, rollback on reward failure, and existing lifetime missions retained.
- Exercise Lagos boundaries around 23:59:59/00:00:00 using a test-only clock fixture with no production clock override; verify completion across midnight, stale-date claims, and a claim waiting across midnight.
- Verify unauthenticated/anonymous rejection, cross-account reads and claims, blocked direct writes, and character-recreation uniqueness. Use actual role changes/RLS checks rather than SQL substring tests.
- Exercise concurrent claims through independent database connections if the local harness supports them. Single-connection emulation is not concurrency proof; record any remaining limitation.
- Client tests cover snapshot parsing, pending/double-click behavior, server rejection/retry, confirmed reward display, midnight refresh, and coexistence with lifetime missions. Run focused tests, typecheck, scoped lint and production builds, then the full regression suite. Report global lint debt separately.
- Browser-check the 375px layout. Authenticated RPC/RLS and real-device results require those environments and must not be inferred from mock tests or builds.

## Remaining Phase 3 slices

3.2 will first reconcile the existing server-validated recurring city events, client catalog and phone reminders. Only verified gaps warrant changes; economic effects require a separate reviewed balance contract. 3.3 will add server-computed Lagos-day streaks with same-day replay protection and explicit missed-day rules/rewards. 3.4 will display accurate living costs with existing data and no new fees. Each slice gets its own concrete architecture and acceptance review before implementation. They are not bundled into approval of 3.1.

## Approval boundary and current changes

Approval requested: implement **3.1 only**, including the three objectives, 5 XP per task, account/day uniqueness, new local migration, Missions integration and acceptance checks above. R3F remains the default; renderer adoption and Phases 3.2–8 are deferred.

This turn adds only this plan. Existing uncommitted benchmark harness and QA/report changes are preserved. No application code, SQL, dependencies, hosted data, Git history, commits, pushes or deployment changed. Validation for this documentation-only turn is `git diff --check`; no implementation tests are claimed.

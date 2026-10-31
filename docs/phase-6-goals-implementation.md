# Phase 6 — existing goals integration

Implemented the approved lifetime-mission reuse milestone. Home now shows one authoritative goal with its objective, progress and existing reward. Completed/unclaimed missions take priority; otherwise selection follows catalog order with stable ties. The card links to Missions for claiming. It distinguishes loading, unavailable, cached/offline, empty and all-claimed states.

The home card is in document flow below the full-height room, so it is reached by scrolling. This preserves the room's current dimensions and keeps the card outside canvas pointer handling. Friend visits are outside the HomeDashboard wrapper. No renderer was changed.

## Server behavior

Local migration: `supabase/migrations/20261029072109_mission_career_progress.sql`, created with `supabase.cmd migration new mission_career_progress`.

The existing earnings goal now counts positive income transactions in both `job` and `career_shift`. It excludes welcome grants, mission rewards, stall income and unrelated categories. Existing characters' unfinished earnings missions are reconciled without awarding rewards or sending backfill notifications; completed and claimed records remain intact. Catalog targets, reward amounts and character-lifetime semantics remain unchanged.

Mission recalculation locks eligible mission rows in UUID order. Claims lock the caller's character before recalculating and locking mission rows, aligning this path with career claims before wallet/XP changes. Ownership is derived from Auth and the current character; existing row ownership and direct-write restrictions remain. The helper stays unavailable to browser roles. The claim RPC retains its signature and already-claimed rejection; no arbitrary progress endpoint or new achievement ledger was added.

Before the migration, a real-SQL regression demonstrated 1,500 progress instead of 5,000 after 3,500 career pay plus 1,500 legacy pay. Afterward the regression passes. Tests also complete an actual three-step career shift and verify its claim replay does not increase progress again.

## Client behavior and files

- `src/lib/mission-service.ts`: owner/character-filtered reads, session checks before and after requests, deterministic mission ordering and active-goal selection.
- `src/lib/game.ts`: mission queries keyed by account and character, retaining the `missions` invalidation prefix.
- `src/hooks/use-missions.ts`: uses authenticated route identity and accepts character data only for that account.
- `src/hooks/use-mission-claim.ts`: shared route/phone claim behavior, synchronous duplicate-click guard, no offline queue, preflight canonical ownership/status read, server-confirmed cache update, canonical recovery after an ambiguous response, and suppression of late success after unmount/account changes.
- `src/components/game/ActiveGoalSummary.tsx`, `HomeDashboard.tsx`, and `home-dashboard-view.css`: home goal card and layout.
- `src/components/game/MissionChips.tsx`, `PhoneLauncher.tsx`, `src/routes/_authenticated/_game/missions.tsx`, `profile.tsx`, and `src/hooks/use-game-audio-events.ts`: consistent scoped reads. Lifetime-mission refresh errors leave daily tasks and login streaks available.
- `src/test/mission-progress-database.test.ts`, `mission-goals.test.tsx`: new SQL and UI/service/hook coverage. Existing mission-chip, profile and audio fixtures were updated for the scoped hook.
- `scripts/mission-goals-browser-check.mjs`: isolated 375px home fixture. The existing `scripts/living-cost-browser-check.mjs` stubs the separate goals panel to preserve its focused living-cost test.
- This report, the approved plan and `docs/release-qa.md`: evidence and release boundaries.

Claim failures never optimistically award money or XP. The database remains the reward authority; successful responses mark only the matching cached mission as claimed. A lost response followed by a canonical claimed snapshot resolves without a second payout or duplicate success toast. Recreating a character retains the existing character-lifetime mission semantics; this is not an account-lifetime achievement system.

## Validation

- Focused suite: **65 tests passed across nine files**, no skipped tests, 73.55 seconds. Includes eight real-SQL checks and twelve new client checks, plus career, daily-task, streak, route, profile, audio and mission-chip regressions.
- SQL coverage: career/legacy earnings, actual career claim replay, exact existing rewards once, insufficient progress, outsider/missing-character/signed-out rejection, private reads/direct-write denial, XP-failure rollback, no-reward backfill and single completion notification.
- Client coverage: stable priority/order, correct target/reward/currency, bounded meter, completed/empty states, cached errors/offline, initial loading/failure, account filtering and mid-request switching, duplicate clicks, lost-response recovery, offline no-queue and late-unmount success suppression.
- The isolated 375px browser fixture passed with no horizontal overflow: progress, ready reward, cached error, offline state, Missions navigation, living costs and placeholder-room input. Real HomeDashboard/goal hooks/service/styles use synthetic account/database responses. The screenshot was visually inspected. This does not establish actual 3D rendering or authenticated hosted gameplay.
- Final typecheck, lint, builds, browser rerun and full-suite outcomes are recorded below when complete.

Focused command:

`npx.cmd vitest run src/test/mission-progress-database.test.ts src/test/mission-goals.test.tsx src/test/mission-chips.test.tsx src/test/profile-page.test.tsx src/test/game-audio-events.test.tsx src/test/career-database.test.ts src/test/daily-task-database.test.ts src/test/login-streak-database.test.ts src/test/game-route-surfaces.test.ts --maxWorkers=1`

Evidence logs: `.smoke/goals-{before,database,client,focused,typecheck,lint,global-lint,game-build,public-build,browser,full-tests}.log`. Browser command: `node scripts/mission-goals-browser-check.mjs`; screenshot `.smoke/mission-goals-375.png`.

## Release boundaries and deferred work

No hosted SQL, deployment or Git publication was performed by the agent. The owner committed work during the implementation as `006b70db` and `134c07dc`; those commits were preserved.

Verify the target migration ledger includes the mission baseline through 0039 and career progression 0076 before applying this local dated migration. The local test executes the existing Drizzle baseline and the exact new migration in an ephemeral PGlite database. Do not use a blanket reset to reconstruct the repository's mixed migration chains. CLI creation required permission to write its telemetry file; that command did not apply SQL.

Authenticated hosted RPC/RLS checks, independent-connection claim/payment contention and physical-phone checks remain release validation. PGlite serializes one connection, so local duplicate/rollback checks are not proof of cross-connection concurrency. No live deployment-state claim is made.

New lifestyle achievement rewards, compound ownership targets, multi-stall ownership and Phase 7 map schedules remain deferred. Existing one-stall-per-account rules and existing economy rewards are unchanged.

Guidance reviewed: [Supabase database functions](https://supabase.com/docs/guides/database/functions) and the repository's Supabase/Postgres skills. The web tool could not read the changelog Markdown endpoint; no changelog verification is claimed.

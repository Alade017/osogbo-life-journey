# Phase 6 — existing goals integration

Date: 2026-10-29 (Africa/Lagos). Status: proposed; implementation awaits approval under root AGENTS.md.

## Audit and scope

The master roadmap says to add goals only where equivalent progression is absent. Reuse lifetime missions for this first Phase 6 milestone. Do not add a competing achievements ledger or new reward economy.

Verified from current source:

- `drizzle/migrations/0000_osogbo_life_phase1.sql` defines missions with targets, money/XP rewards and owner-scoped player missions, unique per character/mission. Its catalog includes getting a job, earning 10,000, completing three shifts and reaching level two.
- `drizzle/migrations/0002_city_locations_jobs.sql` adds exploration/training missions and the latest located `_recalc_missions` definition. Progress derives from existing tables. Its earnings calculation only includes transaction category `job`.
- `drizzle/migrations/0076_career_progression.sql` records career pay as `career_shift` and invokes mission recalculation. Consequently this pay is excluded from the earnings mission calculation. Demonstrate this with a failing SQL regression before changing it.
- `drizzle/migrations/0039_mission_reward_claim.sql` recalculates at claim time, validates ownership/current character, locks the mission row and atomically marks claimed and awards existing rewards. Repeated claims reject. These are character-lifetime missions, not account-lifetime achievements.
- `src/routes/_authenticated/_game/missions.tsx` already presents lifetime progress, rewards and claims alongside daily tasks and login streaks. `src/components/game/MissionChips.tsx` renders one in-progress mission but omits completed/unclaimed missions and loading/error feedback. `q.missions()` currently uses an unscoped `['missions']` cache key.
- `/home` renders `HousePage`; the authenticated layout wraps it with `HomeDashboard`. Integrate the summary into that actual home surface, keeping friend visits and room controls usable. `HomeDashboard` currently includes living costs but no active mission summary.
- `player_stalls` has unique account and character constraints; saving a stall has no purchase price. Thus “save for a stall” and “run three stalls” cannot be adopted literally without new economy/ownership design. Housing map model `compound` is not proof of an ownable compound product.

This audit establishes source behavior, not hosted deployment state. Existing mission equivalents satisfy part of Phase 6; new long-term lifestyle achievements remain a separate design decision.

## Proposed architecture and game loop

1. Existing play actions update authoritative mission progress. Correct earnings to count both legacy job and career-shift credits, excluding welcome grants, mission payouts, stall income and other unrelated transfers.
2. Home shows one active goal: completed/unclaimed first, otherwise in-progress, ordered by catalog sort order and a stable identifier. Include title, objective, bounded progress bar, current/target and the existing money/XP reward. No saved goal-selection preference is needed for this deterministic default.
3. “View missions” opens the existing Missions surface for claiming. Keep reward mutation in its existing flow. The summary never awards rewards or submits progress values.
4. A server-confirmed claim refreshes mission and player/wallet state. Show an explicit all-complete state when appropriate; distinguish empty, loading, unavailable and offline cached states. No fabricated zero progress or offline claim queue.

Use account-and-character-scoped mission queries consistently across summary, mission chips and Missions. Audit all consumers and invalidation paths before changing keys. Suppress old-account data on session changes. Preserve existing query invalidation prefixes where practical. Add synchronous duplicate-click protection and canonical refresh after ambiguous claim failure if the existing claim UI lacks them; preserve the existing claim RPC signature and already-claimed semantics.

Reuse existing design tokens and accessible progress UI. Position the home card in normal layout flow where possible, avoiding room canvas pointer interception and overlap with living costs, phone navigation and needs. Confirm the actual layout at 375px. No renderer changes.

## Backend scope after approval

Generate one new dated Supabase migration through the repository CLI workflow; never edit applied SQL. Update the existing mission recalculation function narrowly to include career earnings. Reconcile unfinished missions for existing players without paying rewards or resetting completed/claimed records. Reads remain read-only. Preserve claim eligibility, reward values, character lifetime and existing ownership rules.

Before implementing, load Postgres best-practice guidance and inspect lock ordering across recalculation, claims and career payments. Exercise duplicate/interleaved claim behavior locally. If the regression reveals a necessary locking correction, keep it within this mission claim/recalculation boundary and document it. Account-wide rewards after character recreation are explicitly outside this proposal.

No new catalog goals, tables, fees, reward amounts, manual progress endpoint, arbitrary user-ID input, dependency or hosted SQL. Local migration prerequisite: existing mission baseline through 0039 and career progression 0076; verify actual target ledger before any later application. Use the existing local SQL fixture strategy; do not assume `supabase db reset` can reconstruct the mixed migration baseline.

## Expected implementation files

- New migration under `supabase/migrations/` (CLI-generated filename after approval).
- `src/lib/game.ts` and a small goal-summary selector/service if useful.
- `src/components/game/HomeDashboard.tsx`, a focused summary component and relevant existing styling.
- `src/components/game/MissionChips.tsx`, `src/routes/_authenticated/_game/missions.tsx` and affected query consumers only as required for consistent account isolation.
- Focused SQL, component and service tests; a local browser fixture; implementation/release documentation.

## Acceptance and validation

- Real-SQL regression: legacy job plus career earnings advance the earnings goal; unrelated credits do not. Existing completed/claimed records remain intact. Backfill grants no money or XP.
- Claim tests: below target rejected; completed claim awards exact existing values once; repeat claim cannot pay twice; foreign, missing-character and signed-out callers rejected; raw progress/status writes denied. Rollback leaves no partial reward. Test reward-triggered progression without self-counting mission payments.
- UI: deterministic goal choice, ready-to-claim priority, all-complete/empty/error states, accessible bounded meter, correct currency units, account/character switching, failed refresh, duplicate input and ambiguous claim recovery.
- Regression coverage for missions, career pay, daily tasks, login streaks and home/phone routing. Local browser at 375px checks room interaction, navigation and no horizontal overflow using explicitly synthetic sessions when hosted sessions are unavailable.
- Run focused Vitest, `npm.cmd run typecheck`, scoped lint, repository lint, `npm.cmd run build`, `npm.cmd run build:public`, full Vitest with `--maxWorkers=1`, and `git diff --check`. Report actual results. Cross-connection concurrency, hosted RPC/RLS and physical phones remain separate release checks.

## Current planning result and approval

Only this plan was added in this turn. No migration or application code changed; no tests/builds rerun for a documentation-only audit. Prior Phase 5.3 evidence is historical: 758 tests passed and one existing R3F-default expectation failed against PlayCanvas; global lint had 335 errors/12 warnings. Do not treat these as new Phase 6 results.

Baseline: branch `main`, HEAD `b9c19df3` (owner's party-invitations commit), no staged changes. Preserved the two existing verification-note edits in `docs/phase-5-party-invitations-implementation.md` and `docs/release-qa.md`. No branch, commit, push, PR, merge, deployment or hosted database action performed.

Approve this scoped mission-reuse milestone before implementation. Root `AGENTS.md` requires: “For new features, present the architecture and game-loop plan first and wait for explicit approval before editing files.” Later lifestyle achievements, multi-stall ownership and Phase 7 map schedules remain deferred.

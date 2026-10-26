# Career progression

Career paths extend the existing Jobs, `character_jobs`, wallet, XP, skills, location, and map systems. The browser displays results and requests actions; it cannot set salary, wallet balance, rank, or shift completion.

## Tracks and pay

| Workplace | Path | Level 1 | Level 2 | Level 3 |
| --- | --- | --- | --- | --- |
| Cedar Bank or Meridian Bank | Banking & Finance | Banking Assistant, ₦3,500 | Customer Service Officer, ₦5,000 | Branch Supervisor, ₦7,000 |
| Osun Mall | Retail & Mall Operations | Sales Assistant, ₦3,000 | Senior Sales Associate, ₦4,500 | Store Supervisor, ₦6,500 |

Rank 2 requires five completed shifts and level 1 in the job's reward skill. Rank 3 requires 15 completed shifts and skill level 3. Promotion requires a player request and cannot happen during an active shift. Banking awards +2 mood and retail +3 on paid completion, capped at 100. The reward updates character happiness and, when the separate Party Life migration is installed, calls its existing `apply_party_mood` function in the same transaction. The existing XP and skill-reward functions run once on paid completion. Cancelled shifts have no pay, mood, XP, or completed-shift credit.

The three ordered tasks for each rank are configured in `career_ranks.steps`. A player must be at the career job's `locations.id` to start, advance, and claim. The server stores each step, imposes a 15-second minimum between steps, and pays only after step three and the final wait. It checks shift hours, energy, and the job's existing cooldown when starting. The existing travel RPC owns `characters.current_location_id`; the browser's location label is never authority.

## Database and security

Migration `0076_career_progression.sql` adds `career_paths`, `career_ranks`, `jobs.career_path_slug`, and `career_shifts`, and seeds three career job listings at already registered locations. It does not delete or reset existing jobs or player data. The three-step flow uses `start_career_shift`, `complete_career_step`, `claim_career_shift`, and `cancel_career_shift`. `leave_career` and `promote_career` manage employment. Existing `select_job`, `perform_job`, and `promote_current_job` remain available for ordinary jobs; guards prevent the instant shift or legacy promotion path from being used for career jobs.

These are authenticated RPCs. They resolve the caller's character with `_my_character_id()` and verify ownership. Career tables expose only catalog reads or owner-only shift reads through RLS. They expose no browser writes. A partial unique index permits one active career shift per character; the existing `one_current_job` index permits one active job. Completion locks the character, shift, and employment rows and inserts an existing wallet transaction with category `career_shift`. The shift stores the transaction ID and rank/pay snapshot; a retry of a completed claim returns the saved amount without paying again. Career receipts use a distinct category so the legacy percentage bonus trigger does not change fixed rank salaries.

## Development and release

The repository uses ordered SQL files and `drizzle/migrations/meta/_journal.json`. Apply migrations through `0076_career_progression.sql` to a **local or test** database using the project's migration tooling. Do not apply this migration to production until a separate release is authorized. The phone Jobs app reads career catalog and history from Supabase, and the existing map landmark job panel discovers the new jobs by their location IDs.

Run checks from the repository root:

```powershell
npx.cmd vitest run src/test/career-rules.test.ts src/test/career-database.test.ts src/test/career-panel.test.tsx
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
git diff --check
```

## Limits

Phase 4.2 aligns the promotion button with the server's active-shift restriction and adds acceptance coverage for existing rank progression and promoted pay, without changing balance or RPCs. See [phase-4-career-progression-implementation.md](phase-4-career-progression-implementation.md) for current local results and release limits.

Career steps are server-ordered, timed button interactions. There are no separate Phaser task animations or physical mini-game proofs. A player at the right venue can request each step after its timer; this is the current game interaction model. The browser's shift history lists the 30 newest shifts. Party Life mood integration is active only in databases where `apply_party_mood` has been installed; character happiness updates in all databases. A signed-in 375px browser run and production Supabase schema verification remain release checks.

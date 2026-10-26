# Phase 4.2: career promotion alignment and acceptance

Date: 2026-10-26, Africa/Lagos. Status: approved by the owner and implemented locally; see `phase-4-career-progression-implementation.md` for evidence and limits. The proposal below is retained. Audit branch `main`, HEAD `8ab44539`; working tree and staged changes were clean at audit start. The owner's merge and all prior work are preserved.

## Verified source findings

The master request says to reuse career progression and unlock the next tier when its verified conditions are met. It does not require replacing an equivalent working system or adding automatic promotions.

- `docs/career-progression.md`, `career-service.ts`, `career-rules.ts`, `CareerPanel.tsx` and `drizzle/migrations/0076_career_progression.sql` already implement three-rank banking and retail careers. `jobs.tsx` renders CareerPanel and excludes career listings from the ordinary-job workflow.
- Existing promotion thresholds: rank 2 requires five paid/completed shifts and skill level 1; rank 3 requires 15 and skill level 3. Existing banking salaries are 3,500/5,000/7,000 and retail salaries 3,000/4,500/6,500 game NGN per completed shift. Catalog configuration remains authoritative.
- `promote_career()` resolves the authenticated character, locks character and employment, selects only `career_level + 1`, validates shift count and the job's reward skill, rejects an active shift, and caps progression at rank 3. It returns the confirmed title/salary/rank. Promotion itself does not award salary or money.
- The UI already displays next-rank requirements and requests promotion explicitly. Its promotion button checks readiness and mutation pending state, but omits the active-shift guard used by the server. A qualified player can therefore see an enabled button that the server must reject during a shift. The adjacent Leave career button already disables for an active shift.
- The existing database test verifies early-promotion rejection but does not exercise successful rank-2/rank-3 promotion. The rule test covers threshold arithmetic locally; two panel tests cover applying and shift-step display. Neither establishes the complete positive server promotion path.

Current audit baseline: `npx.cmd vitest run src/test/career-rules.test.ts src/test/career-database.test.ts src/test/career-panel.test.tsx --maxWorkers=1` passed **11 tests across three files**, exit 0 (20.78 seconds). Log: `.smoke/phase-4-career-audit.log`. This is local evidence, not a hosted career-schema or authenticated-browser check.

## Proposed architecture and game loop

Keep the existing loop: choose an existing career → perform its server-ordered paid shifts → server records shifts/skill → display next-rank requirements → player requests promotion when eligible and no shift is active → server verifies and advances exactly one rank → refresh canonical employment/catalog state → subsequent shifts use that rank's authoritative salary snapshot.

This slice is **alignment and acceptance**, not a new progression system. Preserve manual promotion, thresholds, titles, salaries, shift timing, pay/XP/mood rules, ordinary jobs and all existing RPC signatures. Do not introduce new tiers, automatic promotion, a competing employment table, new rewards or a new provider.

### Minimal UI correction

In `CareerPanel.tsx`, disable Claim promotion while `activeShift` exists, in addition to existing readiness/pending checks. Explain “Finish or cancel your active shift before promotion” when a next rank exists and a shift blocks promotion. Keep the server authoritative: a stale UI can still receive a server rejection, and no optimistic rank or salary increment is allowed. At the highest rank, keep the next-rank action absent.

Reuse `promoteCareer` and `useGameAction` for the request, confirmed toast and existing canonical invalidation. Verify those hooks actually refresh employment before claiming that the new title is durable. Do not refactor unrelated career data/cache flows merely to implement the button guard.

### Server acceptance coverage

Extend local database acceptance using the existing real migration/RPC harness. Use isolated fixture state so new promotion scenarios do not depend on or break the current ordered shift tests. Controlled test records may establish threshold counts/skills; production SQL must never gain a clock/progression override.

- Rank 1: reject four shifts with sufficient skill, and five shifts with insufficient skill; allow five shifts plus skill 1, returning/storing rank 2 and its configured title/salary.
- Rank 2: reject 14 shifts or skill 2; allow 15 plus skill 3, returning/storing rank 3. A single call may advance only one rank, even if rank-3 thresholds are already met while at rank 1. Reject another call at the highest rank.
- Block promotion during an active shift even when all thresholds are met. Paid-shift claims continue to count; cancelled work does not add credit. Preserve existing leave/rejoin history behavior.
- Exercise actual subsequent shift completion/pay at the promoted rank and confirm one payout receipt and no money minted merely by promotion. Keep rank/salary snapshots intact; a claim retry must not pay twice.
- Reject unauthenticated callers and attempts to act on another character through existing interfaces. Review actual role grants/RLS for the exercised promotion/employment paths rather than treating SQL substring checks as security proof.
- Where the local harness supports independent connections, exercise promotion versus shift start/claim contention. Single-connection PGlite does not prove concurrent locking; document the limitation if PostgreSQL remains unavailable.

### UI and browser acceptance

Extend `career-panel.test.tsx` with a realistic next-rank catalog and server-backed employment fixtures: unmet thresholds, eligible idle promotion, eligible active-shift suppression with explanation, pending state, maximum rank, server rejection and confirmed refreshed rank display. Verify the existing promotion service is invoked, not a browser stat update. Keep mutation/query mocks faithful to actual hook behavior.

Use an isolated real-component/style 375px browser fixture to exercise locked/ready/pending/confirmed promotion states without horizontal scrolling; label its synthetic data explicitly. Real authenticated promotion and target-phone behavior remain separate release checks.

## Files, migrations and validation

Expected source edit: `src/components/game/CareerPanel.tsx`. Expected test edits/additions: career panel and promotion database acceptance, plus a small browser fixture. Update `docs/career-progression.md`, release QA and a Phase 4.2 implementation report with exact results. `career-rules.ts`, `career-service.ts`, RPC contracts and balance should remain unchanged unless an acceptance failure identifies a concrete defect.

**No migration or dependency is presently proposed.** Existing migration 0076 already provides the required functionality and must not be edited. If acceptance identifies a genuine server defect requiring SQL, first report it against this scope; any authorized fix must use a new dated Supabase migration and preserve existing contracts. Do not apply hosted migrations or patch production data.

After approval: focused career/rules/service acceptance, typecheck, scoped and global lint, game/public production builds, full regression and 375px fixture. Report exact pass/fail/skip counts, including unrelated existing failures. The prior renderer-default expectation and social-test timeout must not be hidden by weakening assertions or broad timeout increases. Re-run a named timeout in isolation before diagnosing a product regression. No full-suite or build success is claimed by this planning turn.

## Approval boundary

Approve **Phase 4.2 only**: the active-shift UI guard/explanation and positive/negative acceptance of the existing server promotion system. This plan adds no gameplay balance changes. Phase 4.3 stall income and later phases remain deferred.

This turn adds only this document and runs the existing three career suites plus `git diff --check`. No application code, schema, dependencies, hosted data, branches, commits, pushes, PRs, merges or deployments were changed by the agent. Owner approval is required by root `AGENTS.md` before implementing the proposed UI change.

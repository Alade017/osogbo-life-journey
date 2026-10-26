# Phase 4.2 implementation and acceptance

Date: 2026-10-26, Africa/Lagos. The owner approved `phase-4-career-progression-plan.md`. Baseline `8ab44539` had no application changes in the working tree; only the proposed plan was untracked. Owner history, renderer choices and unrelated route files are preserved.

## Behavior and scope

`CareerPanel.tsx` now disables Claim promotion while an active career shift exists, matching `promote_career()`'s existing validation. The panel explains: “Finish or cancel your active shift before promotion.” Readiness and pending checks remain in place. The existing server confirms promotion; the browser does not increment rank, salary or money optimistically.

The existing careers, manual promotion flow, thresholds, salary catalog, shift timing and RPC signatures remain unchanged. Rank 2 requires five completed shifts and skill 1; rank 3 requires 15 and skill 3. Each server request advances only one rank. Promotion does not pay money. Later paid shifts use the promoted rank's salary snapshot and existing exactly-once claim receipt. Cancelled work does not count.

No SQL migration, dependency, new provider, career implementation or server-rule change was needed. This completes the approved UI alignment and acceptance slice; it does not claim hosted schema application or actual multiplayer progression.

## Files

- `src/components/game/CareerPanel.tsx`: active-shift guard and explanation; the only production source edit.
- `src/test/career-panel.test.tsx`: next-rank/skill fixtures and active-work, idle, insufficient-skill and maximum-rank checks, retaining the application/step tests.
- `src/test/career-database.test.ts`: isolated promotion scenarios within the real-migration harness. Each resets its own character/employment/skill/pay fixtures and follows the real leave-before-changing-career workflow. The original ordered shift tests remain.
- `src/test/career-promotion-flow.test.tsx`: actual promotion service, runtime parser, `useGameAction` and query invalidation, with synthetic database responses. Rejection preserves rank; pending disables the button; confirmed success reloads employment before displaying rank 2.
- `scripts/career-promotion-browser-check.mjs`: isolated real component/style/service/action-hook fixture with synthetic catalog/employment/RPC state and no hosted requests.
- Approved plan, this report, `docs/career-progression.md` and `docs/release-qa.md`: scope and release evidence.

## Local verification

Audit baseline: three existing career suites passed **11 tests across three files**, exit 0 (20.78 seconds).

```powershell
npx.cmd vitest run src/test/career-rules.test.ts src/test/career-database.test.ts src/test/career-panel.test.tsx src/test/career-promotion-flow.test.tsx --maxWorkers=1
```

Final focused result: **27 passed across four files**, exit 0 (29.68 seconds), no skips. SQL checks cover threshold failures, qualified promotion after cancelling, sequential rank 2/rank 3 persistence, maximum rank, no promotion money, active-shift rejection, rank-2/rank-3 banking and retail salaries, a single payout on retry, unauthenticated/other-character rejection, RLS and blocked direct rank/skill writes. Controlled fixtures set threshold records and elapsed step readiness only in tests; no production clock/progression override was added.

`node scripts/career-promotion-browser-check.mjs`: **passed at 375 × 812**, no horizontal overflow or external requests. Exercised active-shift blocking with explanation, ready, pending and confirmed states; exactly one `promote_career` request with no client-selected rank/pay. Screenshot `.smoke/career-promotion-375.png` was inspected. This is not proof of an authenticated hosted promotion or budget-phone performance.

Typecheck, scoped lint, game build, public build and `git diff --check` passed. Global lint remains **335 errors / 12 warnings**, matching the latest repository baseline; changed career files pass scoped lint. Existing large-chunk/plugin-timing build warnings remain. The public JavaScript asset is 228.29 kB / 71.03 kB gzip. Logs: ignored `.smoke/phase-4-career-*.log`.

Full regression: `npx.cmd vitest run --maxWorkers=1 --reporter=verbose` completed with **632 passed / one failed / three skipped**, 132 files (130 passed / two failed), exit 1, 2934.98 seconds. All career cases passed. The failed assertion is the existing renderer test expecting R3F while the owner's contract defaults to PlayCanvas. The second failed file is the untouched map-travel suite: its `beforeAll` exceeded 60,000ms, leaving its three tests unexecuted in this run. An unchanged isolated rerun of `src/test/map-travel-database.test.ts` passed **all three tests**, exit 0 (15.49 seconds). This shows load-sensitive setup behavior, not a green full-suite result or proof that every possible runtime issue is absent. Neither timeout limits nor unrelated assertions were changed.

## Security and release boundaries

The existing server RPC derives the caller, locks character/employment, rejects active work and validates catalog thresholds. Browser rank/skill writes remain blocked in the exercised local role tests. The real action hook invalidates canonical data on settlement; confirmed display comes from reloaded employment. No privileged key or client-selected owner/salary was introduced.

The database harness is single-connection PGlite with the existing Drizzle baseline and a fixture of the optional Party Life mood helper. It is not a hosted migration ledger or full deployed schema. Independent-connection promotion/start/claim contention, real lock waits, authenticated browser sessions and phone hardware remain unverified.

No hosted migration/data write, branch creation, commit, push, PR, merge or deployment was performed. Phases 4.3 onward remain deferred. Existing renderer expectations and repository lint debt are reported separately, not rewritten to manufacture passing checks.

# Phase 4.1: implementation and evidence

Date: 2026-10-26, Africa/Lagos. Scope: the owner approved `phase-4-party-rewards-plan.md`. Phase 3.4's existing uncommitted files are preserved. No career, stall-income, invitation, renderer or shared-needs changes are included.

## Delivered game loop

The existing Party experience remains shared by the phone and route. Hosts arrange an event using the existing form. Registered guests travel to its active event centre and fulfil requirements during the trusted event window. A guest requirement now uses server-saved venue presence rather than an impossible club-visit prerequisite. Drink requirements still require a server purchase at that venue, inside the event window and no later than the response. Hosts cannot fulfil their own requirements.

The existing **+15 party mood per filled requirement**, clamped to 100 by `apply_party_mood`, remains separate from the new reward. Party mood is not the shared HUD happiness stat. No extra mood, money, XP or fees were added.

After an eligible event ends, the host may claim **+1 existing reputation**, capped at 100. Success requires all requirements proven from timestamped fulfilment rows and contributions from at least two distinct registered guest accounts. One guest account counts once across requirements; the host and anonymous accounts do not count. This is contribution/presence evidence, not proof of dwell duration or distinct humans. Coordinated accounts remain a limitation.

The claim window is seven days after the event ends. Cancelled and pre-activation events do not qualify. A claim consumes one event forever and one reward slot per account per **Lagos claim day**, including when reputation is already 100 and the applied delta is zero. Date input is pinned to the server snapshot and rejected if stale after lock waits. Same-event replay returns its original receipt without changing stats, including on a later day or after host-character deletion. Missing/deleted guest evidence is conservatively ineligible until an immutable reward receipt already exists.

## Database and security

New local migration: `supabase/migrations/20261026162243_party_host_reputation.sql`.

Prerequisites: existing game/auth schema and the October 19 party migrations `20261019100000_party_life.sql` and `20261019110000_party_clubs_and_activities.sql`. The acceptance fixture boots the Drizzle baseline, then those two dated migrations, then this migration. It does not demonstrate a hosted migration ledger. Do not copy this SQL into the Drizzle history or modify published migrations. The Supabase CLI generated the local filename; its blocked telemetry write required an escalated CLI invocation. No database was contacted by that command, and its generated CLI-version cache noise was restored to its original empty content.

- Server-owned singleton activation/configuration; reward fixed at one by a constraint. Missing configuration fails closed.
- `party_host_reward_receipts`: unique event and unique account/date, original character reference with `ON DELETE SET NULL`, recorded reward/delta/final reputation, trusted award timestamp and completed/guest count snapshot. Event ID intentionally has no cascading event FK so deleting a character and its events cannot erase the cap. Account deletion removes its receipts through the auth-user FK.
- `get_party_host_results()` exposes only the caller's recent hosted results, server time/date, counts, eligibility and their receipt. It does not award anything. Host result history is limited to the most recent 100 events ending within the recent seven-day window or later; this is not an unbounded event-history UI.
- `claim_party_host_reward(uuid,date)` derives identity, ownership, reward and trusted clock itself. Account advisory lock → event lock → host character lock → recaptured time/evidence → atomic receipt/stat update. Same-event replay precedes date/cap revalidation, but still requires the registered receipt owner.
- `respond_to_event(uuid,uuid)` preserves the public signature and request receipts. It serializes event responses, then locks involved characters in UUID order, then the requirement. It recaptures time after waits, revalidates active venue and eligibility, records the actual response timestamp and preserves the existing mood award. The guest repair does not broaden `enter_club`.
- RLS restricts receipt SELECT to its owner, with no browser writes or configuration reads. New privileged helpers have fixed empty search paths and no public/anon/authenticated execution grant. Public RPC execution is revoked from public/anon and granted to authenticated. No browser-selectable owner or guest identity list is exposed. No secret key is imported by the new browser service.
- `_recalc_missions` was inspected: its current cases do not depend on reputation, so this claim does not introduce an unrelated mission recalculation.

Current function-security guidance was checked against [Supabase database functions](https://supabase.com/docs/guides/database/functions). The changelog markdown fetch was attempted but the web reader rejected its content type; no changelog contents are claimed verified.

## Client changes and file manifest

- `src/lib/party-reward-service.ts`: typed RPC boundary, runtime result/receipt validation, friendly missing-migration/date errors and event/date-only claim payload.
- `src/integrations/supabase/types.ts`: the two new RPC signatures.
- `src/components/game/PartyHostResults.tsx`: owner-scoped result query, ended-event results, explicit rules/reasons/deadlines, pending guard, offline protection, retry, server-confirmed toast and targeted query invalidation. Immediate submission guard closes the same-tick double-click gap; database uniqueness remains the payout protection. Lost responses recover through a receipt snapshot without an automatic claim or duplicate toast. Late success after unmount does not toast.
- `src/routes/_authenticated/_game/party.tsx`: results section reused inside the existing Events tab, keyed by account. It stays available independently of public event-list errors. Existing phase labels refresh with a cleaned-up timer/focus listener; they do not authorize rewards.
- `src/test/party-rewards-database.test.ts`, `party-reward-service.test.ts`, `party-host-results.test.tsx`, `party-event-clock.test.tsx`: real SQL, typed-service, component and actual Events timer/focus/cleanup acceptance checks.
- `scripts/party-rewards-browser-check.mjs`: isolated real component/style browser fixture with synthetic RPC data.
- Approved plan, this report and `docs/release-qa.md`: scope and release evidence.

No new dependency or global provider. Both current route/phone entry points reuse `PartyExperience`; no competing party implementation was created.

## Validation

- Focused: `npx.cmd vitest run src/test/party-rewards-database.test.ts src/test/party-reward-service.test.ts src/test/party-host-results.test.tsx src/test/party-mood.test.ts src/test/phone-party-app.test.tsx --maxWorkers=1` → **36 passed, five files, exit 0**, 26.05 seconds. Includes 14 SQL checks, eight service checks, six component checks and eight existing helper/wrapper checks.
- SQL checks include event-centre guest admission, no self/anonymous/wrong/inactive-venue response, window boundaries, drink evidence, insufficient/one-account evidence, exact-end reward, stale dates and Lagos midnight, per-account/day cap across events, legacy/cancelled/expired rejection, 100-reputation consumption, replay, RLS/direct-write/helper restrictions, rollback, and receipt persistence after host deletion.
- Final focused rerun after the Events clock correction: **36 passed across five files**, exit 0 (37.56 seconds). An additional actual `PartyExperience` Events integration test passed separately: **one passed**, exit 0 (6.12 seconds), verifying scheduled/live/ended transitions, focus refresh and interval cleanup. The correction moved the new refresh timer from an initially matched Clubs block to the intended Events block; Clubs behavior is preserved. No assertions or timeout thresholds were weakened.
- Scoped ESLint, including the touched generated RPC types, and typecheck passed. Game and public production builds passed; existing large-chunk warnings remain. The public JavaScript asset is 228.29 kB / 71.03 kB gzip.
- `node scripts/party-rewards-browser-check.mjs` → **passed at 375 × 812**, no overflow or external requests; ready/offline/pending/claimed/unavailable/retry states, one claim with the pinned event/date. Screenshot `.smoke/party-rewards-375.png` was inspected. This fixture has synthetic RPC data; it is not authenticated hosted gameplay or a real-phone measurement.
- Full regression: `npx.cmd vitest run --maxWorkers=1 --reporter=verbose` → **617 passed / two failed, 130 files**, exit 1 (830.40 seconds), no skipped tests. All new party tests in that run passed. Failures: the existing `house-room-renderer.test.tsx` R3F expectation versus the owner's PlayCanvas default, and a 5,000ms timeout in the untouched social-panel conversation test. The latter passed unchanged in isolation: **one passed / six excluded by name filter**, exit 0 (9.47 seconds); this is load-sensitivity evidence, not a full-suite green claim. The full run predates the final Events-only timer correction and its new integration test; the final focused checks above exercise that correction. No additional full rerun was performed.
- Global lint: **335 errors / 12 warnings**, exit 1. Compared with the prior 329-error log, the extra six formatting errors are in the owner's committed `PhoneRouteDialog.tsx`, `game-route-surfaces.ts`, `_game.tsx` and `game-route-surfaces.test.ts`; these files were not changed by Phase 4.1. The new/touched party files pass scoped lint.
- Logs: ignored local `.smoke/party-rewards-*.log`. `git diff --check` passed. Existing renderer expectations and unrelated formatting are preserved, not silently rewritten to manufacture a passing repository-wide result.

## Remaining limits and release boundary

The SQL acceptance harness is single-connection PGlite. PostgreSQL and Docker executables were not found on PATH. Independent-connection contention, real lock waits across midnight, reciprocal-host deadlocks and hosted RLS/RPC behavior remain unverified; deterministic clock fixtures test boundaries without adding a production clock override. Lock ordering and uniqueness are implemented, but those local checks are not a concurrency certificate.

No hosted migration application, production data write, deployment, branch creation, commit, push, PR or merge was performed. Migration application requires a separate authorized environment/ledger review. Actual authenticated multi-player attendance, phone/route integration and low-end Android performance still require staging/device checks. Phases 4.2 onward remain deferred. The owner's separate PlayCanvas default and prior work are preserved.

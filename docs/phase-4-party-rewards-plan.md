# Phase 4.1: successful-party reputation

Date: 2026-10-26, Africa/Lagos. Status: approved by the owner and implemented locally; see `phase-4-party-rewards-implementation.md` for evidence and limits. The proposal below is retained. Audit branch `main`, HEAD `5e2fa353`. Existing Phase 3.4 changes and its report are uncommitted and preserved; no staged changes were present at audit start.

## Source audit and scope

The master request's next slice is 4.1, party rewards. It explicitly requires inspecting and reusing existing systems. Root `AGENTS.md` requires approval of architecture and game-loop changes before implementation.

- `src/lib/party-service.ts` already reads venues, mood, events and requirements and calls `host_party_event` and `respond_to_event`. `PartyExperience` in `src/routes/_authenticated/_game/party.tsx` is shared by the lazy phone Party app. Preserve that integration.
- `supabase/migrations/20261019110000_party_clubs_and_activities.sql` is the inspected latest hosting override: events at active event centres, start within 24 hours, three-hour duration, one to five requirements. Hosting may be arranged remotely.
- `20261019100000_party_life.sql` defines fulfilments unique by requirement/character. Its `respond_to_event` checks the responder's saved location, event window, self-fulfilment exclusion, purchased drinks and requirement capacity. Request receipts provide same-command replay protection.
- That RPC already gives the host **+15 party mood for each completed requirement**, using `apply_party_mood`, clamped to 0–100. This is an existing reward, not a missing feature. There is no event-level reputation receipt or successful-party reputation increment in the inspected party SQL/service.
- A guest requirement currently requires `_party_active_visit` at the event location; `enter_club` only admits club venues, while hosting requires an event centre. This code-path mismatch needs correction for event-centre guest attendance. Do not broaden club entry rules or invent NPC attendance.
- `EventsTab` captures browser time only once and hides ended events. A post-event reward needs a server snapshot and a visible owner result, not a client timer that grants progression.
- `src/test/party-mood.test.ts` tests local helper rules; `phone-party-app.test.tsx` checks shared component reuse. They do not prove SQL attendance, reward atomicity, RLS or concurrency. Existing `characters.reputation` is the stat to reuse; existing job SQL caps it at 100.

These are source findings, not a hosted schema/security audit. No new implementation, schema or RPC has been executed in this turn.

## Proposed game loop and balance contract

Host an event through the existing form → real players travel to its venue and fulfil requirements during its server window → the existing per-requirement mood award remains → after the event ends, the host opens its result and claims **+1 reputation** if eligible → server commits the receipt and stat together → client refreshes canonical character/result data.

Proposed success rules, all checked server-side:

1. Event was created after this feature's server activation timestamp, is not cancelled, has ended, and ended no more than seven days ago. Old events receive no retroactive reputation.
2. Every configured requirement is fulfilled, proven from server fulfilment rows, not a browser count or submitted guest list.
3. At least **two distinct registered guest accounts** contributed valid fulfilments during `[starts_at, ends_at)`. Exclude the host account and anonymous accounts; count an account once across requirements. Browser names, invitation acceptance, NPCs and current client location are not attendance evidence. A server-validated guest response at the venue counts as attendance; no minimum dwell duration is claimed.
4. Authenticated registered caller owns the event's original host character. Character recreation must not transfer ownership of a prior character's party or erase reward caps.

New reward: +1 existing reputation, capped at 100, **at most one rewarded event per host account per Lagos claim day**, and once per event forever. Claim must name the Lagos date supplied by the server snapshot; recapture time after locks and reject stale-day submissions. No backfill and no client clock override. A receipt is consumed even if reputation is already 100, with actual applied delta recorded as zero. A replay returns that receipt without another increment.

No extra mood award, money, XP, entry fee or drink-price change. The existing +15 mood per filled requirement is retained and clearly distinguished from the new capped event reputation. The new daily cap does not retroactively cap existing mood behavior. This proposal requests approval of the above reputation balance and success thresholds explicitly.

## Server design and attendance repair

Use one new dated Supabase migration; do not edit either published October 19 migration or duplicate definitions into the Drizzle history. Verify local migration prerequisites and use the established CLI generation workflow only after approval. No hosted application is authorized.

- Add a server-owned activation/reward configuration and immutable reward receipts: unique event ID plus unique `(host_user_id, lagos_claim_date)`, original host character reference, requested/applied reputation delta, trusted award timestamp and success evidence snapshot. Account-level uniqueness survives character recreation; choose deletion/FK behavior so user-owned character deletion cannot erase the cap. Index ownership/history lookups.
- Add an authenticated host-result snapshot RPC exposing only the caller's eligible/recent hosted events, trusted server time/day, evidence counts, eligibility reason and receipt. Reading never claims rewards. Keep existing public event discovery and RPC signatures available.
- Add a claim RPC accepting event ID and snapshot date, deriving user/character/reward itself. Authenticate registered users, serialize the account/day, lock event and relevant character state, recapture time, validate success/ownership and atomically insert receipt/update reputation. Replay of the same event returns the original result before checking today's cap/date. Reward failure rolls back receipt and stat together. Refresh mission state through the existing helper if its actual rules depend on reputation; inspect that dependency before implementation.
- Replace `respond_to_event` through the new migration while preserving its signature, existing receipts and mood effects. For guest requirements at active event centres, use the existing saved-location and live-window validation instead of requiring a club visit. Keep no-self-fulfilment, unique contribution and capacity controls. Drink requirements retain server purchase evidence, constrained to the event's half-open window. Recheck trusted clock after waits and validate active venue, registered account and host-account exclusion.
- Serialize all requirement responses for an event before reading counts; use one documented lock order across responses and claims. Resolve event identity first, then lock event, involved character rows in deterministic ID order, then requirement/evidence rows. Account/day advisory locking belongs before event locking for claims; no response path may acquire that account lock after holding an event/character lock. Inspect existing party helper lock behavior before finalizing SQL. Test reciprocal hosts/guests and simultaneous final requirements rather than assuming uniqueness alone prevents deadlocks or double mood/reputation awards.
- Keep the existing fulfilment table as the attendance source. Historical events are excluded from new reputation eligibility, so the reward does not trust old guest semantics. Re-derive completion from rows and validate timestamps; do not treat a writable/stale aggregate as proof. Missing/deleted evidence is conservatively ineligible unless a durable server snapshot already exists in a reward receipt.

Enable RLS on new exposed tables, allow only own receipt/result reads and no browser writes. Fix search paths, qualify references, revoke public/anon function execution, narrowly grant authenticated RPC execution, and keep administrative configuration writes server-only. Review actual legacy grants and helper access as part of the touched RPC audit. Do not expose other guests' private account IDs through host results; counts and eligibility are sufficient. Account uniqueness mitigates recreation, not coordinated multi-account abuse; two distinct accounts are not proof of two distinct humans.

## Client integration

Extend `party-service.ts` with validated result/claim response types and account-scoped query keys. Add an owner-only results section within existing `EventsTab`, including ended events returned by the host snapshot. Explain completed requirements, minimum guest count, seven-day claim window, daily cap, already claimed, at-cap stat and unavailable states. Display confirmed rewards only; pending disables repeat clicks; retry retains event/date; stale-day errors refresh without silently changing the claim request. Offline/missing migration errors remain nonblocking to the existing party screen.

Use server snapshot time for result eligibility; fix stale phase display only in the touched event view, with cleanup and refresh on focus. Browser time can animate a countdown but cannot unlock a trusted reward. Invalidate event requirements, host results, party mood and canonical character as appropriate after confirmed responses/claims. Reuse current lazy phone screen and tokens, with keyboard and 375px checks. No new dependency or global provider.

Expected additions: dated SQL migration, local database acceptance test, typed result component/service tests, isolated browser fixture and implementation report. Expected edits: party service, `party.tsx`, generated Supabase types where appropriate and release QA. Exact names and baseline schema bootstrap are resolved against current source on approval.

## Acceptance and boundaries

- Execute real SQL locally: no/partial/full requirements, one versus two guest accounts, repeat account across requirements, self/anonymous/unauthorized response, wrong/inactive venue, missing drink purchase, response before start/at end and lock wait across the boundary.
- Claims: before end, exact end, seven-day expiry, cancellation, old-event exclusion, unauthorized host, duplicate event with different retry ID, daily cap across events/characters, midnight stale snapshot, reputation 99/100 and atomic rollback.
- Actual RLS role tests: other-account receipts/results hidden, no direct writes, restricted configuration/helpers. Verify existing party responses and mood retain their behavior; add a regression for the event-centre guest path.
- Use independent connections for concurrent responses/claims when available; single-connection PGlite is not race/deadlock proof. Record any untested lock/concurrency conditions explicitly.
- Focused service/UI/database tests, typecheck, scoped/global lint, game/public builds, full regression and 375px browser fixture. Current unrelated renderer expectation failure and existing lint debt remain separately reported; do not weaken or silently rewrite those expectations.

This turn adds only this plan; validation is `git diff --check`. No feature tests are claimed. Existing Phase 3.4 work remains preserved. No Git writes, dependencies, migration generation/application, hosted data changes or deployment. Career progression (4.2), stall income (4.3), invitations and later phases remain deferred.

Approval requested: **Phase 4.1 only**, including the attendance repair, preservation of existing mood behavior, new +1 reputation reward, two-account/all-requirements success rule, seven-day claim window, one event/account/Lagos claim-day cap and local migration/acceptance work above.

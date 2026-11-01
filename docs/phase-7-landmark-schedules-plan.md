# Phase 7.1a — shared-clock map activity schedules

Date: 2026-11-01 (Africa/Lagos). Status: implemented locally; hosted deployment is not verified.

## Scope and verified findings

The next master-roadmap item is time-based landmarks. This proposal is one coherent first slice: make existing map activity schedules use authoritative shared world time and expose those schedules accurately in the landmark sheet. It does not claim to complete all Phase 7.1 venue scheduling.

Source audit:

- `drizzle/migrations/0024_shared_hud_simulation.sql:2` defines `world_clock()` from database `now()` in `Africa/Lagos`. Hours/minutes follow real server time; day is measured from 2026-01-01 and weekday is Monday-based. Personal simulation pause/speed is separate and does not pause this clock.
- `src/lib/simulation-service.ts:95` validates the clock RPC response. `src/hooks/use-world-clock.ts` polls it every 15 seconds. These are shared time snapshots, not evidence of an accelerated global game clock.
- Migration 0024 replaces `_economy_shop_is_open` to use `world_clock()`, despite retaining the old personal-hour parameter for compatibility. Existing purchase RPCs call this helper.
- `drizzle/migrations/0073_database_map_actions.sql` is the latest located map action definition. It loads rules from `map_landmark_actions`, validates character/location/age via existing boundaries, and protects mutations with request receipts. However, its opening-hours check uses `player.game_time_hour`. Cooldowns and activity time costs also use personal game time; those serve a different purpose and should remain personal.
- The same migration's `map_get_landmark_details` returns database action definitions but no current schedule availability. `src/components/map/LandmarkSheet.tsx` caches details for five minutes. `PlaceActionMenu.tsx` calls all listed actions “available” and does not explain their configured opening hours.
- `src/lib/map-place-action.server.ts` authenticates the request, derives the user ID, checks landmark details and calls the trusted RPC. It sends an empty action definition because the database owns rules. Preserve that boundary and the `Idempotency-Key` contract.

These are local source findings. The hosted migration ledger and actual deployed functions were not queried.

## Conflicts requiring an explicit scope decision

| Surface                     | Current source behavior                                                                                         | Master-roadmap example              | Proposed decision for this slice                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------- |
| Town market map activities  | Browse/social: 06:00–21:00; work/cleanup: 07:00–18:00                                                           | Busier 08:00–16:00, closed at night | Preserve configured hours. No crowd or price/mood multiplier.        |
| Lantern Club map activities | 18:00–03:00, crossing midnight                                                                                  | Opens at 18:00                      | Preserve these hours and check them against shared time.             |
| Party club entry            | `enter_club` in `20261019100000_party_life.sql` checks identity, venue and current visits, but has no hour gate | Club opens at 18:00                 | Defer door/ongoing-visit scheduling to a separate Party-system plan. |
| Shops                       | Individual configured hours; Osun Mall wholesale is seeded 08:00–21:00 in migration 0049                        | General market example              | Preserve shop rules; do not infer a single market-wide closing time. |

The local town JSON mirrors the map activity hours above; the database remains authoritative at runtime. The label will say **Map activity hours**, not “venue open/closed.” Travel remains available even when activities are closed. An outside visit, an event invitation, a shop purchase and a club-entry session are separate existing actions.

Approving this plan chooses preservation of configured hours and the narrow clock-alignment slice. It does not authorize changing market hours or adding a Party club curfew. The remaining Phase 7.1 work will need its own architecture/game-loop decision.

## Proposed architecture and game loop

1. Player opens a landmark. The existing authenticated details endpoint returns action definitions plus a server-generated schedule snapshot: sampled shared world day/hour/minute, each action's opening/closing hours, and whether that action is currently within its scheduled hours.
2. The sheet shows per-action hours and current availability, explicitly in shared Lagos world time. It does not use the device clock, personal simulation clock or a fabricated fallback to declare an activity open.
3. While the sheet is visible and online, refresh schedule details at a short bounded interval (15 seconds), on focus and after a closed-action rejection. Use account/character/landmark-scoped query keys, clean up listeners/timers and retain existing invalidation behavior. Never show a previous account's location or eligibility from cached details.
4. The confirmation control is disabled for a known closed activity, pending mutation or offline state. An unavailable/stale schedule is labeled as unverified and offers refresh; cached availability must not be presented as a fresh guarantee. A “within hours” result does not promise that travel, age, job, cooldown or funds requirements are met.
5. On action submission the server re-evaluates scheduled hours using shared world time captured after existing action locks. It preserves existing location/age/ownership/cost/cooldown rules and atomic rewards. A boundary-crossing rejection refreshes the sheet with a useful message and no automatic retry.
6. A previously successful request replay returns its original receipt even after closing. A rejected request never consumes rewards or charges. New actions require current eligibility. No client-supplied time or hours are accepted.

Use one internal SQL schedule predicate for both detail projection and mutation checks. Define start inclusive/end exclusive; support overnight ranges and the existing end=24 representation. Inspect and preserve existing equal-hour semantics; validate malformed definitions explicitly rather than treating missing hours as open. Any invalid-rule behavior change must be documented and regression-tested. Keep browser formatting separate from the authority decision.

Map rendering, housing markers, personal action duration, personal cooldowns, world-clock speed and pause settings are unchanged. No new dependencies, NPC crowds, landmark-wide closure overlay, prices, mood rewards or exploration payouts.

## Database and security scope after approval

Use a new dated migration generated by the Supabase CLI. Never edit applied migrations. Extend the existing details response additively and update the existing `perform_map_place_action` schedule check while retaining its signature and receipts. Any helper is private to trusted SQL callers; preserve existing service-role-only RPC grants, age restrictions and server-derived user identity. The details path stays read-only.

Inspect current lock ordering, privileges and all details consumers before editing. Load the repository Supabase and Postgres guidance before SQL authoring. Baseline prerequisites include world-clock migration 0024, expanded-town data and database map actions 0073; reconcile the mixed Drizzle/Supabase chains in the local fixture. Do not apply hosted migrations, reset a database or assume the hosted schema matches source.

## Expected files

- One new migration under `supabase/migrations/` (filename generated only after approval).
- `src/lib/map-api.ts` and related response validation/types for the additive schedule projection.
- `src/components/map/LandmarkSheet.tsx`, `PlaceActionMenu.tsx`, and narrow existing styles for schedule text and state handling.
- `src/components/game/CityMapDashboard.tsx` only if scoped invalidation or error refresh requires it; preserve renderer and travel contracts.
- Relevant SQL, API and component tests; a focused 375px browser fixture; implementation and release notes.

## Acceptance tests

- Real SQL: two players with different personal hours receive the same schedule availability at the same trusted shared time. Personal pause/speed does not change it.
- Boundary cases: 05:59/06:00/20:59/21:00 for market browsing; 17:59/18:00/02:59/03:00 for overnight club map actions; end=24, equal-hour and malformed definitions.
- Reject direct action attempts when closed, forged definitions/time, wrong location, unauthorized access and age restrictions. Preserve legacy receipt replay after closing and demonstrate no double charge/reward. Verify detail reads do not write.
- Verify personal cooldowns and action-time costs remain personal after changing only the opening-hours clock. Existing shop and Party behavior remains intact.
- UI/API: current, closed, unknown, stale, offline and initial-error states; boundary refresh; account/character switching; no duplicate submission or queued offline mutation. Use accessible labels and existing 44px controls.
- Browser: 375px sheet scroll, readable overnight hours, usable travel and close controls, housing markers preserved. Distinguish synthetic fixture checks from actual authenticated gameplay and device evidence.
- Run focused Vitest, typecheck, scoped/global lint, game/public builds, full single-worker suite and `git diff --check`. Report exact results. Independent-connection contention and hosted RPC/RLS remain separate release checks.

## Implementation and verification

The owner approved continuation of this scoped plan. Implemented the shared Lagos schedule snapshot, database-owned start-inclusive/end-exclusive and overnight eligibility, schedule-aware landmark activities, account/character-scoped query and pending-action keys, 15-second online refresh, stale/offline blocking, manual refresh, and closed-boundary refresh. Configured hours, shop behavior, Party entry, personal action durations/cooldowns, and receipt replay semantics remain unchanged.

Local verification: four focused Vitest files passed (**19 tests**), including PGlite execution of the migration, rule boundaries, malformed schedules, closed-action rejection without mutation, ignored client-supplied hours, all-day action execution, receipt replay after closing, and RPC grants. Typecheck, scoped ESLint, and `git diff --check` passed. No full-suite, game/public build, global lint, hosted migration/RPC/RLS check, independent-connection contention check, or browser/device fixture was run.

The migration intentionally depends on `drizzle/migrations/0073_database_map_actions.sql`, which provides `map_landmark_actions`; it now fails early with a clear message if that prerequisite is absent. The local PGlite fixture creates the prerequisite table shape rather than applying the entire mixed Drizzle/Supabase migration history. Confirm the hosted migration ledger and prerequisite table before deployment. No hosted SQL, deployment, commit, push, PR, or merge was performed. Remaining Phase 7 venue scheduling, Party club hours, exploration rewards (7.2), lifestyle achievements, and broader world work remain deferred.

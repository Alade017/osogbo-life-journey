# Phase 3.2 weekly-event reconciliation

Date: 2026-10-25, Africa/Lagos. Status: architecture proposal after the owner's “proceed”. The owner subsequently approved this plan, authorizing Phase 3.2 only. See `phase-3-weekly-events-implementation.md` for implementation details and evidence; the pre-implementation proposal below is retained.

## Verified baseline and gaps

The working tree was clean at audit start, on owner commit `27e3b036` (`implement daily task to the game`). No history was changed. Phase 3.1 and the home benchmark are preserved.

- `0024_shared_hud_simulation.sql` already defines weekly market, gathering and arts windows in `join_city_event`. It checks trusted world weekday/hour, weather, current location and active venue, and inserts unique `(character_id,event_id,world_day)` participation. Repeated joins do not create a second record. It awards no money, XP, mood or reputation.
- `world-simulation.ts` separately defines the same schedules, names and venue slugs. `WorldEnvironment`, `CityEventParticipation` and `CityMapDashboard` independently decide which events are active from that client catalog. The backend remains authoritative for joins, but the UI can drift from it.
- The map filters `event.locationSlug === selectedDistrict.id`, mixing location slugs (`oja-oba`, `cultural-district`) with current district IDs (`market-quarter`, `east-gate`, etc.). Source inspection confirms this mismatch; no authenticated visual reproduction is claimed.
- `CityEventParticipation` stores joined state only in component memory. Reloading loses that display state even though participation is durable. `joinCityEvent` casts, rather than validates, its response.
- The market event displays a real-place name. The two other events target `cultural-district`; migration 0022 associates that legacy node with sacred-site metadata. This conflicts with the master prompt's fictional public-venue direction. This audit does not assert that either legacy venue is currently active in a hosted database.
- `town_events` in migration 0060 is a separate phone reminder system with dated events. It is not the recurring participation schedule. No second reminder/calendar system is proposed.
- `world_clock()` uses trusted Lagos calendar time. Personal simulation time must not control weekly windows. Existing weather and power-outage helpers are separate systems and will retain their behavior.

## Proposed scope

Reconcile the existing three weekly events, retaining their IDs, weekdays and hour windows. Rename `market-day` for the fictional **Town Market**, targeting stable location/landmark slug `town-market` in `market-quarter`. Keep **Riverlight Community Gathering** and **Open Courtyard Arts**, targeting **Youth Arts Centre**, stable slug/landmark `youth-arts-centre` in `east-gate`. Verify current server venue availability before seeding; missing venues must cause an explicit prerequisite failure, not a silently broken link. Do not rename legacy server location slugs globally or rewrite existing participation history.

No new payout, discount, fee, price adjustment, mood, reputation or powered-appliance effect. The event's visible effect is shared active/upcoming status and durable attendance, as in the existing loop. Any later economy or mood effect needs its own balance/security review. Login streaks and living costs remain deferred.

## Server architecture and game loop

Use one server-owned recurring-event catalog and stored occurrence windows. The catalog contains the existing event ID, fictional title/description, validated venue reference, explicit map landmark/district references, weekday, local start/end and outdoors flag. Validate schedule bounds and references. Each stored occurrence has a unique event/start key and absolute `starts_at`/`ends_at` timestamps, with `ends_at > starts_at`. The server materializes the relevant current/next Lagos-week windows transactionally and idempotently from catalog rules; no client selects dates, venues, windows or effects, and no hosted cron is necessary for this slice. Materialization must preserve historical occurrences rather than rewriting their schedule when catalog values change.

Expose a typed authenticated snapshot RPC containing server time, active/upcoming occurrences, weather availability, venue/map references and the current character's joined state. All players observe the same stored schedule and server-derived activation/cancellation; only attendance is personalized. Determine active state with half-open windows `[starts_at, ends_at)` and the existing trusted weather function. Shared schedule rows are readable to authenticated users; own attendance is the only private data returned.

Keep the existing `join_city_event(p_event text)` contract and existing participation table/key. Update its internals to validate against the same stored occurrence and catalog. Resolve and lock the authenticated current character first, then capture the database clock and revalidate the current window, weather and venue after waits. Insert existing participation once; duplicates return the established `joined/duplicate` result. A retry after an event expires reports expiry rather than joining a later occurrence automatically. Read snapshots restore joined state after navigation/reload. No new user/character ID argument or production test-clock override is accepted.

Catalog/occurrence writes are server-only, with RLS enabled and direct browser writes revoked. Preserve own-participation RLS and audit existing helper execution grants. Privileged RPCs use qualified references, safe fixed search paths, session-derived identity and the existing registered-account policy. Bound materialization to current/next week so reads cannot generate arbitrary historical/future rows. New foreign keys and snapshot/attendance queries need appropriate indexes. Use server timestamps throughout, independent of browser clock, timezone and personal pause/speed.

## Client integration

Add a validated event service and account/character-scoped query for the personalized snapshot, shared across the existing consumers. Poll/focus and refresh near server-provided boundaries; unavailable snapshots must show unavailable state rather than fabricated active events. Client countdowns are display-only.

- `WorldEnvironment`: retain world lighting/weather/outage behavior and existing styling; use snapshot event titles, links and occurrence IDs for announcements. Announce an occurrence transition once, including expiry/weather closure, without replaying notifications on ordinary query refreshes.
- `CityEventParticipation`: use the snapshot's venue and joined state, preserving is-here guidance. Disable pending/offline submissions, validate the join response, refresh after success/rejection, and restore the joined label after reload. Do not infer attendance from an arbitrary truthy response or local state alone.
- `CityMapDashboard`: match the snapshot's explicit district/landmark references to the actual selection. Preserve map travel and action payloads. Do not compare unrelated identifier namespaces.
- `world-simulation.ts`: retire the duplicated event catalog from active consumers and adjust its tests. Keep independent world/weather/travel helpers unchanged. Leave phone reminder rows/UI unchanged; merging calendars would be a separate feature.

Loop: fetch shared schedule plus own attendance → view a fictional active/upcoming event → use existing travel → request join → server revalidates window/weather/venue → record attendance → refetch and display confirmed joined status. No renderer or economy migration is part of this loop.

## Migration and expected files

After approval, generate one new dated Supabase migration using the inspected CLI workflow, without editing applied SQL or mirroring definitions into Drizzle. Local acceptance applies the current canonical Drizzle schema baseline, approved daily-task migration, then this migration; document exact prerequisites and ledger boundaries. The existing Drizzle-only runner will not apply dated migrations. No hosted migration, production data write or deployment is included.

Expected changes: new event service/hook and tests; `world-simulation.ts`, `simulation-service.ts`, `WorldEnvironment.tsx`, `CityEventParticipation.tsx`, `CityMapDashboard.tsx`, affected map/world tests, database types, new dated migration and QA documentation. Reuse the existing event participation table, route, design tokens and travel functions. No new dependency is expected.

## Acceptance criteria

- Execute the real migration/RPCs locally. Verify current/next occurrence creation, repeated-read idempotency, common schedule across two identities, own-attendance isolation, unknown events, inactive/missing venues, wrong location and anonymous/unauthenticated rejection.
- Verify before/exact start, before/exact expiry, Lagos midnight/week rollover, outdoor heavy-rain cancellation, indoor availability, duplicate joins and reload persistence. Keep test clock substitution only in the disposable database.
- Exercise actual RLS roles and blocked direct catalog/occurrence/attendance writes. Assert wallet, XP, mood and reputation are unchanged by a join. Preserve historical attendance records and existing event IDs.
- Independent-connection joins and a lock wait spanning expiry need a real local Postgres environment; single-connection PGlite cannot prove those cases. Record any unavailable environment explicitly.
- Client tests cover malformed responses, error/offline/pending states, persisted attendance, expiry during a join, correct district/landmark matching and one announcement per occurrence transition. Preserve daily-task and travel regressions.
- Check a 375px browser fixture with active/upcoming/unavailable/joined states and no horizontal overflow; distinguish synthetic RPC fixtures from authenticated gameplay. Run focused tests, typecheck, scoped/global lint, game/public builds and full regression after implementation. Report existing lint debt separately.

## Approval and current-turn boundary

Approve this **Phase 3.2 reconciliation only**, including fictional venue reassignment, stored server occurrence windows, existing join-contract preservation and the three existing consumers. No rewards or new event types are proposed. Phase 3.3 onward and PlayCanvas default adoption remain gated.

This turn adds only this plan. No application code, migration, dependency, production state, branch, commit, push or deployment changes. The existing world/shared-HUD tests are run as audit evidence, not as proof of this future design or hosted behavior. Audit checks: `npx.cmd vitest run src/test/world-simulation.test.ts src/test/shared-hud-database.test.ts --maxWorkers=1 --reporter=verbose` passed **22 tests across 2 files, zero skipped**, exit 0, 11.63 seconds. `git diff --check` passed. These tests cover the existing implementation; the proposed occurrence storage, unified snapshots and consumer changes have not been implemented or tested.

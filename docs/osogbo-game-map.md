# OSOGBO LIFE city map

The authenticated `/map` route uses an original, fictional 2.5D isometric SVG city. It does not request map tiles, real-world coordinates, routing services, or a map-provider key. The layout takes visual cues from the supplied HUD reference while keeping the streets and districts fictional.

## World data and save compatibility

District geometry, road nodes, pathfinding, building placement, and legacy location-slug mapping live in `src/lib/city-world.ts`. The graph is presentation/game data and is not duplicated in the database. Existing location rows remain the source for names, availability, descriptions, and travel fares.

Migration `0021_fictional_city_world.sql` adds bounded world coordinates and a position revision to characters. It backfills each existing `current_location_id` to an entrance node, retains existing wallet, career, inventory, and employment records, and adds an idempotency ledger for movement/travel operations. The old virtual latitude/longitude columns are retained for compatibility.

Apply the ordered SQL migrations through `0023_restore_travel_to_location_rpc.sql` using the repository's controlled Supabase migration workflow (`DATABASE_URL` is migration-job-only). Do not deploy the updated client before the migration is applied. Migration 0023 restores the mode-aware `travel_to_location(uuid,text)` function and asks PostgREST to reload its schema cache; this resolves the missing-function error when migrations are behind or the cache is stale. The frontend falls back to the mapped entrance for old/null coordinate values, but authoritative walking and travel RPCs require these migrations.

## Movement and location interaction

- Drag to pan, scroll or use the controls to zoom, and pinch on touch screens. Reduced-motion settings disable animated traffic and panel transitions.
- Tapping an open street calculates a route on the local road graph. The avatar follows a short route and the server validates distance, energy, game-time cost, bounds, and expected position revision before persisting it.
- Selecting a different district opens a drawer over the map. Danfo, keke, okada, and car choices call the existing authoritative travel operation through the idempotent `travel_to_city_location` wrapper. The server remains authoritative for fare, simulation time, destination requirements, and wallet changes.
- Selecting a location in the current district provides its details and the existing location page. Shops, jobs, and social systems remain connected through their existing routes and server actions.
- Place, job, and NPC counts come from the existing Supabase records; decorative roads, trees, traffic, and district areas are client-side scenery.

## Reproducible checks

1. Apply migrations through `0021_fictional_city_world.sql` to the staging Supabase database.
2. Sign in with a character whose `current_location_id` is populated. Confirm the character appears at the mapped entrance and that wallet and employment history are unchanged.
3. Tap a nearby street. Verify the avatar follows the local route, energy and simulation time are charged once, and `world_position_revision` increments.
4. Select a different district and travel by Danfo. Verify the existing wallet transaction, time advance, destination, and world position update once. Retry the same request ID in an RPC-level test and verify the idempotency ledger returns the original result.
5. Test a low-energy walk, invalid/stale revision, and invalid position; the server must reject each without changing money or position.
6. Verify drag, wheel/zoom controls, pinch zoom, filters, drawer dismissal, keyboard location selection, and mobile layout at narrow widths.

The SQL migration must still be applied and exercised against staging before claiming database-level save compatibility or idempotency has been verified.

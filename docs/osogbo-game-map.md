# OSOGBO LIFE game map

The authenticated map route uses MapLibre GL JS and the hosted Stadia Maps Alidade Smooth vector style as its geographic base. The style provides a muted canvas for the game's player and location overlays. OSM attribution remains visible through MapLibre's attribution control.

## Provider configuration

Copy the map settings from `.env.example` into the local environment as needed:

- `VITE_OSOGBO_MAP_STYLE_URL` selects the style URL. It defaults to the Alidade Smooth hosted style.
- `VITE_STADIA_MAPS_API_KEY` is optional for local development and can be used when the provider configuration requires a key. Values prefixed with `VITE_` are public in the browser bundle, so restrict keys to approved domains.

Configure domain-based authentication for the production website in the Stadia Maps dashboard. The public OpenStreetMap raster endpoint exists only as a development fallback if the hosted style fails to load; it is not the production map provider. Do not prefetch or bulk-download tiles. Check the current provider terms and usage policies before deployment.

## Locations and data quality

The map requests active locations for the current viewport through the existing Supabase query and uses GeoJSON clustering to keep dense views responsive. Locations with missing or invalid coordinates are omitted from the map. Location records are not fabricated by the client.

No verified real-world Osogbo POI seed dataset is included in the project migrations. Add real places to Supabase only after confirming each place's name and coordinates from a reliable source. Keep fictional gameplay locations clearly identified in their record metadata and descriptions.

If a database has not been migrated to the current location/map schema, apply the existing migrations in order, including `0012_location_search_index.sql`, `0013_virtual_player_movement.sql`, and `0014_location_interaction_radius.sql`. These files are additive; they do not seed invented real-world coordinates.

## Map behavior

- MapLibre owns the map instance and is torn down with its React component.
- Locations are fetched for the visible geographic bounds, clustered at low zoom, and shown individually with category symbols and readable labels at closer zooms.
- Use the map filters or the keyboard-accessible “Browse locations” list to select a mapped place and open its existing details popup.
- If the hosted vector style fails during local development, the map attempts the OSM raster fallback with attribution. Production shows a retryable map error instead.
- Player virtual movement and nearby-location prompts use the existing player and proximity architecture; this map update does not add GPS.

## M5 destination and travel model

- Keep one `locations` table as the source of destination records. Optional neighborhood data belongs in `metadata.neighborhood_id` and `metadata.neighborhood` (or `neighborhood_name`). The map exposes a neighborhood filter when this data exists.
- Location category, opening hours, available actions, entry fee, accessibility, interaction type, unlock requirements, and transport restrictions use the typed normalization in `src/lib/location-service.ts` over optional metadata. An entry fee can be a number or `{ "amount": number }` and is treated as game Naira.
- `metadata.available_transport_modes` can restrict a destination to a subset of `walking`, `danfo`, `keke`, `okada`, and `car`. Without a restriction, these are available as game simulation modes. They do not assert that a real public transport service is operating on a street.
- Mode fare and simulation-time factors live in `src/lib/transport-service.ts` and are mirrored by the authoritative `travel_to_location(uuid, text)` RPC in migration `0016_transport_mode_travel.sql`. The RPC validates destination, unlock level, mode, and balance; charges atomically; records the visit; advances game time; and saves the in-bounds destination as the virtual player position.
- OSRM driving geometry is an optional street-distance estimate only. A missing/unavailable route keeps the configured game fare/time estimates and shows a fallback message. It does not fabricate path geometry, walking routes, bus stops, or transfers.

## Manual verification

1. Apply pending SQL migrations through `0016_transport_mode_travel.sql` to the Supabase project.
2. In Supabase, ensure active destination records have reviewed latitude/longitude. Populate optional `metadata.neighborhood` to test neighborhood filtering. Do not use the approximate virtual district markers as verified real-world POIs.
3. Sign in, open **City Map**, pan and zoom, search a known mapped location, toggle its category, and select its marker to open the details popup.
4. From a destination detail page, choose **Choose destination**. Confirm the origin/destination, select several travel modes, and verify fare and game duration change. When routing is available, confirm that the separate car-road distance is shown; disable/fail the configured routing endpoint to verify the labeled estimate fallback.
5. Try a fare above the wallet balance and confirm the server rejects the trip with no balance change. Repeat with a valid fare and verify exactly one transaction, updated game time, visit record, and player location.
6. Repeat on a narrow mobile viewport and verify map touch gestures, filter controls, destination details, and travel controls remain usable.

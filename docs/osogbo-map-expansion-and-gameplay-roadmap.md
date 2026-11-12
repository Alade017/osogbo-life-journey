# Osogbo map expansion and gameplay roadmap

This plan expands the playable game map in selected phases. It does **not** attempt to reproduce all of Osogbo or claim that the game map is a survey-grade geographic map.

## Owner-approved direction

- Keep the existing React Three Fiber / Three.js town renderer and current playable-neighborhood renderer. Do not introduce SVG or a second renderer.
- Expand the selection of places and connected playable areas incrementally. Each new area must be useful and reachable, not just extra empty grid.
- Increase the town overview zoom-out and zoom-in range while keeping camera controls usable on mobile.
- Keep existing location slugs, district identities, travel commands, home/property ownership and server-authoritative multiplayer contracts.
- Do not change economy rules, SQL schema, seeds or migrations as part of map expansion.
- Use data-driven map geometry and landmark metadata; do not invent live database destinations or claim unverified coordinates.
- The intended map is a selected Osogbo-inspired game region, not the entire city boundary.

## Map design approach: inspired by Osogbo, not traced from it

The map is an original game-world layout. Real Osogbo is a source of **place-name, architectural, cultural and neighbourhood inspiration only**. Do not import, trace, digitise, reproduce or align real-world road centre-lines, satellite imagery, GIS polygons, exact building footprints or surveyed coordinates.

- Place familiar areas and landmarks in a believable game layout that supports good exploration and gameplay.
- Their relative placement is a creative design decision, not a claim about exact real-world distance, direction, adjacency or scale.
- Use recognisable Osogbo/Nigerian street character, markets, compounds, civic spaces, transport stops and local architecture as visual references.
- Keep fictional businesses, venues and game-only destinations clearly fictional even when placed in an Osogbo-inspired district.
- The world should feel coherent and navigable, not geographically identical to the real city.

## Data-driven map authoring and no-hardcoding rule

- Keep map dimensions, district definitions, road segments, place metadata, building footprints, entrances and spawn/exit points in typed map data/configuration, not scattered conditional logic or renderer constants.
- Derive camera bounds, world extents, road connectivity, traffic routes, pedestrian routes, district hit areas and map labels from the authored map data.
- Use stable IDs and references between places, buildings, districts, entrances and supported game interactions. Avoid duplicate names/IDs and positional assumptions based on array order.
- Use reusable generators/helpers for repeated layout patterns, with explicit data overrides for meaningful places; do not embed one-off coordinates or landmark-specific branches in rendering components.
- Validate map data at load/test time: dimensions, rectangular rows, allowed tile symbols, in-bounds coordinates, unique IDs, valid district/place/building references, non-overlapping reserved footprints, reachable entrances and connected road/pedestrian graphs.
- Adding a visible place must also define its data identity and supported interaction. Do not invent database destinations or wire fake actions.
- Keep the authored map data versioned and deterministic so the frontend and multiplayer room can agree on collision, movement and interaction locations.

## Current staging implementation

The first coverage expansion has been authored in `src/data/osogbo-town.json`:

- Grid: 32 columns × 24 rows (up from 24 × 18).
- Districts: 17 (up from 11), with non-overlapping in-bounds authored areas.
- Landmarks: 35 (up from 26), including selected Oja-Oba, Ataoja, Oke-Baale, Aleku-Wodo, Ogo-Oluwa and Oke-Fia inspired points.
- Building footprints: 26 retained; the new destination markers are kept separate from building geometry until their building/interior work is implemented.
- Road cells: generated from the existing authored road spacing and extended across the new grid; the current road graph is connected.
- The Osun-Osogbo Sacred Grove is represented as a data-driven map-only point, not a playable travel destination.
- The existing destination slugs and server travel/action flows are preserved. No new database migration or backend destination is introduced by this map pass.

The map validator and integrity tests now check authored dimensions, tile symbols, district bounds/overlaps/outlines, landmark and building identities, map-only point types, terrain overlays and road connectivity. These checks have been added to the test suite; they still require execution in the local project environment.

## Implementation phases

### Phase A — camera range and map controls

- Town overview uses map-specific zoom limits rather than the global defaults.
- Current town-camera range: minimum zoom factor 0.42; maximum zoom factor 3.4; initial zoom 1.55.
- Keep the default camera framing and close-up landmark focus.
- Verify wheel, trackpad, touch pinch, pan, landmark selection and portrait-screen framing.
- Tune the range after browser/device review if labels, clipping or navigation become difficult.

### Phase B — selected geography and map coverage

Build the next game areas as connected, original, data-authored map modules inspired by Osogbo's character (never traced from real map geometry):
1. Strengthen the traditional core around Oja-Oba, palace / civic surroundings and Isale-Osun / Olu-Ode connections.
2. Add selected Station Road, Old Garage and Okefia links as the next connected urban section.
3. Add selected Olaiya, Jaleyemi and Alekunwodo links.
4. Add one outer residential slice such as Oke-Bale or Dada Estate only after its entry/exit and road connectivity are tested.

For every area:
- Define road segments, intersections, sidewalks, pedestrian crossings, district bounds and landmarks in the map data; derive their rendered geometry and movement routes from that data.
- Preserve the existing district and location IDs; new clickable destinations require a real existing backend destination or separately approved backend work.
- Validate connected roads, building footprints, spawn/exit reachability, pedestrian routes and camera bounds.
- Keep the map streamed or phased; do not load every planned district and all its props at once.

### Phase C — enterable buildings and interiors

- Reuse the existing full-page building / home / venue flows and the existing interior renderer.
- Add an explicit building-to-location identity, entrance point, approach path and allowed interaction type.
- Prioritise a small representative set: market stall/shop, bank/service, clinic, workshop/adire maker, home and transport terminal.
- Enter only after existing travel / location / permission checks confirm the destination.
- Use existing domain actions and authoritative results; do not add parallel economy or payment logic.
- Treat decorative buildings as non-enterable until they have a valid interaction contract.

### Phase D — NPC routines and social interactions

- Extend the existing NPC simulation and NPC interaction services rather than adding a second NPC system.
- Give selected NPCs data-driven roles, schedules, work/rest/social destinations and conversation intents.
- Keep ambient local movement separate from authoritative player state.
- Persist relationship, reward or job outcomes only through existing server-authorized services.
- Test time transitions, crowd density, blocked paths, multiple players and reconnects.

### Phase E — traffic and transport gameplay

- Build on the existing road-derived traffic and pedestrian routes.
- Add route destinations, intersection priorities, yielding and stop behaviour in deterministic helpers.
- Add boarding / alighting and vehicle-use interactions only when a valid transport entity, ownership/availability rule and server-authoritative movement contract exist.
- Do not allow a decorative car or keke to imply that it is drivable.
- Preserve safe pedestrian paths and mobile performance.

### Phase F — multiplayer consistency

- Keep the Colyseus room authoritative for player movement and shared player presence.
- Use the same area definitions and collision/entrance data on client and room server.
- Synchronise only meaningful shared state (player position, active interaction and supported vehicle state), not decorative animation.
- Test two or more accounts in one area, area changes, disconnect/reconnect, late join, blocked entry and server/client version mismatch.
- Coordinate frontend and Railway room-server releases whenever shared collision or area data changes.

## Acceptance gates

A phase is not complete merely because the map renders.

- **Map coherence:** selected places are intentionally arranged, all map coordinates are valid, road and pedestrian graphs are connected where intended, and no layout is presented as an exact real-world trace.
- **Scale:** map can zoom from district context to landmark detail without clipping, loss of controls or unreadable labels.
- **Buildings:** each advertised entrance reaches a valid interaction and safe exit.
- **NPCs:** routines are deterministic and avoid buildings, roads and player spawn points.
- **Traffic:** routes stay on roads, intersections are handled safely and pedestrians are not blocked.
- **Multiplayer:** server remains authoritative and two-client checks pass.
- **Performance:** test at 375px mobile and desktop; record actual frame-time and memory evidence before claiming performance improvement.

## Protected scope

No database migration, SQL execution, economy change, production server rollout, merge to main or deployment is included in this roadmap. Keep all implementation on the staging feature branch until review and acceptance.


## Transport gameplay review — boarding is not yet server-backed

The current town renderer has interactive traffic vehicles, bus-stop shelters and visual waiting-passenger meshes. The waiting passengers are generated from bus-stop positions in `MovingPedestrians3D`; they are presentation-only and their click callback opens the shared Transit Park travel selector. They do not represent persistent passenger records, stop-specific queues, reserved seats or a boarded state. Moving traffic is also client-rendered ambient traffic, not a transport vehicle entity with a server-owned trip lifecycle.

Do not implement boarding by locally hiding a passenger, moving a player into a vehicle, decrementing a client-side seat count or starting a client-only departure timer. Those approaches would diverge between multiplayer clients and could bypass fare, location, capacity and travel validation.

A safe boarding phase requires an existing or separately approved server-authoritative contract that can validate at minimum:

- stable vehicle, route and stop IDs;
- current vehicle trip and stop sequence;
- player proximity and eligibility at the selected stop;
- available capacity and idempotent boarding requests;
- fare/payment handling through existing authoritative economy rules;
- departure, arrival, cancellation and disembark state;
- Colyseus room/state replication so all clients observe the same occupancy and trip status.

Until that contract is confirmed, the supported interaction remains opening the existing travel selector. No database schema, migration, fare logic or multiplayer authority is changed by this review.


## Colyseus transport capability audit

Reviewed the active staging-branch room implementation and browser join service:

- `src/lib/multiplayer-service.ts` joins the authenticated `neighborhood` room with a location ID and access token. Its only client-to-room message added here is `refresh-equipment`; the room connection is removed on leave.
- `multiplayer/neighborhood-room.ts` authenticates the session, verifies that the character is saved at the requested active location, loads the shared neighborhood area and equipment, and maintains a 32-client room with a 50 ms authoritative movement simulation.
- The room currently registers `move` and `refresh-equipment` messages. Its replicated state is a set of network players. It has no vehicle-trip registry, stop-arrival state, passenger manifest, seat-capacity reservation, boarding/disembarking messages or transport-specific authorization.
- `src/lib/game.ts` documents and implements the existing rule that durable game-state changes go through server-validated RPCs. The town transit selector and map-place actions remain separate existing flows; they do not establish a vehicle occupancy contract.

**Conclusion:** the existing neighborhood room is a sound authenticated movement authority, but it is not currently a transport-trip authority. A client-side boarding animation or extra room message alone would not be sufficient: the server needs trusted route/vehicle definitions, stop proximity checks, capacity serialization, idempotency, fare integration and a clear durable-versus-transient trip lifecycle. Do not add this to the room until the data source and authoritative action contract are designed and separately approved. Keep current vehicle and passenger interactions as travel-selector entry points for now.


## Existing travel and fare contract audit

The travel source review found two existing server-owned flows. They are related but not interchangeable:

1. **City-map transport selection:** `src/lib/game.ts` calls `travel_to_city_location(locationId, mode, worldX, worldY, expectedRevision, requestId)`. The SQL wrapper validates the saved position revision and canonical destination coordinates, then delegates to `travel_to_location(locationId, mode)`. The latter accepts the existing modes `walking`, `danfo`, `keke`, `okada` and `car`; reads destination mode restrictions and base fare/duration; applies weather/traffic conditions; charges the wallet atomically when applicable; records the travel transaction; advances game time and needs; updates current location and visit progression; and returns the authoritative result. The browser's `src/lib/transport-service.ts` mirrors fare/time estimates for display only. The database function remains authoritative.
2. **Map landmark travel API:** `src/lib/map-api.server.ts` calls `map_start_travel(userId, landmarkId, idempotencyKey)`. Its separate `map_travels` record stores a destination landmark, distance, fare, duration, departure/arrival timestamps and a `travelling/completed` status. This flow locks the character and wallet, charges once under an idempotency key, and blocks conflicting location changes while a trip is active. It is not currently wired to a specific danfo/keke/okada/car entity or vehicle seat.

**Transport design decision:** do not make the new vehicle boarding feature call either existing flow as if it already represented a ride on a specific vehicle. The city-map RPC performs an immediate location transition and its fare is based on the destination and selected mode; the landmark API is a timed point-to-point trip but has no vehicle identity, capacity or passenger manifest. A true vehicle ride needs a separately designed server-owned trip contract that composes with existing wallet, travel-time, destination and location invariants without double-charging, bypassing progression or creating two competing active-trip records.

Before implementation, specify whether vehicle trips are (a) a new server-owned transport trip lifecycle that reuses existing fare calculation primitives, or (b) a clearly bounded presentation/boarding layer that only begins the existing city-map travel command after confirmed boarding. In either case, the server must decide boarding eligibility, seat allocation and departure; clients may only display replicated state. No existing migration, RPC, economy rule, seed or hosted database was changed by this audit.

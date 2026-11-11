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

## Geography reference and interpretation

The first expansion should reflect the structure of Osogbo rather than a uniform rectangular grid:

1. Traditional core: palace / Oja-Oba market area, Isale-Osun and Olu-Ode.
2. Intermediate urban area: Station Road, Okefia, Old Garage, Ajegunle, Olaiya, Alekunwodo, Jaleyemi, Hospital Road, Igbona, Ayetoro and Sabo.
3. Selected outer areas: Ogo-Oluwa, Oke-Bale, Dada Estate and the Ota-Efun / Powerline corridor.

The map should depict a connected but selective subset of these places. Keep the real-world place names where they are useful, while clearly labelling fictional businesses and venues as game locations.

Useful public references:
- UN-Habitat's Osogbo spatial-development overview describes the palace and Oja-Oba as the traditional core, railway-era growth around the station, and later residential expansion.
- Osun State's township-road project list identifies real links including Station Road–Ebenezer Hotel, Oja-Oba–Plantain Area, Gbodofon–Jaleyemi–Gbemu, Oke-Fia–Ita-Olokan and Oja-Oba–Oke-Baale.
- Osun State's road project pages identify the Alekunwodo network and Oja-Oba–Oke-Baale corridor.

References (checked 11 November 2026):
- https://unhabitat.org/sites/default/files/2020/09/osogbo_print_final.pdf
- https://www.osunstate.gov.ng/infrastructure/roads/township-roads/
- https://www.osunstate.gov.ng/Projects/ongoing-reconstruction-of-the-alekuwodo-road-network-in-osogbo/
- https://www.osunstate.gov.ng/Projects/ongoing-road-maintenance-work-along-oja-oba-oke-baale-road-osogbo/

These sources establish place and corridor relationships, not a complete current GIS road centreline dataset. Exact road geometry, landmark coordinates and boundaries must be verified against suitable mapping data before being treated as geographically accurate.

## Implementation phases

### Phase A — camera range and map controls

- Town overview uses map-specific zoom limits rather than the global defaults.
- Current town-camera range: minimum zoom factor 0.42; maximum zoom factor 3.4; initial zoom 1.55.
- Keep the default camera framing and close-up landmark focus.
- Verify wheel, trackpad, touch pinch, pan, landmark selection and portrait-screen framing.
- Tune the range after browser/device review if labels, clipping or navigation become difficult.

### Phase B — selected geography and map coverage

Build the next areas as connected, data-authored map modules:
1. Strengthen the traditional core around Oja-Oba, palace / civic surroundings and Isale-Osun / Olu-Ode connections.
2. Add selected Station Road, Old Garage and Okefia links as the next connected urban section.
3. Add selected Olaiya, Jaleyemi and Alekunwodo links.
4. Add one outer residential slice such as Oke-Bale or Dada Estate only after its entry/exit and road connectivity are tested.

For every area:
- Define road segments, intersections, sidewalks, pedestrian crossings, district bounds and landmarks from stable data.
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

- **Geography:** selected places are correctly related, road graph is connected, and real-world claims have source-backed coordinates or are labelled illustrative.
- **Scale:** map can zoom from district context to landmark detail without clipping, loss of controls or unreadable labels.
- **Buildings:** each advertised entrance reaches a valid interaction and safe exit.
- **NPCs:** routines are deterministic and avoid buildings, roads and player spawn points.
- **Traffic:** routes stay on roads, intersections are handled safely and pedestrians are not blocked.
- **Multiplayer:** server remains authoritative and two-client checks pass.
- **Performance:** test at 375px mobile and desktop; record actual frame-time and memory evidence before claiming performance improvement.

## Protected scope

No database migration, SQL execution, economy change, production server rollout, merge to main or deployment is included in this roadmap. Keep all implementation on the staging feature branch until review and acceptance.

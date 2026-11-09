# Reference-led production coverage audit

Reviewed: 9 November 2026  
Branch: `feat/phase-4-neighborhood-production-art`  
Reference source: owner-supplied 31-image `image models.zip`

## Audit boundary

This is a code and catalogue-structure audit, not a visual acceptance review. It checks the current renderer/model registries and existing catalogue integration points. It does not add catalogue rows, invent inventory identifiers, change database schemas, or recreate the household furnishing pilot already present on `main`.

## Coverage matrix

| Reference family | Existing project coverage | Assessment | Next action |
| --- | --- | --- | --- |
| Bedrooms, living rooms and kitchens | Six house types, R3F room renderer, procedural furniture fallback, starter furniture and kitchen/dining catalogue | **Existing foundation** | Reuse; inspect actual room compositions and placement at desktop and 375px |
| Household appliances | Refrigerator, microwave, deep freezer and other appliance branches in the room furniture renderer | **Partially represented** | Add no new item IDs; improve only catalogue-backed models that are visibly weak |
| Food and consumer packaging | Existing food preview registry, reusable clear pouch, paper snack tray, bakery sleeve, leaf wrapper and insulated flask | **Good first-pass coverage** | Visual QA; then add packaging variants only if a current catalogue item needs them |
| Bags, baskets, carts and retail packaging | Backpack wearable model; existing shop crates and vendor produce trays | **Partial** | Paper shopping/carrier bags and baskets are not yet evidenced as dedicated catalogue-backed models |
| Street vendors and kiosks | Vendor canopies, fabric valances, radial ribs, produce trays; roadside shop counter, shelves, signboard and crates | **Good first-pass world coverage** | Check scale, occlusion and mobile readability in the running neighborhood |
| Vehicles | Procedural city cars and existing road traffic dressing | **Partial** | Audit current vehicle data and road clearances before adding vehicle variants |
| Clothing and footwear | Existing shirt, trousers, shoes/slippers and backpack wearable renderers | **Core basics covered** | Nigerian patterned clothing and additional footwear require existing catalogue/appearance support before implementation |
| Gym equipment | Seven catalogue items: treadmill, multi-gym machine, dumbbells, yoga mat, dumbbell rack, full-length mirror and gym bag; all have branches in the room furniture renderer | **Catalogue-backed coverage exists** | Do not rebuild; verify all seven in the live room and check footprint/camera framing |
| Barbershop interior | No dedicated barbershop furniture model family was evidenced in the audited registries | **Gap, conditional** | First confirm a current service destination and usable catalogue entries; then model only supported props |
| Construction tools and site equipment | No dedicated construction-tool inventory model family was evidenced in the audited item registries | **Gap, conditional** | Confirm job/tool inventory IDs and gameplay usage before creating previews |
| Dense low-rise district / urban mood | Existing district architecture, authored neighborhood dressing, street furniture, lighting and road scene | **Existing foundation** | Visual review against the Art Bible; do not trace reference layouts or use photos as textures |
| City-map UI screenshot | Existing map dashboard and playable R3F neighborhood are separate established surfaces | **Existing foundation** | Keep renderer roles distinct; no SVG fallback or duplicate map renderer |

## Furniture catalogue-to-renderer cross-check

A follow-up read-only pass compared the existing housing catalogue migrations with the `FurnitureFallback` branches in `HouseRoom3D.tsx`. The audited catalogue art keys are all represented:

| Catalogue family | Existing art keys | Renderer coverage |
| --- | --- | --- |
| Starter and core fixtures | `bed`, `seat`, `light`, `stove`, `shower`, `toilet`, `television`, `computer` | Dedicated branches or existing aliases |
| Living-room and storage | `sofa`, `plant`, `wardrobe`, `coffee-table`, `drawer`, `wall-art` | Dedicated branches |
| Kitchen and dining | `fridge`, `microwave`, `deep-freezer`, `dining-table`, `dining-chair`, `plate-hanger` | Dedicated branches |
| Fitness | `treadmill`, `multi-gym-machine`, `dumbbells`, `yoga-mat`, `dumbbell-rack`, `full-length-gym-mirror`, `gym-bag` | Dedicated branches |

**Result:** no missing procedural furniture branch was found among the audited starter, essential-fixture, accessory, kitchen/dining and gym catalogue entries. This is source-level coverage only: it does not prove that each model fits its live slot, reads clearly at gameplay camera distance, or renders without visual artifacts. The documented visual QA remains required.

## Verified integration facts

- `ITEM_MODELS` remains keyed by existing inventory slugs and includes the existing food model registry.
- Worn models remain separated into backpack, clothing, bottoms and footwear registries.
- The house placement renderer resolves the server-provided `art_key` and sanitizes it before rendering. Furniture ownership, placement and inventory remain server-controlled.
- The house room renderer contains dedicated geometry branches for all seven gym catalogue entries. The gym catalogue test checks the seven IDs against the existing migration.
- The player-placed furniture GLB contract remains `public/models/furniture/<art_key>.glb`; the room renderer's procedural fallback remains available for missing models.
- The reference image set is inspiration only. No supplied image has been copied into the runtime bundle or treated as a licensed production model.

## Service, job and vehicle identifier cross-check

- The existing job seed includes `barber_assistant_osogbo` at the Oke-Fia location, and the world data includes the `oke-fia-salon` service destination. This supports the existence of the barber-service context, but the audited inventory/catalogue sources do not expose dedicated clipper, comb, chair or barber-tool item IDs. Do not add interactive salon props or inventory entries until their data contract exists.
- The existing `mechanic_assistant` job is assigned to the Old Garage workshop and uses the construction job category. The audited inventory migration does not establish dedicated construction-tool item IDs. Keep the mechanic role and existing workshop dressing; do not imply tool inventory or new repair interactions.
- `MovingTraffic3D.tsx` already cycles through four traffic types: danfo, keke, okada and taxi. The source had geometry for the first three but no taxi branch, leaving every fourth configured vehicle invisible. A compact taxi renderer has now been added using the existing traffic configuration and route data. This is a renderer-only correction; it does not change route generation, traffic authority or gameplay.

## Priority order

1. **Visual QA before more asset creation.** Inspect the current market and vendor dressing, food packaging, appliance models, clothing previews and all seven gym items in the actual R3F scene. Record clipping, z-fighting, transparent-material sorting, unreadable silhouettes and mobile performance.
2. **Catalogue-backed retail packaging.** If the current catalogue already contains paper bag, carrier bag, basket or carton entries, add original low-poly previews for those exact IDs. If it does not, leave the family as a documented gap; do not add schema or seed data as part of this art pass.
3. **Service and construction props.** Verify existing barbershop/service and job-tool identifiers before implementing. Do not create decorative props that imply unsupported interactions.
4. **Vehicles.** Audit current vehicle definitions and road widths, then test clearance and traffic interaction before expanding the model family.
5. **Cultural clothing variants.** Only extend the wearable system where existing appearance data and catalogue identifiers support the variant.

## Acceptance checklist

- [ ] Run local typecheck, focused tests, lint and production build after the review slice is complete.
- [ ] Capture the playable neighborhood at desktop and 375px mobile widths.
- [ ] Inspect market roof drainage, shop shelves/counters, vendor canopy ribs/valances and produce trays for overlap or clipping.
- [ ] Inspect food pouch transparency and label depth for sorting artifacts.
- [ ] Inspect all seven gym items in their actual room slots and confirm they fit without blocking paths.
- [ ] Verify player movement remains click/tap-to-move only and furniture actions remain server-backed.
- [ ] Confirm no economy, catalogue, ownership, travel, database or interaction rules changed.
- [ ] Do not trigger GitHub Actions; do not merge without explicit owner approval.

## Outcome

The strongest immediate opportunity is not another procedural detail. It is **visual verification and catalogue-backed gap closure**. The existing home and gym systems already cover more of the reference library than a file-name-only audit suggests. Retail carrier packaging, barber props and construction tools are candidate gaps, but each must be tied to current catalogue/gameplay data before implementation.


## Road clearance and traffic-route audit

A source-level review of `town-mobility.ts`, the authored `osogbo-town.json` road grid, `R3FTownSurface.tsx` and `MovingTraffic3D.tsx` confirms:

- The authored grid is 24 columns by 18 rows, with four full-width horizontal road rows and three full-height vertical road columns. The current adjacent-row/adjacent-column pairing produces six closed rectangular traffic loops for this layout.
- Each loop is emitted only when both vertical boundaries remain road cells throughout the interval. The horizontal boundaries are selected only from rows made entirely of road cells. No route is generated across an incomplete side.
- The caller supplies an inset of 16% of a road cell (0.32 world units for the current 2-unit cells). This shifts each loop corner inward and keeps the straight portions within the road strips; it is a rectangular-loop inset, not a lane-by-lane traffic system.
- Traffic interpolation follows the four points in order and wraps from the final point to the first. The vehicle heading is derived from the active segment direction.
- The current town grid does not justify changing the route algorithm: all authored roads used by this traffic loop builder form the expected complete rectangular network. The next correctness check is visual: confirm that long vehicle bodies remain inside the intersection footprint while rotating through 90-degree corners, and that the taxi/van silhouettes have sufficient clearance from each other and roadside props.

**Decision:** no route-generation or road-data change was made in this pass. Rewriting the route builder or inventing additional road links would be speculative without an actual scene capture. Keep the six existing loops and verify corner sweep/overlap in the live R3F scene before increasing traffic density or vehicle dimensions. The existing no-SVG and no-database-change constraints remain unchanged.


## Vehicle footprint versus road and roadside fixtures

The current road cells are 2 world units wide. The traffic model's largest body footprint is the danfo at 0.72 units wide by 1.45 units long; taxi is 0.64 × 1.18, keke is 0.55 × 0.90, and okada's frame is 0.14 × 0.65. On straight sections, the 0.32-unit route inset leaves at least 0.32 units between the danfo body edge and the nominal road-cell edge (before wheel/mesh details). This is a reasonable source-level straight-road fit.

The roadside audit found one tighter point:

- Traffic-light poles are placed at a 0.38-cell diagonal offset from an intersection-cell centre (0.76 units on each axis at the current scale). The traffic route corner is inset by 0.32 units on each axis. Along a straight approach, the danfo's 0.36-unit half-width leaves only about 0.08 units between its nominal body edge and the pole centreline; subtracting the pole's half-width leaves roughly 0.035 units of geometric clearance. This is close enough that visual overlap or shadow contact is plausible at a junction.
- Drains are placed beyond the road edge and curb offset, so they are not a direct straight-road vehicle obstruction. Utility poles are reserved on adjacent grass cells, not on road cells. Bus stops and roadside shops are likewise generated from reserved grass-side positions.
- The route builder does not model a vehicle's swept rectangle through a 90-degree turn. The centreline is continuous, but the danfo's long body can sweep across a larger area than its centreline suggests.

**Decision:** no traffic-light relocation, vehicle scaling or route offset change was made without a live scene inspection. The likely first visual checkpoint is the danfo passing the traffic-light pole at an intersection, followed by its 90-degree corner sweep. If the live capture confirms contact, move only the affected signal placement into a reserved roadside grass cell using the existing occupancy checks; do not shrink all vehicles or alter the road grid to compensate. Keep vehicle speed, route authority and gameplay unchanged.


## Intersection signal clearance correction

The R3F placement pass has now moved traffic-signal pole origins from an offset inside the intersection road tile to a deterministically selected diagonal grass tile. Candidate cells must be grass, outside building/water/plot reservations, outside parked-car cells, and outside the existing deterministic tree pattern. Each selected signal cell is unique.

The selected signal cells are also reserved from subsequent bus-stop, road-sign, roadside-shop, street-vendor, waste-bin and utility-pole placement passes. This avoids solving vehicle clearance at the cost of introducing a new prop overlap. The road grid, traffic loop points, vehicle dimensions, vehicle speed and gameplay authority are unchanged.

This is a source-level placement correction only. Confirm the actual signal pole position, sidewalk relationship, visibility and danfo corner clearance in the live R3F scene during the pending desktop and 375px mobile visual QA.


## Parked-car versus moving-traffic clearance

The two authored parked-car cells are on horizontal road tiles. Their renderer previously placed each car directly at the tile centre, overlapping the moving traffic loop's centreline. The placement now evaluates small offsets perpendicular to the local road (and all four directions at a junction), measures distance to the existing closed traffic-route segments, and chooses the candidate with the greatest minimum route clearance. Vertically aligned parking cells also rotate the car model to follow the road.

The final offset is 0.18 cell (0.36 world units). This keeps the outer wheel envelope within the 2-unit road tile while moving the parked vehicle away from the route. The car catalogue, count, mesh dimensions, route geometry and traffic speeds are unchanged.

This remains source-level verification. The live scene must still confirm that the parked cars read as roadside parking, that wheels do not visually touch curbs, and that moving traffic clears them at both intersections and straight approaches.


## Moving-traffic spacing and frame-step audit

The town creates one moving vehicle per generated rectangular loop (six vehicles for the current authored grid). Neighbouring loops travel in opposite directions along shared road strips; they do not share the same centreline when the lane inset is applied.

The inset has been increased from 0.16 to 0.22 of a 2-unit road cell. This puts opposing route centrelines 0.88 world units apart on shared road segments. The widest moving body (danfo, 0.72 units) therefore has a nominal 0.16-unit body-to-body gap on straight shared segments, before wheel/trim envelopes. The taxi body is 0.64 units wide. A route test now asserts that the shared-lane separation exceeds the danfo body width.

Traffic motion now advances by world-space distance and carries leftover frame time across corners rather than resetting segment progress to zero. The travelled distance is reduced modulo the route perimeter after a long pause, bounding catch-up work. Degenerate zero-length paths return safely rather than entering a segment-advance loop. Vehicle speeds and the one-vehicle-per-loop count remain unchanged.

**Remaining visual checkpoint:** inspect danfo and taxi wheel/body envelopes at the shared-road turns. The 0.16-unit nominal straight gap does not prove corner-sweep clearance; do not increase traffic density until the live scene has been inspected. Local test/build and desktop/375px browser QA remain pending; no GitHub Actions were run.


## Pedestrian route and vehicle-separation audit

The authored 24 × 18 road grid currently derives 30 pedestrian sidewalk runs containing 120 waypoints. The route builder only accepts grass (`g`) cells directly beside road (`r`) cells, splits runs at gaps, and excludes the 2 × 2 building footprints, water cells and reserved plot cells. It does not put pedestrian waypoints on road tiles. This keeps the generated NPC paths on the existing roadside walkable strips rather than crossing moving-traffic lanes.

The pedestrian renderer previously advanced only one segment boundary per frame and discarded leftover frame time. It now advances by world-space distance, carries remaining movement through segment boundaries, reverses at each end of the sidewalk run, and caps a long paused-frame update to one round trip. Degenerate all-zero-length routes safely return.

Added route tests verify that authored-town waypoints resolve to unblocked grass cells adjacent to roads, and that a blocked sidewalk cell splits a run rather than being crossed. The traffic inset regression assertion was also aligned to the current 0.22-cell route offset.

**Scope limitation:** the current pedestrian system follows open sidewalk runs and turns around at their ends; it does not route across marked pedestrian crossings or perform dynamic collision avoidance with other pedestrians. Since the paths stay on grass cells beside roads, they are separated from traffic lanes at the route-data level. Live verification is still needed for character footprints, curb edges, sidewalk props and dense NPC overlap. No runtime tests/build or browser QA have been run in this pass.


## Pedestrian waypoint alignment with rendered sidewalks

A further placement mismatch was identified: pedestrian route points were at the centre of the adjacent grass grid cell, but the rendered sidewalk is a narrow strip immediately beside the road tile. NPCs could therefore appear to walk on grass rather than on the pavement.

The route builder now keeps each side of a road as a separate run and offsets each waypoint to the centre of the actual sidewalk strip. The offset is derived from the same sidewalk width ratio used by the R3F sidewalk geometry (0.28 of a road cell), so a future cell-size change remains proportional. Blocked grass cells still split the route and are not traversed. Both horizontal and vertical road edges are handled independently.

Regression tests now assert that every authored-town waypoint is centred at the sidewalk-strip offset from a road cell, points to an unblocked adjacent grass cell, and that a blocked sidewalk tile splits both sides into separate runs. The change affects pedestrian path placement only; road geometry, curb dimensions, pedestrian model dimensions and vehicle routes are unchanged.

Live inspection is still required to verify the character foot placement against the curb and pavement in the rendered scene. No local tests/build or browser QA were run, and no GitHub Actions were triggered.


## Pedestrian grounding and roadside-prop clearance

The pedestrian mesh origin was sitting above the pavement because the character group had an additional 0.05-unit parent lift and the animated origin was another 0.08 units above its route. The trouser mesh's lower face is 0.03 units above the character origin, while the rendered sidewalk top is 0.06 units. The renderer now removes the parent lift and places the animated origin at 0.03 units, aligning the trouser base with the sidewalk surface. Footstep bob amplitude is reduced from 0.06 to 0.012 units to avoid a visibly floating gait.

Pedestrian route generation now runs after roadside placement data is available. It excludes grass cells near streetlights, traffic signals, bus stops, road signs, roadside shops, parked motorcycles and tricycles, vendors, bins, trees and utility poles, in addition to buildings, water and reserved plots. Each prop reserves only nearby grass cells in its 3 × 3 grid neighbourhood; road cells are not added as pedestrian blockers. The sidewalk route builder then splits paths around these reservations rather than sending NPCs through the prop footprints.

This is conservative placement clearance, not full character-to-character collision avoidance. A live scene check is still required for feet-on-pavement alignment, prop footprints and remaining route continuity. No local tests/build or browser QA have been run; GitHub Actions remain disabled.

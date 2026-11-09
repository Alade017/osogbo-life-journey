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

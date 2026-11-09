# Reference image library review

Reviewed: 9 November 2026  
Source: owner-supplied `image models.zip` (31 raster reference images)  
Target branch: `feat/phase-4-neighborhood-production-art`

## Purpose and boundary

This library is a visual reference set for Osogbo Life Journey. It is not a collection of licensed production assets, 3D models, or permission to reproduce third-party designs. The ZIP is not copied into the runtime bundle. Keep the original archive as a working reference; before any reference is traced, modelled closely, textured, or redistributed, record its original creator/source and licence.

Use the images to study composition, proportions, modularity, object families, visual hierarchy and presentation. Re-author the assets with the project's own Yoruba/Nigerian setting, approved palette, existing scale, gameplay footprints and material system.

## Reference groups

| ZIP image | Observed subject | Useful inspiration | Adaptation / caution |
| --- | --- | --- | --- |
| 01 | Contemporary bedroom, wardrobe and bed | Furniture proportions, wardrobe/bed grouping, timber and wall finish | Rebuild as a locally plausible room; avoid copying the exact room design |
| 02 | Isometric bedroom cutaway | Room staging, readable furniture silhouettes and camera framing | Strong reference for the house preview composition |
| 03 | Small consumer product and package assortment | Reusable product silhouettes, label placement and colour families | Create original Nigerian everyday goods and generic labels |
| 04 | Household appliances and electronics assortment | Appliance scale and consistent product-family presentation | Prioritize the appliances already supported by the inventory catalogue |
| 05 | Isometric living room | Sofa, coffee table, rug and media-console grouping | Adapt to local room sizes and existing furniture placement slots |
| 06 | Dense urban street photograph | Street depth, mixed building heights, lighting and lived-in density | Mood/composition only; not a texture or geometry source |
| 07 | Isometric kitchen | Compact kitchen workflow, cooker, sink, cabinets and tiled floor | Adapt fixtures to existing room dimensions and house-type data |
| 08 | Paper shopping bags | Bag construction, handles, folds and paper material | Use generic/unbranded or approved fictional shop branding |
| 09 | Living-room cutaway | Sofa, shelves, media wall and wall decoration | Reference furniture clusters, not exact furniture models |
| 10 | Planned low-rise neighbourhood | Road hierarchy, blocks, planting and neighbourhood rhythm | Keep project-authored coordinates and walkability; do not trace the layout |
| 11 | Fashion handbags | Bag silhouettes, straps and material variety | Use as a style cue for personal accessories |
| 12 | Dense green urban district | Block density, greenery and roof variation | Composition only; preserve the project's own district registry |
| 13 | Gym equipment | Basic gym equipment forms and grouping | Match the existing gym catalogue and mobile geometry budget |
| 14 | Low-poly furniture assortment | Modular furniture families and consistent scale | Useful for a reusable furniture kit; re-author all meshes |
| 15 | Small household / shipping containers | Box, carton and waste-bin forms | Separate reusable packaging from world waste props |
| 16 | Retail kiosks and vending displays | Product display density, shelving and stall presentation | Adapt to Osogbo kiosks and market stalls; avoid copied branding |
| 17 | Isometric bedroom | Bedside storage, wardrobe, bed and room staging | Useful for Normal-to-Premium furnishing progression |
| 18 | Urban street at golden hour | Warm evening lighting, street depth and lived-in atmosphere | Mood only; match the shared in-game clock and approved lighting |
| 19 | Reusable shopping carrier bag | Thin-film bag silhouette and folds | Create original low-poly material and approved colours |
| 20 | Shopping bags, baskets and carts | Retail shopping props and handling scale | Good basis for supermarket/market interaction props |
| 21 | Low-poly toon city cars | Vehicle family consistency, colour variants and readable silhouettes | Style reference only; align with the project's semi-realistic target |
| 22 | Low-poly urban vehicles | Cars, vans, taxis and service-vehicle variety | Select a restrained vehicle set relevant to Osogbo streets |
| 23 | Small modular city/building assortment | Building footprint variety and district composition | Use as modularity inspiration, not as an alternative city renderer |
| 24 | Barbershop interior | Service-station layout, mirror, chair and counter | Adapt to the existing barbershop/service destination |
| 25 | Home appliances | Refrigerator, cooker, washing machine and small appliances | High-priority inventory and furnishing family |
| 26 | Character in patterned Nigerian clothing | Contemporary clothing silhouette and textile direction | Cultural clothing reference; make original garments and respect source rights |
| 27 | City simulation map screenshot | Landmark hierarchy, activity markers and district readability | UI/interaction inspiration only; do not copy its map or icons |
| 28 | Construction tools and site equipment | Tool families, construction-site prop grouping | Useful for jobs, building work and inventory objects |
| 29 | Dense low-rise city blocks | Repeated housing variation, roof rhythm and street network | Use as density inspiration; preserve original authored world layout |
| 30 | Low-poly footwear assortment | Shoe silhouettes, colour/material variants and inventory presentation | Re-author as wearable items that fit the existing avatar scale |
| 31 | Modular colourful furniture assortment | Furniture variety and asset-family consistency | Reduce saturation and unify with the Art Bible material palette |

## What the set tells us

The strongest coverage is for **homes and interiors**, **furniture**, **household appliances**, **retail packaging**, **vehicles**, and **dense low-rise urban environments**. There are also useful smaller groups for gym equipment, barber/service interiors, clothing, footwear and construction props.

The set is not a single coherent art style. It mixes isometric cutaways, product renders, low-poly packs, screenshots and photographic mood references. The project's Art Bible remains the authority: semi-realistic, restrained low-poly forms, coherent scale, controlled material detail and a consistent elevated 2.5D presentation. Do not combine these reference styles literally in one scene.

## Production mapping to the existing project

| Production family | Existing project integration point | Recommended first slice |
| --- | --- | --- |
| House shells and room presentation | Existing six house types; `public/models/rooms/`; current R3F house renderer | One representative starter room with a coherent bed, storage, seat and light set |
| Placeable furniture | `content_items` art keys and `public/models/furniture/<art_key>.glb` contract | Bed, wardrobe, chair, table, sofa and shelf, then tier variants |
| Appliances and fixtures | Existing server-owned inventory/catalogue and house placement flow | Refrigerator, cooker, washing machine, television and fan where catalogue entries exist |
| Shop / market display | Existing neighborhood and market scene data | Modular stall counter, shelves, crates, awning and display products |
| Packaging / retail props | Existing item and shop catalogues | Paper bag, carrier bag, carton, bottle and packaged-goods families |
| Vehicles | Existing road/world scene and vehicle data, if present | Small coherent set of taxi, private car, bus/van and service vehicle |
| Clothing / footwear | Existing character appearance and inventory systems | Wearable silhouettes that respect current avatar scale and saved appearance data |
| City blocks | Existing `src/game/neighborhood-model.ts`, district architecture and R3F scene | Dress the approved Olaiya pilot only; do not replace the world model with a screenshot |

The runtime house-model contract is documented in `public/models/README.md`. Keep room GLBs under `rooms/` and furniture GLBs under `furniture/<art_key>.glb`; use centered, floor-level origins, Y-up, meter units, applied transforms, shared materials and compressed meshes. Keep the server's catalogue, ownership, inventory and placement rules authoritative.

## Quality and implementation rules

1. **No SVG renderer or fallback.** Continue using the existing React Three Fiber / Three.js environment and house renderers where those systems already own the scene. Do not add a parallel rendering framework.
2. **No hardcoded catalogue or player state.** Resolve asset IDs and art keys from existing content data; do not duplicate prices, ownership, tiers, destinations or interaction permissions in client presentation.
3. **Preserve click/tap-to-move.** World movement remains target selection by clicking/tapping the destination or interaction target. Do not add keyboard movement or directional movement buttons.
4. **Keep geometry mobile-friendly.** Reuse meshes/materials, instance repeated props, keep texture sizes small, compress GLBs and avoid loading an entire city or every furnishing family into one scene.
5. **Respect gameplay footprints.** A model's visual bounds do not change its collision footprint, placement grid, doorway, path, entrance or saved coordinates. Validate actual player clearance and depth ordering.
6. **Preserve interaction contracts.** Decorative doors, stalls, furniture and props must not advertise actions that lack existing server-backed targets.
7. **Preserve the Art Bible.** Use its palette, ground anchors, projection, lighting, readability and 375px review criteria. Reference photography informs atmosphere only; it is not a texture source.
8. **Track provenance.** Before production use, record creator/source, licence, allowed modifications, attribution requirements and whether the final mesh/material is original or derived.
9. **Do not change database schemas or seed data as part of art production.** Any such change requires a separate proposal and explicit approval.
10. **Do not trigger GitHub Actions.** Use local validation after a complete implementation slice; do not dispatch or rely on workflow runs.

## Recommended implementation order

1. **Household furnishing pilot:** build one representative room composition using existing house types and existing placeable item art keys. Review it with the player avatar and existing camera at desktop and 375px.
2. **Core furniture family:** make reusable bed, wardrobe, chair, table, sofa and shelf models with controlled Normal / Intermediate / Premium visual variants only where the existing catalogue supports them.
3. **Appliance family:** add only catalogue-backed household appliances and essential fixtures.
4. **Market and packaging family:** add modular stall display pieces and generic Nigerian retail packaging without copied logos.
5. **Service and work props:** barber station, gym equipment and construction tools where current gameplay destinations or inventory entries exist.
6. **Vehicles and street dressing:** add a restrained vehicle set and validate road clearances, depth and mobile performance.
7. **Broader district dressing:** only after the Olaiya pilot passes the Art Bible approval checklist.

## Acceptance gate

A reference image is not an acceptance test. A production slice is ready for review only when:
- the actual GLB is original or its licence is documented;
- the asset uses the existing model-loading and catalogue contract;
- dimensions, ground anchor, footprint and placement are verified in the running scene;
- the same materials and silhouette language work beside current world art and the player avatar;
- no interaction, economy, inventory, ownership, travel or movement rules have changed;
- desktop and 375px mobile captures are reviewed, with no visible seams, clipping or blocked click/tap routes;
- local typecheck, tests, lint and production build are reported accurately, without invoking GitHub Actions.

## Review outcome

The supplied 31-image set is accepted as an **inspiration library** for original production work. It is not accepted as a production asset pack. The best next production slice is a small, catalogue-backed household furnishing pilot, because the references strongly cover rooms, furniture and appliances and the repository already has a GLB loading contract and an active R3F house renderer.

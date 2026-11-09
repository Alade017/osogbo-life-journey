# Supplied Reference Images — Main-Branch Coverage Audit

Audit date: 9 November 2026  
Repository: `Alade017/osogbo-life-journey`  
Baseline: `main`  
Working branch: `feat/phase-4-neighborhood-production-art`

## Purpose

The supplied `image models.zip` is an inspiration library, not a request to recreate assets already shipped in the game. This audit checks the reference themes against the existing main-branch implementation before any new production work. It deliberately avoids rebuilding the household furnishing pilot.

## Verified main-branch foundation

| Area | Evidence in main | Audit result |
| --- | --- | --- |
| House interior scene | `src/components/game/housing/HouseRoom3D.tsx` (71,150 characters) | Existing procedural room renderer and furniture fallbacks are already substantial. |
| Housing definitions | `src/data/housing.json` | Shared room, private room, studio flat and larger housing records already drive room layouts and slots. |
| Furniture placement contract | `src/components/game/housing/house-room-contract.ts` and existing housing APIs | Placement and inventory are already connected to server-owned content; do not introduce a parallel client catalogue. |
| Household furniture catalogue | `drizzle/migrations/0072_more_house_accessories.sql` | Includes bed, sofa, cooker, shower, computer, plant, wardrobe, coffee table, wall art and floor lamp. |
| Home fitness catalogue | `supabase/migrations/20261108120000_gym_furniture_items.sql` | Includes treadmill, multi-gym machine, dumbbells, yoga mat, rack, mirror and gym bag. |
| In-hand / worn item models | `src/components/3d/item-models.tsx`, `src/components/3d/world-item-models.tsx` | Existing model registry is deliberately small: food, water, backpack, basic outfit, trousers and slippers. |
| Food models | `src/components/3d/food-models.tsx` | Several Nigerian food props already exist (puff-puff, suya, moi-moi, akara, meat pie, plantain, bread, chin-chin and pepper soup). |
| Clothing surface pattern | `src/components/3d/cloth-patterns.ts` | Adire texture is generated procedurally; the supplied clothing reference should inspire original garment silhouettes and fabrics, not a copied print. |
| Street furniture | `src/components/3d/WorldStreetFurniture.tsx` | Reusable streetlight, bench, bin and sign structures already exist. |
| Model delivery | `public/models/README.md` | GLB/Draco contract exists. At audit time the public room model directory contains a development fixture; no production furniture GLB family was found in the main tree. |

The room renderer, item registries, world-item models and model contract were compared between `main` and the working branch. Their contents and blob SHAs matched at the time of audit. This confirms the furnishing pilot is already present on main and must not be recreated on this branch.

## Reference themes: covered vs. genuine gaps

| Reference theme | Existing coverage | Recommended treatment |
| --- | --- | --- |
| Bedroom, living room, kitchen and bathroom cutaways | Existing procedural room, furniture fallbacks and housing slot data | Keep the current pilot. Only refine a specific object when a visual or interaction defect is demonstrated. |
| Furniture assortments and modular home interiors | Broad procedural furniture coverage; catalogue already includes common pieces | Add missing catalogue-backed variants only after checking all existing item IDs and art keys. Do not add a second starter-room scene. |
| Household appliances and electronics | Stove, computer, television and other room fallbacks; computer/TV art keys exist | Improve object-specific shape/detail where the current fallback is visibly generic; preserve existing catalogue keys. |
| Nigerian packaged goods and consumer products | Some food models and water bottle exist; no broad packaging family was identified in the model registry | Strong candidate for original reusable package models (bottles, sachets, cartons, tins, bags and wrappers), but bind them to existing content IDs rather than inventing purchasable items. |
| Retail kiosks, bags, baskets and market displays | Existing vendor/shop scene props and crate structures from the map work | Expand only the missing display and carrying-prop forms; preserve current business locations and interactions. |
| Clothing and footwear | One basic top, trousers and slippers; procedural adire pattern | Strong candidate for a wider original wearable silhouette library, driven by existing wardrobe/catalogue IDs. |
| Vehicles | City vehicle references exist in the image library; no evidence in this audit of a reference-driven new vehicle family | Inspect current vehicle renderer and data before adding anything; avoid duplicate vehicle types or hardcoded street placement. |
| Barber / service interiors | No dedicated barber furnishing family was confirmed by the inspected item registries | Candidate for a data-driven service-prop set, after checking the existing job/activity content and venue renderer. |
| Gym equipment | Catalogue entries exist for seven home fitness items | Catalogue coverage exists; inspect their current rendering and slot placement before creating models. |
| Construction tools and site equipment | No matching inventory model family confirmed in the inspected registries | Candidate for reusable tool models, only where existing jobs, missions or inventory content already references them. |
| Urban blocks, streets and neighbourhood mood | Existing neighbourhood scene, district art direction and modular street-furniture work | Use references for material, density and composition inspiration; do not trace a city layout or replace authored town data. |

## Production rules for the next asset pass

1. **No duplicate furnishing pilot.** The room renderer and housing catalogue are already in main. Keep the current room scene and improve only evidenced gaps.
2. **Catalogue-first, no hardcoding.** Before authoring an item, find its canonical content ID, slug, `art_key`, slot and owning system. A model registry maps existing records; it does not create game economy.
3. **No database or migration changes in this pass.** New purchaseable items, prices, slots, jobs or inventory records require a separate design and approval.
4. **No SVG.** Use the existing React Three Fiber / Three.js rendering path and GLB contract where appropriate. Do not add SVG artwork or fallback rendering.
5. **Original work only.** Re-author geometry, silhouettes, materials and labels. Do not trace supplied images, copy logos/trade dress, or use reference photos as textures. Confirm source/licensing before close adaptation.
6. **Mobile budgets.** Prefer shared materials, low polygon counts, instancing for repeated small goods, compact textures and deterministic variants.
7. **Keep server authority.** Models are presentation only; inventory, ownership, placement, movement and interactions remain with existing authoritative systems.

## Recommended implementation order

1. Inspect the current item catalogue and renderer for the exact art keys already in use, then close the highest-value gaps in household goods and appliance models.
2. Add a small, reusable Nigerian retail-packaging family for existing consumable IDs (not new store stock).
3. Expand wearable clothing/footwear silhouettes using existing wardrobe records.
4. Audit current vehicle and service-venue renderers before deciding whether new vehicle, barber or construction props are actually missing.
5. Add visual regression / registry coverage for every new model mapping. Run local typecheck, lint, tests and production build only when the user is ready; do not trigger GitHub Actions.

## Scope and verification limits

This is a source/tree audit, not a claim that every model has been visually inspected in a running browser. It does not certify mobile performance, visual quality, purchase flows or room placement. No application code, catalogue rows, database migrations or GitHub Actions workflows were changed as part of this audit.

# Phase 4 — Procedural neighborhood art pilot

The active playable neighborhood is rendered by the existing React Three Fiber / Three.js surface in `R3FNeighborhoodSurface.tsx`. This pilot's Phaser Graphics profiles are a separate procedural-art implementation and are not the active `/neighborhood` renderer. Keep renderer responsibilities explicit; do not add SVG renderers or SVG fallbacks.

## Rendering approach

- The active R3F scene constructs buildings with reusable `WorldHouse` geometry. Confirmed world categories select architecture families (market, civic, health, education, transit, recreation and services), while home entrances retain the residential profile.
- The Phaser Graphics implementation retains its own semantic profiles for compound, shop, kiosk, market and work families; it must not be described as the active playable renderer.
- Roofs, wall planes, eaves, roof seams, doors, windows, profile-enabled security grilles, awnings and verandas are derived from each building's existing width/depth footprint and a typed style profile.
- Environment props are constructed procedurally in the R3F scene from existing world components and data-driven neighborhood dressing. Arterial-to-arterial and arterial-to-street junctions derive traffic-signal positions and approach-facing orientations from road geometry; pedestrian crossings are placed on all four approaches as four-stripe zebra markings when road segment bounds allow, with complete obstacle-footprint clearance and matching openings in sidewalks and kerbs; generated streetlights stay clear of crossing approaches. Pedestrian placement is interleaved across streets before applying the scene cap. Vehicle positions are interleaved across roads and opposing lanes so cars face along horizontal and vertical streets. Tree silhouettes scale from obstacle footprints, and labeled signs/landmarks retain their data-provided labels. The Phaser prototype also retains typed shape profiles for trees, streetlights, benches, bins and signs.
- Dimensions are derived from each world's existing obstacle/building dimensions; no new per-location placement coordinates or collision dimensions are introduced.
- Unknown obstacle kinds are skipped rather than silently rendered as an unrelated generic prop.

## Preserved contracts

- Existing `projectNeighborhood` projection and scene bounds are unchanged.
- Existing building footprints and obstacle collision rectangles are unchanged.
- Art is presentation-only and does not change movement, collision, player depth, server authority or interactions.
- Existing labels, object identity, room lifecycle, camera and player rendering remain in place.
- The active playable neighborhood remains on its existing R3F/Three.js renderer. No new rendering dependency is introduced.
- No phone routing, database, RPC, Colyseus, economy or deployment changes.

## Renderer constraints

The active R3F/Three.js scene is the playable renderer. Its building geometry is scaled from world-provided footprints and uses category-driven reusable architecture. The separate Phaser Graphics prototype must not be wired as a fallback. No SVG renderer or fallback is permitted.

## Validation status

The neighborhood art, model, dressing and interaction Vitest files have been updated but not executed. Typecheck, lint, production build, desktop/mobile browser rendering and gameplay interaction tests have not been run in this environment. Automatic GitHub Actions triggers have been disabled; the workflow is retained for manual dispatch only and has not been run.

Before considering merge, execute locally:

1. `npm run typecheck`
2. `npx vitest run src/test/neighborhood-art.test.ts src/test/neighborhood-model.test.ts src/test/neighborhood-dressing.test.ts src/test/neighborhood-interactions.test.ts`
3. `npm run lint -- src/game/neighborhood-art.ts src/game/phaser-neighborhood.ts src/game/neighborhood-dressing.ts src/components/game/R3FNeighborhoodSurface.tsx src/components/3d/WorldScene.tsx src/test/neighborhood-art.test.ts src/test/neighborhood-dressing.test.ts` (or the repository's equivalent scoped lint command)
4. `npm run build`
5. Test the authenticated full-page `/neighborhood` at desktop and 375px mobile widths. Check all building and prop families, roads, lane markings, crossings and sidewalk openings, traffic-signal orientation, vehicle direction/distribution, pedestrian distribution, depth sorting, approach to entrances, zoom, movement, resizing, navigation away/back, console errors and network failures.

Visual scale and gameplay fit must be inspected in the actual browser before expanding this art pilot or recommending merge.

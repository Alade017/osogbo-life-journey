# Phase 4 — Neighborhood production-art pilot

8 November 2026. First bounded production-art slice for the existing Phaser neighborhood renderer. This does not replace the city overview, Three.js house interior, avatar renderer, movement model or server authority.

## Scope

The pilot introduces original, lightweight SVG environment assets for the playable neighborhood:

- Residential compound: rendered plaster walls, red-brown roof, barred windows, shaded entrance and a grounded doorway.
- Commercial shop: muted painted frontage, metal roof, awning, display windows and entrance.
- Market kiosk: compact stall with shaded counter and simple signboard.
- Street environment: leafy shade tree, streetlight, bench, refuse bin and wayfinding sign.

Assets live under `public/assets/world/neighborhood/`. The TypeScript manifest in `src/game/neighborhood-art.ts` defines stable keys, dimensions, anchors and display scale. Phaser preloads the manifest and uses the SVGs when available. Existing procedural geometry remains as a fallback if an asset fails to load.

## Preserved contracts

- Existing `projectNeighborhood` projection and scene bounds are unchanged.
- Existing 114 × 58 building footprint and obstacle collision rectangles are unchanged.
- SVGs are presentation-only; roof overhangs and shadows do not add collision.
- Building labels and existing object identities remain in the same renderer containers.
- Existing player textures, depth calculation, camera, movement, room lifecycle and interaction targets are untouched.
- No phone routing, database, RPC, Colyseus, economy or deployment changes.

## Validation and acceptance

Source-level manifest tests are added in `src/test/neighborhood-art.test.ts`. The repository-connected environment used for this change cannot run the project's local Node commands or open the live game in a browser. No typecheck, Vitest run, lint, production build, desktop/mobile rendering, or live interaction test is claimed.

Before merge, run locally:

1. `npm run typecheck`
2. `npx vitest run src/test/neighborhood-art.test.ts src/test/neighborhood-model.test.ts`
3. `npm run lint -- src/game/neighborhood-art.ts src/game/phaser-neighborhood.ts src/test/neighborhood-art.test.ts` (or the project's equivalent scoped ESLint command)
4. `npm run build`
5. Open the authenticated full-page `/neighborhood` in a real browser at 375px and desktop width. Check all eight asset families, asset loading failures/fallback, avatar depth behind/in front of tree and buildings, doorway approach, zoom, room movement, resize and navigation away/back. Inspect browser console and network for SVG load errors.

A successful unit test cannot approve the art visually. Confirm asset scale/material readability and collision/entrance alignment in the actual scene before expanding this pilot to the rest of the city.

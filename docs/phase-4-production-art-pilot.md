# Phase 4 — Procedural neighborhood art pilot

This pilot uses the existing Phaser renderer and its projected world coordinates. All neighborhood architecture and environment props are drawn with Phaser Graphics; no external image assets or alternate renderer are used.

## Rendering approach

- Buildings are constructed from Phaser Graphics geometry using semantic profiles for compound, shop, kiosk, market and work families. World-object kinds select the appropriate reusable family.
- Roofs, wall planes, eaves, roof seams, doors, windows, grilles, awnings and verandas are derived from each building's existing width/depth footprint and a typed style profile.
- Environment props are constructed procedurally from typed shape profiles for trees, streetlights, benches, bins and signs.
- Dimensions are derived from each world's existing obstacle/building dimensions; no new per-location placement coordinates or collision dimensions are introduced.
- Unknown obstacle kinds are skipped rather than silently rendered as an unrelated generic prop.

## Preserved contracts

- Existing `projectNeighborhood` projection and scene bounds are unchanged.
- Existing building footprints and obstacle collision rectangles are unchanged.
- Art is presentation-only and does not change movement, collision, player depth, server authority or interactions.
- Existing labels, object identity, room lifecycle, camera and player rendering remain in place.
- No Three.js/R3F renderer is introduced into this Phaser scene; Phaser is already the renderer responsible for this playable neighborhood.
- No phone routing, database, RPC, Colyseus, economy or deployment changes.

## Renderer constraints

Phaser Graphics is the sole building and environment-prop renderer for this pilot. There is no external asset loader or fallback renderer. Shared geometry is scaled from world-provided footprints, and semantic profiles are reused across areas.

## Validation status

The profile-focused Vitest file has been updated but not executed. Typecheck, lint, production build, desktop/mobile browser rendering and gameplay interaction tests have not been run in this environment. Automatic GitHub Actions triggers have been disabled; the workflow is retained for manual dispatch only and has not been run.

Before considering merge, execute locally:

1. `npm run typecheck`
2. `npx vitest run src/test/neighborhood-art.test.ts src/test/neighborhood-model.test.ts`
3. `npm run lint -- src/game/neighborhood-art.ts src/game/phaser-neighborhood.ts src/test/neighborhood-art.test.ts` (or the repository's equivalent scoped lint command)
4. `npm run build`
5. Test the authenticated full-page `/neighborhood` at desktop and 375px mobile widths. Check all building and prop families, depth sorting, approach to entrances, zoom, movement, resizing, navigation away/back, console errors and network failures.

Visual scale and gameplay fit must be inspected in the actual browser before expanding this art pilot or recommending merge.

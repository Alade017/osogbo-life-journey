# Phase 6 — Visual polish review

9 November 2026 · Source review on `feat/phase-4-neighborhood-production-art`

## Scope

This is a source-level consolidation of the Phase 6 work. It is not an in-engine art approval, a performance report, or a claim that the Phase 6 exit gate has passed.

The active playable neighborhood remains the existing React Three Fiber / Three.js renderer. The city overview and venue interiors retain their existing renderer paths. No SVG renderer/fallback, new rendering dependency, database migration, server persistence change, or gameplay control change is introduced by this review.

## Source-level work completed

The following reusable visual systems have received implementation changes on this branch:

- **Material variation:** reusable architectural surface palettes and deterministic building material selection, preserving semantic architecture categories.
- **Vegetation:** reusable foliage colour palette, deterministic canopy variation, and layered tree crowns using instanced geometry.
- **Lighting:** shared-clock lighting integration for the town and playable neighborhood, with daylight/night ambience and existing streetlight presentation tied to the same clock.
- **Signage and district identity:** district-themed boundary treatment and physical sign lettering sourced from neighborhood labels; duplicate floating labels removed.
- **Building detail:** reusable entrance framing, proportional window sills/lintels and palette-aware trim.
- **Street furniture and infrastructure:** refinements to benches, streetlights, waste bins, bus-stop seating, traffic-signal lens hoods, vendor crates and roadside-shop product crates.
- **Commercial frontage:** generic ungrounded `SHOP` lettering removed in favour of reusable unbranded frontage details.

Recent source refinements remain data/size-driven rather than keyed to individual neighborhood slugs or hand-authored location coordinates. Instanced geometry is retained for repeated props where the current component architecture supports it.

## Contracts preserved

- Player movement remains click/tap-to-move only; no keyboard movement or directional movement controls were added.
- Camera zoom remains a separate camera action.
- Existing neighborhood projection, building footprints, obstacle/collision dimensions, interaction identities and server-authoritative movement remain unchanged.
- The active playable renderer remains R3F/Three.js; the separate Phaser prototype is not a fallback.
- No SQL, RPC, Colyseus protocol, economy, phone-routing or deployment changes were made for this visual pass.
- No GitHub Actions workflow was dispatched.

## Remaining Phase 6 acceptance work

The master plan's Phase 6 exit gate requires an in-engine day/night and layering review. That has **not** been completed in this environment.

The following remain unverified:

- Daylight, evening and night appearance in the running scene, including lighting transitions and streetlight legibility.
- Player/building/tree/fence overlap and ground-contact depth in representative scenes.
- Material and signage readability at normal gameplay zoom and at a 375px mobile viewport.
- Shadow direction, contact quality, seams, and any duplicate or conflicting lights in the actual renderer.
- Browser console/network errors, mount/unmount behaviour and mobile GPU/frame-time impact.
- Local typecheck, focused tests, lint and production build for the complete branch.

The Art Bible's production-art checklist also remains a separate gate. The procedural visual foundation and source refinements do not prove that the final semi-realistic quality bar or actual-device performance targets have been met.

## Phase 7 handoff

Phase 7 should begin with local validation and real browser/device acceptance, not further speculative cosmetic changes. The required checks are:

1. Run the repository's typecheck, focused neighborhood/town tests, scoped lint and production build locally.
2. Open the authenticated full-page map and neighborhood in a real browser at desktop and 375px mobile widths.
3. Inspect camera framing/zoom, roads and crossings, buildings, signage, props, click/tap-to-move, entrance interactions, NPC movement, depth layering, day/night lighting and navigation away/back.
4. Record console/network failures and measure performance on an identified Android device and desktop machine.
5. Re-test affected gameplay and map flows; document failures and fixes before any merge recommendation.

GitHub Actions are intentionally not used because of the owner's billing constraint. Browser and device acceptance must be performed locally and reported with the actual environment/results.

## Current decision

**Phase 6 source implementation: substantially complete. Phase 6 visual exit gate: pending. Phase 7 QA: not yet run. Merge: not recommended until the required browser/device tests pass.**

## Existing validation assets found during Phase 7 handoff review

A source inventory on 9 November found focused Vitest coverage for:

- Daylight curve boundaries and progression: `src/test/map-lighting.test.ts`.
- Procedural building-family profiles: `src/test/neighborhood-art.test.ts`.
- Road dressing, crossing clearance, traffic-signal placement, vegetation sizing and deterministic generation: `src/test/neighborhood-dressing.test.ts`.
- Entrance and NPC target eligibility/proximity: `src/test/neighborhood-interactions.test.ts`.
- Room lifecycle, district selection and authoritative interaction behavior: `src/test/playable-neighborhood.test.tsx`.
- Tap-versus-drag and pinch thresholds: `src/test/map-gesture.test.ts`.
- Town identity and road-grid connectivity: `src/test/town-data-integrity.test.ts`.

The repository also contains `scripts/world-restyle-browser-check.mjs`, a real-browser fixture that mounts the R3F town, neighborhood and house scenes with synthetic fixture data. It checks rendered scene structure, lighting-rig expectations, instancing, palette limits, camera state and selected responsive/editor layout conditions. It is useful for renderer smoke coverage, but it is **not** an authenticated end-to-end test and does not replace visual inspection of the live app or physical-device testing.

`scripts/map-runtime-browser-check.mjs` is a separate map lifecycle fixture. Its DOM assertions include legacy `.town-place-bubble` selectors; confirm those selectors still match the current overview implementation before treating its result as an authoritative current-map acceptance test.

`scripts/world-foundation-browser-check.mjs` exercises the separate Phaser prototype. It must not be used as evidence that the active R3F playable neighborhood has passed.

These scripts and tests were inspected in source only. None was executed as part of this handoff. The repository's `npm run typecheck`, `npm test`, `npm run lint`, `npm run build` and browser scripts remain to be run locally. Do not dispatch GitHub Actions.

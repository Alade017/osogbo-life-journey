# OSUN LIFE city map

The authenticated city map and landing-page preview use the React Three Fiber / Three.js renderer in `src/components/map/DistrictOverviewSurface.tsx`. The overview is a static, rotatable 3D representation of ten Osogbo-inspired districts, not a surveyed geographic map or a playable street-level scene.

## Overview data

- `src/data/osogbo-district-catalog.json` defines canonical district IDs, existing landmark assignments, legacy district aliases, reserved landmarks and reconciliation decisions.
- `src/data/osogbo-overview-layout.json` defines independent normalized overview coordinates, landmark footprints, residential and commercial parcels, housing listing anchors and the river.
- `src/components/map/overview-district-routing.ts` resolves legacy district and landmark references without replacing gameplay destination IDs.
- `DistrictOverviewWorld.tsx` renders the districts, landmark architecture, housing, terrain, vegetation, billboards and event markers. The overview does not render road networks, crossings, moving vehicles, pedestrians or an avatar walking along streets.

The ten districts are Olaiya Junction, Oja-Oba, Isale-Aro, Ogo-Oluwa, Oke-Fia, Old Garage, Abere & Ring Road, Ota-Efun & Testing Ground, Riverside (Osun Grove Axis), and Oke-Baale. Aleku-Wodo is not an overview district. Baruwa Street is registered under Ogo-Oluwa but its layout is deferred.

## Gameplay and save compatibility

The old navigation data in `src/data/osogbo-town.json`, location-slug links, movement services, travel APIs and neighborhood/venue scenes are retained for existing gameplay. Overview coordinates are presentation-only and must never be submitted as authoritative player movement or travel coordinates.

Selecting an available landmark opens its existing destination flow. District selection exposes available places; locked and reserved models do not grant access. Housing listing anchors are authored display locations, resolved using the existing house type ID; ownership and rent state remain server-authoritative. Unmapped or ambiguous listings remain available in the property panel.

No database migration is required by the overview redesign itself. Existing server migration requirements and authoritative travel contracts are unchanged.

## Architectural coverage

The authored overview contains 53 landmark footprints (45 existing references and eight reserved models), 20 residential parcels, nine commercial parcels and two decorative river bridges. Thirteen retained Olaiya subvenues remain neighborhood-only. The catalog records all 29 required anchor categories with their existing, reserved, decorative or neighborhood-only representation. These assignments are fictional design choices, not a surveyed inventory of the real city.

## Billboard placement

ALADTECH WEB SOLUTIONS and ELEGANCE TECH HUB are configured in the layout billboard policy. The deterministic placement generator evaluates all ten districts, capacity, building and bridge clearances, river clearance and billboard spacing. The current policy allows up to three default brand billboards per district with 12 overview units of separation. Billboard locations are not manually assigned to specific districts. Vegetation avoids generated billboard sites, artwork appears on both faces, and each renderer shares artwork textures by brand. Existing player advertising campaign contracts are unchanged.

## Camera and rendering

The overview uses an orthographic camera, orbit rotation, pan, pinch/wheel zoom and reset controls. Camera gestures do not move the player. Drag and multi-pointer gesture cancellation protects destination selection. Geometry and materials are shared within the overview Canvas; repeated compatible primitives are batched within individual models, vegetation is instanced and rendering is demand-based. Camera pan targets are constrained to the authored city extent, zoom is fit-relative, and mobile district labels are prioritized by footprint size or selected district. Renderer errors and WebGL context loss have a renderer-only retry path; a failed lazy module download may still need a page refresh.

## Verification checklist

Use Node.js 24, as required by package.json. Run npm ci, npm run typecheck, npm run lint, npm run test, and npm run build. The dedicated overview routing/layout, interactions, and billboard/camera suites currently contain 20 authored cases; execution is pending. Run `scripts/world-restyle-browser-check.mjs` with a supported browser executable. Verify ten district objects, landmark callbacks, drag cancellation, mobile and desktop camera framing, housing access, available and locked destination behavior, billboard distribution and spacing, texture disposal, batched mesh picking, renderer recovery, and the absence of legacy road/traffic scenery. Verify neighborhood and house scenes independently. Check existing authenticated travel and saved property behavior in a safe staging environment before deployment.

This document describes the intended implementation contract; it does not certify that runtime or staging verification has passed.

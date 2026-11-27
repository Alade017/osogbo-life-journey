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

## Camera and rendering

The overview uses an orthographic camera, orbit rotation, pan, pinch/wheel zoom and reset controls. Camera gestures do not move the player. Drag and multi-pointer gesture cancellation protects destination selection. Geometry and materials are shared within the overview Canvas; vegetation is instanced and rendering is demand-based.

## Verification checklist

Run repository typechecking, linting, regression tests, and the production build. Run `scripts/world-restyle-browser-check.mjs` with a supported browser executable. Verify ten district objects, landmark callbacks, drag cancellation, mobile and desktop camera framing, housing access, available and locked destination behavior, and the absence of legacy road/traffic scenery. Verify neighborhood and house scenes independently. Check existing authenticated travel and saved property behavior in a safe staging environment before deployment.

This document describes the intended implementation contract; it does not certify that runtime or staging verification has passed.

# Bank and mall scene review

## Evidence

The supplied 22-second recording (`72010.mp4`) shows the bank world inside a document-like, scrollable card with instructions, account panels, presence and staff below it. The bank screenshot is scrolled far enough that the world is mostly above the viewport. The clinic screenshot shows the same card-style presentation with excessive empty canvas around a distant model; the direct-arrival branch already addresses that clinic/destination layout.

The supplied `71777.gif` contains one frame, not an animation sequence. It provides a visual target for an orange/yellow mall frontage, OSUN MALL sign, glass doors, railings, roadside drainage, asphalt markings and a corrugated roadside shelter. Traffic or pedestrian timing cannot be inferred from a single frame.

Code inspection also found that bank hotspot names did not match the material-split GLB node names (for example `025-teller-counter/0`). Mall street actors were animated as idle even when their parent groups moved, and the bank loader displayed time-derived percentages unrelated to asset progress.

## Changes

- Confirmed bank arrivals use a full-viewport lobby. Account actions and branch details live in an explicit service drawer; teller/ATM selections open it, and the backdrop remains visible. Visiting an unconfirmed bank still requires travel. Existing bank RPCs and amount validation remain unchanged.
- Share the measured weather-strip inset with destination routes, keep scene controls above the dock and use responsive orthographic bank framing.
- Match both exact and material-suffixed bank model part names, aggregating split parts into one interaction bound. Ignore camera drags for floor and activity selection.
- Remove the bank's simulated loading percentage; retain real ready/error signals and bounded failure/retry behavior.
- Rebuild the mall frontage around the existing doorway and street footprints: glazed entrance, orange facade, sign, window mullions, railings, road lines, drainage and detailed kiosks/shelters. New railing collision rectangles are shared with pathfinding and leave the entrance/rider reachable.
- Street visitor and rider animations now follow their actual walking state and direction. The camera supports touch orbit and zoom through the existing WorldCamera controls.
- Reduce the shared character ground-disc radius and opacity, disable humanoid/clothing directional shadow casting, soften contact shading and smooth procedural world materials. This affects the shared player/NPC rendering rather than only one scene.

GTA is a reference for coherent streets, readable entrances, scale and materials. These remain mobile-oriented low-poly scenes; this change does not introduce GTA-level assets, vehicle physics, new traffic simulation or new authoritative gameplay.

## Verification limits

Automated tests cover bank imported-part bounds, street clearance and existing humanoid/clothing/animation behavior, alongside the regression suite. Typecheck, scoped lint and production build are run. The recording was inspected through sampled frames. No live WebGL, mobile gesture or FPS verification is claimed; the available browser environments could not access local test fixtures in earlier attempts.

This follow-up extends the direct-arrival changes in PR #162. It does not change the deployed multiplayer endpoint or repairs a remotely unavailable room service. No merge, production deployment, new dependency or database migration is included.

Validation results: full suite 365 files / 2,325 tests passed; initial focused coverage 87 tests passed; final bank/street rerun 15 tests passed, including two additional bank world-flow tests. Typecheck, production build, scoped ESLint and formatting checks passed. Two existing Fast Refresh warnings remain in OsunMallStreet3D.

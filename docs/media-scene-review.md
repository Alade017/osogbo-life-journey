# Bank and mall scene review

## Evidence

The supplied 22-second recording (`72010.mp4`) shows the bank world inside a document-like, scrollable card with instructions, account panels, presence and staff below it. The bank screenshot is scrolled far enough that the world is mostly above the viewport. The clinic screenshot shows the same card-style presentation with excessive empty canvas around a distant model; the direct-arrival branch already addresses that clinic/destination layout.

The supplied `71777.gif` contains one frame, not an animation sequence. It provides a visual target for an orange/yellow mall frontage, OSUN MALL sign, glass doors, railings, roadside drainage, asphalt markings and a corrugated roadside shelter. Traffic or pedestrian timing cannot be inferred from a single frame.

Decoding the actual compressed bank GLB found two further causes: its visible floor was about 1.78 scene units above the old character origin, and GLTFLoader sanitizes split mesh names (`025-teller-counter/0` becomes `025-teller-counter0`). The old bank walker also interpolated directly through furniture. Mall street actors were animated as idle even when their parent groups moved, and the bank loader displayed time-derived percentages unrelated to asset progress.

## Changes

- Confirmed bank arrivals use a full-viewport lobby. Account actions and branch details live in an explicit service drawer; teller/ATM selections open it, and the backdrop remains visible. Visiting an unconfirmed bank still requires travel. Existing bank RPCs and amount validation remain unchanged.
- Share the measured weather-strip inset with destination routes, keep scene controls above the dock and use responsive orthographic bank framing.
- Match exact, slash-suffixed and loader-sanitized bank part names. Pick visible imported meshes rather than invisible aggregate boxes covering unrelated furniture. Ignore camera drags for floor, staff and activity selection.
- Anchor the bank shell to the largest horizontal lobby-floor surface rather than the lowest basement vertex. Continue the floor under the full hall footprint. Characters stand at that floor height.
- Rasterize body-height triangles from the fitted bank and positioned ATM once per model, allowing body clearance and excluding basement/overhead geometry. Reuse the sampled grid pathfinder and waypoint walker: reject blocked/unreachable destinations without a straight-line fallback, turn into movement and keep walking animation active between waypoints. Reduced motion uses only a validated destination. Choose separate clear standing slots for staff and online visitors, leaving the entrance free.
- Clear neighborhood held keys, tapped routes, pending interactions and home-bound intent when the room disconnects. Gate keyboard and career-commute messages on the connected session; require fresh input after reconnect while keeping the environment visible.
- Remove the bank's simulated loading percentage; retain real ready/error signals and bounded failure/retry behavior.
- Rebuild the mall frontage around the existing doorway and street footprints: glazed entrance, orange facade, sign, window mullions, railings, road lines, drainage and detailed kiosks/shelters. New railing collision rectangles are shared with pathfinding and leave the entrance/rider reachable.
- Street visitor and rider animations now follow their actual walking state and direction. The camera supports touch orbit and zoom through the existing WorldCamera controls.
- Reduce the shared character ground-disc radius and opacity, disable humanoid/clothing directional shadow casting, soften contact shading and smooth procedural world materials. This affects the shared player/NPC rendering rather than only one scene.

GTA is a reference for coherent streets, readable entrances, scale and materials. These remain mobile-oriented low-poly scenes; this change does not introduce GTA-level assets, vehicle physics, new traffic simulation or new authoritative gameplay.

## Verification limits

Automated tests include CPU decoding/raycasting of the real Meshopt bank GLB, normalized floor height, sanitized hotspot discovery, body-height obstacle projection, route/standing clearance, disconnected input cleanup, bank drawer/travel flow, street clearance and existing humanoid/clothing/animation behavior. CPU asset inspection does not verify WebGL rendering, touch events or frame rate. Typecheck, scoped lint and production build are run. The recording was inspected through sampled frames. No live WebGL, mobile gesture or FPS verification is claimed; the available browser environments could not access local test fixtures in earlier attempts.

This follow-up extends the direct-arrival changes in PR #162. It does not change the deployed multiplayer endpoint or repair a remotely unavailable room service. No merge, production deployment, new dependency or database migration is included.

Validation results: full suite 368 files / 2,334 tests passed; final focused bank/asset/navigation/neighborhood rerun 5 files / 29 tests passed, including held-key repeat behavior after reconnect. Typecheck, production build, scoped ESLint, formatting and whitespace checks passed. No new lint warnings were reported in this increment. Two existing Fast Refresh warnings remain in the earlier OsunMallStreet3D changes.

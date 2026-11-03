# Phase 3a — Oja-Oba playable district

2 November 2026. Implements the next bounded district slice after the approved Olaiya foundation. The owner's full-page-only world navigation rule remains in force. This does not complete every district or introduce the production-art asset kit.

## Player flow

The map offers **Visit Oja-Oba Market**, which opens the existing full-page location/travel screen. Existing server-validated travel confirms arrival. When Oja-Oba is the saved current location, the map and location page offer **Walk Oja-Oba Market**, opening `/neighborhood`. No client-side location change or free teleport is introduced.

The neighborhood now supports exactly `city-centre` and `oja-oba`. Unknown and unaccepted districts show a map-return state instead of silently rendering Olaiya. Future areas must pass their own layout/navigation acceptance before joining the allowlist in `playable-district.ts`.

## Layout and rendering

- Oja-Oba preserves its existing destination slug, four interaction anchors and principal road coordinates. Explicit connected roads, bounded loading access and three approach paths extend that authored definition.
- Three solid kiosk footprints, shade, seating, a bin and a crossing light provide a market forecourt. Stalls are placed away from the main road and pedestrian approaches.
- The scene uses muted earth paving, market/courtyard/loading-yard signage, reduced background-label density and the existing modular procedural building system. New assets or a second renderer are not installed.
- Shared projection and footprint rules remain in place. The renderer accepts the confirmed district's origin; its fallback origin uses the same existing city entrance mapping as the room server.
- Terrain/camera bounds and offline navigation sampling now express the existing 0…14 / 0…12 authoritative world bounds relative to the district origin. Oja-Oba does not inherit Olaiya's scene-space boundary rectangle.

## Room and home safety

`PlayableNeighborhood` joins only the confirmed location ID. A district change clears movement intent and camera zoom, leaves the previous room and hides old session/player data while the next room connects. Late joins are immediately left; callbacks from disposed rooms cannot publish old players into the new district.

The market courtyard is public scenery, not the player's home. Canonical personal-home data is queried/exposed only in Olaiya; cached home data cannot enable market home entry. The home mutation also checks that the current district supports personal-home entry before invoking the existing server RPC. Existing server permissions remain decisive.

The City Map link provides the current exit to existing travel/navigation. This slice does not add physical district portals, new market payments, stall transactions, indoor market scenes or new business-action RPCs. Those remain later gameplay integration work.

## Local validation

- The seven-file focused run passed 38 tests: district selection/origins/bounds, connected roads and reachable approaches, collision, existing Olaiya regressions, room cleanup/late events, unsupported areas, personal-home isolation, full-page launcher behavior and dashboard regressions.
- The two additional dashboard tests passed; the final dashboard rerun passed all eight assertions. They check that walking is offered only for confirmed market arrival and otherwise the existing travel-page link is shown. This brings the total to 40 distinct focused tests across runs. Log: `.smoke/district-entry-tests.log`.
- `npm.cmd run typecheck`, scoped lint and the final production build passed; logs are `.smoke/district-lint-final.log` and `.smoke/district-build.log`. The build passed with exit 0; existing large-chunk warnings remain.
- `node scripts/market-district-browser-check.mjs` passed at 375px and 1280px. It uses the actual Phaser renderer and synthetic player data to verify market origin, courtyard labeling, player follow, canvas sizing/cleanup, retained overview layers and drag suppression. Screenshots are `.smoke/market-district-375.png` and `.smoke/market-district-1280.png`.
- The final headless 375px sample recorded approximately 28.7ms median / 31.5ms p95 across 60 frames, with 14 top-level scene objects. These are synthetic baseline measurements, not Android acceptance or a before/after performance claim.
- `git diff --check` passed. Unrelated ongoing HUD, house, CSS and other user edits were preserved.

## Release and acceptance boundaries

No SQL/migration, commit, push, PR, room-server deployment or frontend deployment was performed by this work. Oja-Oba's newly authored solid props live in the shared area model: frontend and Colyseus must use the same version when released. Do not release the renderer alone against an older room collision layout.

Authenticated travel, two independent live players, real room disconnect/reconnect behavior and physical Android performance remain unverified. Production art approval and construction of other districts remain open. The local fixture does not establish hosted Supabase permissions or live multiplayer acceptance.

## Signed-in localhost check — 2 November 2026

The owner signed in through the isolated local test browser. The saved location was already Oja-Oba; no paid travel round trip was performed. The first real connection exposed a client race: the room join completed before `room.state.players` was available, and the immediate snapshot read threw `Cannot read properties of undefined (reading 'forEach')`.

The host now subscribes to room-state changes before its initial snapshot attempt, tolerates an unavailable initial player collection, and marks the connection ready only after a usable snapshot. A regression test covers a join that resolves before its first state message. This follows the [Colyseus state-synchronization lifecycle](https://docs.colyseus.io/state); persistent state and movement authority remain unchanged.

After the fix, the actual signed-in `/neighborhood` page showed **Oja-Oba Market neighbourhood**, **Connected**, one world canvas, four movement controls and no neighborhood/rendering errors. No world canvas was mounted inside the phone dialog. This establishes a real authenticated local room connection and rendering, beyond the synthetic fixture.

Movement acceptance is incomplete: one automated direction check was inconclusive and subsequent browser-control commands timed out. Reopening the stalled test tab returned to login. The owner chose to close this check with the verified connection/rendering results; further movement verification requires a future signed-in run. Do not count this as a passed movement/collision, paid-travel, two-account, reconnect or Android acceptance test.

The final component regression run passed six tests; typecheck, scoped lint and the local production build passed for the fix. Logs: `.smoke/initial-state-regression-final.log`, `.smoke/initial-state-typecheck.log`, `.smoke/initial-state-lint-final.log`, `.smoke/initial-state-build.log`. No database or hosted-service changes were made.

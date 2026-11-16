# 3D map upgrade

The map dashboard now shows one full-width 3D view at a time. Osogbo districts remain the default view; Olaiya and the Osun overview are separate views.

- Olaiya reuses `R3FNeighborhoodSurface` and the simulation's existing coordinate conversion. It does not define another street layout.
- The SVG neighborhood map and flat minimap are removed. The playable neighborhood links to the 3D map instead.
- Destinations use mesh markers. Neighborhood and town labels appear on selection or hover; keyboard-accessible destination controls remain available.
- `MapCameraRig` provides a fixed-angle orthographic view, bounded pan, zoom, animated focus, city recentring and player follow. Manual exploration interrupts automatic focus. Reduced-motion preferences skip animated focus.
- The existing walking, Keke, town-travel, property, billboard and server-authoritative action paths remain in place.
- The Osun overview uses authored town positions and simplified 3D town models. It is a game overview, not a geographic survey.
- Overview foliage animation and neighborhood postprocessing are disabled to reduce idle rendering work. Existing world geometry and dependencies are reused.

## Validation

31 targeted tests passed across the neighborhood registry and navigation, dashboard travel, camera transitions, gesture handling, billboards and housing markers. `npm run build` passed. ESLint reported no errors in the changed TypeScript files; two existing hook-dependency warnings remain in `PlayableNeighborhood`.

The repository's full type check is blocked by an existing syntax error in `world-checkpoint-database.test.ts`. Excluding that file in a temporary check configuration and comparing with the original checkout produced no new TypeScript diagnostics. The existing missing home-departure cleanup import in the dashboard was fixed.

Visual and real-device performance verification remain outstanding. Headless Chromium could not start in the implementation environment. Before release, check orbit, pinch zoom, destination selection, drawer placement and travel on an Android phone with WebGL support. No live multiplayer session, database migration or production deployment was performed.

## City-depth revision

The terrain previously used a fixed 18-row depth for a 24-row map. Its top surface also covered road tops, and its decorative river sat below an uncut ground slab. Terrain now follows every authored row, leaves physical water openings and keeps all streets above the finished ground level. Unaligned decorative plateaus were removed rather than lifting gameplay coordinates independently.

Landmarks now have category-based building heights and upper-floor façade details. Deterministic decorative housing fills eligible roadside grass cells using batched meshes, capped at 96 homes. Authored venues, water, street props and known property markers are reserved. These homes are scenery, not additional purchasable properties or geographically verified buildings.

Daylight uses stronger directional contrast, the map starts closer to street detail, and two existing roadside sign positions carry ALADTECH Web Solutions and Wlegance Tech Hub billboards. No renderer package or backend change was needed.

For this revision, 29 selected tests passed (terrain clearance, water openings, infill reservations, camera, lighting, dashboard and authored map validation). Production build passed; changed-file lint had no errors and two existing fast-refresh warnings. Full type checking still encounters pre-existing errors outside the changed files. Visual matching to the supplied reference remains subject to review; the inline preview uses the real revised town components with a fixed midday clock and no live player session.

## Fixed city-view revision

The map camera now locks tilt and north-up orientation. One-finger and left-button drags pan the city; two fingers pinch to zoom and pan. Selecting a destination recentres without forcing a close-up or undoing the user's zoom. The centre-city control restores the authored city centre. Pan bounds prevent the whole map being dragged away. Canvas projection is orthographic only for map views; playable street scenes keep their existing perspective camera. Portrait framing keeps buildings readable rather than shrinking the whole city to fit its width.

The camera, dashboard, terrain and neighborhood regression suite passed 29 tests. Production build passed. Visual similarity to the supplied reference remains unverified in this runtime.

## Ordered review fixes

1. Removed distance fog from the town map and disabled street fog in the read-only neighborhood overview. The street gameplay renderer retains its existing fog. Stage validation: 18 selected tests and a production build.
2. Replaced percentage-based camera limits with the actual orthographic viewport's ground footprint. Minimum zoom fills the viewport with city land; pan limits update as the view zooms or resizes. Six real Three.js ray/ground-plane checks cover phone and desktop framing at three zoom levels. Stage validation: 26 selected tests. Edge destinations are brought into view while respecting the map bounds.
3. Replaced row-first infill with district-aware, street-facing terraces, apartments and garden compounds. The scenery budget is shared across districts and margins are left open. Authored venues, property markers, roads and water are reserved. Stage validation: 12 layout and terrain tests.
4. Added constant-screen-size category badges with 44-pixel tap targets. Crowded badges are hidden until zoom separates them, and selected destinations take priority. District names are optional. The existing accessible destination list and search/filter paths remain available. Stage validation: marker and callback tests, included in the consolidated suite.

Final validation: 56 selected map tests passed; production build passed; changed-file lint had no errors and one existing mixed-export fast-refresh warning in `map-badge.tsx`. Full typecheck remains blocked by existing repository errors; a temporary check excluding the known syntax-broken checkpoint test reported no diagnostics in the changed files. The inline preview runs the actual town components at midday without a live player session. Browser/device visual verification and mobile frame-rate measurement remain outstanding. No renderer dependency, database migration, public branch publication or deployment was performed.

## Destination sheet and travel controller

Destination selection now opens one accessible dialog with Travel and Details tabs. Transport selection survives tab changes. Mobile uses an expandable bottom sheet; desktop uses a right-side panel. Transport choices are native radios and the fare/confirmation footer stays outside the scrolling content. Unknown paid balances, shortfalls, access restrictions and lookup retries have explicit states.

`useMapTravelController` owns the selected destination and transaction lifecycle; `MapTravelSelector` supplies live eligibility and details; `DestinationSheet` only renders controlled props. Details share one query with eligibility. Existing travel RPCs and house-exit handoffs remain authoritative. After the RPC confirms travel, loading retries only refresh the saved destination and navigate; they cannot submit or charge a second trip. Activity/job actions remain in the Details tab.

Validation: 49 targeted tests passed across destination accessibility, controller duplicate-submit and recovery behavior, dashboard integration, transport and map geometry/gestures. Changed-file ESLint and the production build passed. Full type checking remains blocked by existing checkpoint-test syntax and unrelated project errors; the temporary diagnostic configuration found no errors in changed source files. The interactive preview uses the actual presentational sheet and city renderer with sample fares and local simulated travel. Browser/device visual QA remains outstanding.

## Destination selection and camera focus

The dashboard passes its selected landmark into the map, so taps, search and event/deep-link selection share the same highlight and camera focus. The existing beacon now includes a persistent visible outer ring; pulse animation respects reduced motion. MapCanvas measures the destination sheet and map with ResizeObserver, translating their overlap into camera focus insets. The fixed-angle orthographic camera offsets the selected ground point toward the remaining visible area and responds to sheet expansion. Focus pan bounds include the offset rather than clipping it away at map edges. Closing selection stops the transition without returning to overview or resetting zoom. Renderer-only previews retain their existing internal selection behavior.

A pointer tracker rejects six-pixel drags even after returning to the start, multi-touch gestures, and cancelled pointers. Keyboard selection remains available after dragging. No rotation or renderer replacement is introduced.

Validation: 40 targeted tests passed for focus geometry, pointer rejection, camera behavior (including preserving the view after closing), marker layout, dashboard and sheet integration. Changed-file ESLint and production build passed. Full typecheck remains blocked by existing checkpoint-test syntax errors. Real-device touch/performance and visual framing checks remain outstanding.

## Road route preview and journey feedback

Destination selection now derives a breadth-first shortest path over authored `r` road cells. Origin and destination snap to their nearest road access cells. No straight connectors across plots, water or buildings are drawn, and disconnected endpoints produce an unavailable message. This is a schematic road-access preview; it does not claim door-to-door walking navigation or change the authoritative destination-based fare/time rules. Existing mode selection continues to update fares and weather/traffic-adjusted time in the sheet.

The route uses one ribbon mesh with angular road-cell turns, two endpoint rings and a moving request indicator. The indicator moves only while submitting and stays still with reduced motion; it is not a completion percentage or a claim that server travel succeeded. Closing selection removes the route. An arrival toast is emitted only after the saved character destination matches and neighbourhood navigation succeeds. Confirmed-trip loading retries still cannot resubmit payment. House-exit handoffs retain their existing separate flow.

Routing is memoized by quantized origin cell and destination, preventing geometry rebuilds on fractional player movement. Geometry is disposed on replacement/unmount. No extra network requests or dependencies were introduced.

Validation: 84 targeted tests passed across authored-road routing, blocked/disconnected cases, corner sampling, live map landmark paths, arrival feedback, controller recovery, dashboard, destination sheet, transport and existing town mobility. Changed-file lint and production build passed. Full project typechecking remains blocked by known unrelated errors. Real-phone GPU, touch and visual route testing remain outstanding; desktop routing timings are not evidence of mobile rendering performance.

## Integration with expanded upstream map

Integrated against main 97a627e6, preserving its 40-by-24 grid, 19 districts, 47 landmarks, district growth tooling, HUD styles and Ludo changes. District house profiles now use the batched scenery renderer, with explicit property plots reserved. Property markers use the renderer cell scale. Terrain and tests derive dimensions from the current map. The existing travel RPC and five transport modes remain unchanged; paused destination scenes and Korope migration are excluded.

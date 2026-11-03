# OSOGBO LIFE master map audit and implementation plan

2 November 2026 · Phase 1: source audit and planning

This plan responds to the owner's master map prompt and the subsequent request to create an Art Bible. Read alongside [the proposed Art Bible](./osogbo-life-art-bible.md). It is a plan, not a claim that all seven implementation phases are complete. `AGENTS.md` and the master prompt require explicit approval before feature edits.

## 1. Audit scope and protected work

Read the supplied master brief, root `AGENTS.md`, active map and playable-neighborhood hosts, both Phaser implementations, town and world registries, shared movement/collision code, room server, map/housing domain adapters, home-renderer entry point, asset contract and relevant tests/QA documents.

The working tree already contains owner changes in `src/game/neighborhood-model.ts`: relocated roads and compounds, a home access lane, paths and moved interaction anchors. Further concurrent edits appeared in `phaser-neighborhood.ts` and the movement/model tests during the audit. Preserve those edits. This audit writes only these planning documents; it does not restore the previous layout, change gameplay code, apply SQL, alter assets, commit, push, open a PR or deploy.

Older QA and architecture documents describe Three.js town rendering or superseded neighborhood paths. Current source supersedes those descriptions. Keep the existing R3F/Three house interior: it is already present, not a newly introduced rendering engine. Converting furniture/interiors to Phaser is outside this map plan and requires a separate proposal.

## 2. Existing architecture

| Concern              | Current source and behavior                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| City dashboard       | `CityMapDashboard.tsx` → `MapCanvas.tsx`: React owns search, filters, district/landmark sheets, travel and server data                                                                                                    |
| Overview renderer    | `PhaserMapSurface.tsx` lazily imports `phaser-town-map.ts`, which creates a Phaser Canvas scene; `TownMapFallback.tsx` supplies an accessible SVG view while loading or unavailable                                       |
| Overview coordinates | `town-map-geometry.ts`: 1200 × 800 view, 24 × 18 grid, half-diamond dimensions 22 × 12; this is presentation space                                                                                                        |
| Town data            | `src/data/osogbo-town.json`: 11 distinct districts, 22 distinct landmarks and 22 building records; fictional, explicitly not geographic data                                                                              |
| Walkable host        | Authenticated `/neighborhood` → `PlayableNeighborhood.tsx` → browser-only `phaser-neighborhood.ts`                                                                                                                        |
| Playable projection  | `screenX = 1180 + (sceneX-sceneY)*0.45`; `screenY = 920 + (sceneX+sceneY)*0.22`; ground tile baseline 80 scene units                                                                                                      |
| Playable camera      | Projected world bounds, follow interpolation 0.12, initial zoom 0.65, limits 0.42–0.9; Phaser `Scale.RESIZE`                                                                                                              |
| Overview camera      | Bounded pan, drag/wheel and buttons; zoom 0.8–2.4; Phaser `Scale.FIT`; overview is not a controlled walking character                                                                                                     |
| Layout model         | `neighborhood-model.ts`: objects, obstacles, authored roads, paths and generated area templates; current city-centre bounds cover scene X -800…1440 and Y -660…1260                                                       |
| Movement authority   | `multiplayer/neighborhood-room.ts`, `authoritative-movement.ts`: authenticated Colyseus room, 32-player cap, 50ms simulation/patch intervals, validated movement intent, shared footprint collision and bounded positions |
| Coordinate adapter   | `toScene` / `toWorld`, scale 160; persisted movement remains X 0…14 / Y 0…12; area origins must remain shared between renderer and room server                                                                            |
| Characters and depth | Generated SVG-backed 48 × 60 avatar sprite frames with per-texture-manager pending-load reuse; player depth `(sceneX+sceneY)*0.25+1`; scenery uses related sum-based depth values                                         |
| Home entry           | Nearby home prompt calls `enter_player_home`; successful server confirmation routes to `/house`; the house's existing `leave_player_home` flow owns exit                                                                  |
| Backend boundaries   | Existing map APIs validate bearer identity and invoke map/travel/action RPCs; housing map data and canonical home data remain server-owned                                                                                |

React owns accessible UI, persistence commands and routes. Phaser owns presentation, camera and transient sprites. Colyseus owns shared movement/collision. Supabase remains authoritative for durable location, property, money, inventory and progression. No additional physics authority or renderer is proposed.

## 3. Verified findings and gaps

### What can be reused

- The overview is modular geometry, not one static background image. It already integrates existing venue, district, property and billboard inputs.
- The town grid has 18 rows of 24 cells. A four-neighbor audit found all 138 road cells in one connected component; no duplicate district or landmark IDs were found. This checks grid roads only, not pedestrian reachability in the walkable scene.
- Cedar Bank, Meridian Bank and Osun Mall retain explicit IDs/location slugs in town data and `map-location-links.ts`; preserve them.
- Authenticated area rooms, shared collision rules, generated area definitions, home entry, accessible controls and lifecycle cleanup already exist.
- The authored Olaiya data already includes compounds, kiosks, vegetation and street furniture. Current owner edits add an approach path and home lane.

### Missing or limited

| Finding                                                   | Evidence / consequence                                                                                                                                  | Proposed response                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Only Olaiya is exposed as playable                        | `useNeighborhoodConnection` rejects slugs other than `city-centre`; surface/host select that area explicitly                                            | Reuse the existing area registry but bind the host to the confirmed current location, one area at a time                            |
| Generic objects lack destination contracts                | Neighborhood objects currently identify only home/market/work/NPC and coordinates                                                                       | Extend the same model with stable destination, entrance, approach and interaction metadata                                          |
| Only the home proximity action is exposed                 | The current host offers home entry; other visible neighborhood destinations do not have equivalent action wiring                                        | Use React command adapters for existing shops/careers/services; avoid decorative doors for advertised interactables                 |
| Overview and walkable layout use separate representations | Town grid and movement-scene definitions have different units and geometry                                                                              | Preserve both coordinate spaces; add explicit identity/entrance mappings instead of treating coordinates as interchangeable         |
| Environment art is procedural placeholder geometry        | Current scenes draw coloured polygons/shapes; no reviewed production environment atlas or Art Bible was found                                           | Use the requested Art Bible and approve one production-art slice before expanding                                                   |
| No authored route reachability proof                      | Collision checks local occupancy, but no complete spawn-to-every-entrance validation exists                                                             | Add deterministic walkability sampling and flood-fill acceptance; add runtime pathfinding only if click-to-walk is approved         |
| Depth contract needs formalization                        | Depth values are coordinate-derived, but building image extents and front contact points are not a shared metadata contract                             | Define explicit ground anchors and overlap acceptance cases; fix demonstrated errors rather than changing every depth value blindly |
| Full overview rebuild on updates                          | `drawMap` removes/destroys the map container's children and recreates graphics, text and hit zones                                                      | Separate static scenery from changing markers, retain objects by stable ID, measure improvements                                    |
| Drag may also activate zones                              | The overview uses `pointerup` activation without an explicit drag-distance gate in `addZone`                                                            | Reproduce with mouse/touch; add a tap-versus-drag threshold and regression test if confirmed                                        |
| Clock-independent world lighting                          | Renderers do not consume the existing shared world clock                                                                                                | Plan an optional later visual adapter using the existing clock; keep venue-hour rules unchanged                                     |
| Some QA targets older views                               | `map-camera.test.tsx` tests the Three preview; legacy fallback tests exercise `OsogboMap`; runtime script looks for older `.town-place-bubble` overlays | Retain useful legacy tests but add current Phaser lifecycle, camera/input and screenshot coverage                                   |
| Performance is not measured for this brief                | No fresh authenticated renderer or physical Android benchmark was established by this audit                                                             | Capture baselines in the first approved implementation slice; do not claim an FPS improvement from source inspection                |

## 4. Proposed world architecture

Keep the city overview as the navigation/destination directory and the neighborhood as the explorable world. Both consume the same stable destination identities. Do not replace `/map` with a second unrelated city renderer or turn every building into an unvalidated teleport.

Extend `NeighborhoodArea` and extract large authored area definitions into small adjacent data modules as necessary. Keep the existing `neighborhoodAreaForSlug` entry point so the client and room server continue to share area/collision data. Pure data must remain importable by the room server without Phaser, React or browser globals.

Conceptual additions to the existing model:

```ts
type WorldBuilding = {
  id: string;
  districtId: string; // existing visual district, not a room ID
  locationSlug: string; // existing authoritative destination
  assetId: string;
  position: { x: number; y: number }; // neighborhood scene units
  footprint: { width: number; depth: number };
  groundAnchor: { x: number; y: number };
  entrance: { x: number; y: number; radius: number };
  approach: { x: number; y: number };
  interaction: {
    kind: "home" | "career" | "bank" | "shop" | "service";
    targetId: string; // existing backend/property target
  };
};
```

This is a proposed contract, not a schema migration or final TypeScript API. Derive art, collision, depth and prompts from the same definition. Keep visual objects, solid obstacles and gameplay targets distinct: an unenterable background compound may be decorative; a sign promising banking must have a valid target.

### Intended game loop

1. Select an existing destination in the overview or the current district.
2. Issue the existing authenticated travel command when travel is required; wait for confirmed arrival.
3. Join the room for the confirmed current location and restore a valid authoritative checkpoint.
4. Walk via existing keyboard/touch input. The room validates positions; the camera follows the player.
5. Reach the authored approach/entrance zone; React offers the matching existing domain action.
6. Work, shop, bank or enter home through the current authoritative RPC/API. Handle insufficient funds, age/access restrictions and failures through their existing rules.
7. Close the panel or leave the interior through the existing exit flow; restore a safe outside position and resume movement.

Opening a panel is not evidence that a server-side action succeeded. Visuals must reflect confirmed outcomes. Offline, denied, reconnecting and pending states must not award money or move the durable location locally.

## 5. Navigation, collision and camera

Keep the existing server-controlled directional movement for the first slice. Build an offline validation grid from the shared footprint data, expanded by the real player body, to prove spawn/exit/entrance connectivity. Validate every authored entrance and gate corridor after data changes. Use a navigation graph for connecting area exits only when actual district traversal is introduced. Do not add Arcade Physics as a competing authority.

If later click-to-walk is approved, compute a route over the same walkability model and send bounded intents along it; keep server collision decisive. Reject unreachable targets and stop cleanly on cancellation, room loss or UI interaction. This is a later feature, not an implicit prerequisite for ordinary directional movement.

Retain current world dimensions and coordinate adapters until a separate persistence review justifies changes. Establish one projection helper for the playable renderer, input conversion and depth calculations. Preserve a separate explicit overview projection. Use deterministic tests for inverse transforms, boundaries and resize behavior.

Camera follow remains in Phaser. Preserve bounded zoom initially; tune only after readability measurements. Define pan versus movement gestures, suppress post-drag taps, protect HUD touch targets and test returning from menus/interiors. Do not automatically couple overview pan controls to character movement.

Implementation reference: Phaser's [camera guide](https://docs.phaser.io/phaser/concepts/cameras) documents bounds, follow and camera coordinate spaces. The existing scene code remains the baseline for this project's chosen settings.

## 6. Art and asset pipeline

Follow `osogbo-life-art-bible.md`. Needed categories are terrain (grass/soil/concrete/paving), roads (straight/corner/T/four-way/edges/markings/crossings/drainage), housing families, banks/mall/shopfronts/stalls, trees/shrubs/plants, gates/fences/walls, benches/bins/lights/utilities/signs and separate interaction/label overlays.

Create only the pilot set after direction approval. Review it in the real scene with the actual avatar before adding districts. Use atlas/frame metadata and stable asset IDs; load shared assets once and area-specific pages on demand. Keep placeholder fallbacks for missing assets without silently replacing a bank with an unrelated building.

Current Canvas rendering can support a first reviewed sprite/atlas slice. Switching Phaser between Canvas/AUTO/WebGL is a measured implementation decision, not part of this audit and not a new engine. Do not require shader lighting for the first slice; use compatible baked material shading and separately controlled light overlays if approved.

Implementation reference: Phaser's [loader guide](https://docs.phaser.io/phaser/concepts/loader) supports shared and scene-specific asset loading with stable keys. Use the installed project version when implementing the manifest/atlas adapter.

## 7. Backend and existing systems

Read-only audit identified the relevant existing tables/contracts: `characters`, `locations`, `map_landmarks`, `jobs`, `character_jobs`, `career_shifts`, canonical housing/property state and their existing API/RPC paths. Travel uses `map_start_travel` and existing city travel flows; landmark details use `map_get_landmark_details`; venue actions use `perform_map_place_action`; housing markers use `housing_map_properties`; home entry/exit use `enter_player_home` / `leave_player_home`.

Do not add tables just to position artwork. First use existing stable IDs and client-authored visual metadata. If an actual missing server-side entrance or property-mapping contract is discovered, document its security/ownership requirements and propose a separate migration. No SQL application or migration execution is authorized by this plan. Hosted state, RLS behavior and room deployment versions were not verified here.

Client and room-server collision definitions must ship in a coordinated release when changed. A frontend-only deployment with a different obstacle layout can cause snapping or invisible walls. Persistent Colyseus rooms remain on their existing server infrastructure; the Vercel frontend is not a replacement movement server.

## 8. Mobile performance plan

Measure current behavior before changing render strategy. Capture frame-time median/p95, worst interaction pauses, object/text counts, renderer type, canvas dimensions/DPR, transfer and decoded texture estimates, and mount/unmount memory trends. Use the same scene, device and camera path before/after changes.

Proposed acceptance targets, not measured results: sustained ≥30 FPS on an agreed budget Android test device during a 60-second walk; no repeated >100ms interaction stalls; desktop target ≥60 FPS on the named test machine; no growing canvases/listeners or retained sprites across ten mounts. Record device model, browser, player count, thermal state and network. A headless 375px viewport is a layout check, not Android-performance proof.

Start with retained static terrain, stable-ID marker updates, shared atlas pages, label-density rules, no per-frame React state and no per-tick rebuilds. Add visibility culling or pooling only where profiling demonstrates a benefit. Do not load all districts or create a physics body for every decorative blade of grass.

## 9. Controlled implementation phases

| Phase                         | Deliverable                                                                                                                            | Exit gate                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 1 — Audit and architecture    | This source audit, proposed Art Bible, source/data inventory and baseline test results                                                 | Owner approves direction and the next bounded milestone                                       |
| 2 — World foundation          | Existing Olaiya pilot: shared projection/anchor contracts, validated roads/paths/entrances, retained scene layers, camera/input checks | Pilot is connected and playable with existing authority; source tests pass; baseline captured |
| 3 — District construction     | First expand to the existing Oja-Oba definition, then other registered areas in small groups; preserve location/district identities    | Each area has reachable spawn/exits/entrances and a distinct reviewed layout                  |
| 4 — Buildings and environment | Reviewed modular production-art kits, identity-specific banks/mall, housing and infrastructure                                         | Art Bible checklist, asset manifests/licences and mobile readability pass                     |
| 5 — Gameplay integration      | Bind existing shop/career/bank/service/home targets to verified entrance interactions and transitions                                  | Authenticated permission/failure/retry and two-client acceptance where applicable             |
| 6 — Visual polish             | Material variation, vegetation, shadows, signage, district detail; optional shared-clock lighting                                      | In-engine day/night and layering review, no new time or venue rules                           |
| 7 — Performance and QA        | Complete route, device, backend and rendering acceptance record                                                                        | Explicit test matrix and measured budgets pass; remaining deployment gates identified         |

Phases 2–5 should develop around a small usable slice rather than waiting for a whole city of art. The recommended next approval is **Phase 2: Olaiya foundation and one reference scene**, not unrestricted implementation of all seven phases. District production and asset expansion follow their own acceptance evidence.

## 10. Testing and regression risks

- Pure tests: coordinate transforms; stable identities; footprint/anchor consistency; road joins; spawn-to-entrance flood fill; unobstructed gates; collision edges; normalized speed and room bounds.
- Component tests: confirmed area selection, nearby action adapters, unavailable data, offline/reconnect/pending state, accessibility and menu/phone routing.
- Browser tests: real Phaser initialization/cleanup, resize/zoom/follow, drag-versus-tap, touch HUD isolation, avatar depth overlap, actual entrance/exit, overview fallback.
- Domain tests: preserve existing map travel/action, rent/property ownership, home entry/exit, banking/career/payment and retry receipts. No economy-rule changes are planned.
- Hosted acceptance: authenticated user, blocked/unauthorized home entry, two accounts in the same/different rooms, reconnect, confirmed travel and durable return positions. Requires explicit test access; not established by synthetic fixtures.
- Visual/device matrix: 375px and wider phone layouts, actual Android, desktop, minimum/maximum zoom, crowded view and all representative district families.

Major regression risks are coordinate-space confusion, desynchronized room collision, inaccessible saved spawns after layout edits, building depth errors, stale venue/property IDs, route panels replacing full-page navigation incorrectly, texture-memory growth and SSR/browser-only import failures. Gate each milestone on relevant focused tests, typecheck, scoped lint, game build and `git diff --check`; add public build only if its sources change.

## 11. Audit validation evidence

- Read-only town-data check: 11 districts, 22 landmarks, 22 buildings, unique district/landmark IDs, consistent 24 × 18 dimensions, 138 road tiles in one four-neighbor component.
- Fresh focused run: **26 passed, 1 failed across five files** (`neighborhood-model`, `authoritative-movement`, `map-housing-markers`, `city-map-dashboard`, legacy `osogbo-map-fallback`). Log: `.smoke/master-map-audit-tests.log`.
- Initial failure: `authoritative-movement.test.ts`'s old hardcoded blocked point `{x:6.06,y:5.2}` was no longer blocked after the home/layout relocation. Concurrent owner work replaced it with the current home-footprint coordinate. The fresh movement/model rerun then passed **14 tests across two files**; log: `.smoke/master-map-audit-movement-final.log`. No gameplay/test-source fix was made by this documentation audit.
- Fresh whole-project `npm.cmd run typecheck` passed. Documentation `git diff --check` passed.
- No new production-art screenshot, physical-device performance result, authenticated browser session, hosted SQL verification, deployment or full regression run is claimed.

## Approval and implementation

The owner approved the Art Bible and **Phase 2: Olaiya foundation plus one in-engine reference scene** on 2 November 2026, with an explicit routing requirement: maps, the neighborhood and houses render only on full pages, never in the phone dialog. This overrides the earlier general phone-link behavior for `/map`, `/neighborhood`, `/house`, `/home` (including friend visits), and location routes.

The approval authorizes the bounded client/shared-model/test work described above; it does not authorize database changes, production server rollout, mass asset generation or expansion to every district. See `world-foundation-implementation.md` for implementation evidence and remaining acceptance limits.

The owner's subsequent “proceed” and “continue” authorize the next coherent district slice, **Phase 3a: Oja-Oba**. This enables only the existing market district alongside Olaiya, preserves confirmed-location travel and full-page world routes, and leaves further district/asset expansion gated. Implementation and local acceptance evidence are recorded in `oja-oba-district-implementation.md`.

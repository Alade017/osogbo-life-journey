# PlayCanvas home interior slice — plan only

Date: 2026-10-24 (Africa/Lagos). **Verified:** this document originally ended the Phase 1/2 run. The owner then said “continue” with this plan open, authorizing the isolated, flagged benchmark described below. R3F remains the default; default-renderer adoption and gameplay Phases 3–8 remain gated. Benchmark results are recorded separately in `docs/playcanvas-home-benchmark.md`; the proposal and original evidence below are retained as the pre-implementation record.

## Recommendation and evidence labels

**Assumed (proposal):** consider an isolated, optional home-interior benchmark before deciding on migration. Keep R3F as the default. Approve adoption only if equal assets/input behavior produce a measurable improvement on an actual budget Android phone without violating the budgets below. A new engine alone cannot establish better performance or artwork.

**Verified** means inspected source, local command output or identified upstream metadata/docs. **Assumed** identifies a proposed design/target needing owner agreement. **Unverified** identifies a test or fact not established here. No runtime PlayCanvas compatibility or performance is claimed.

## Scope and current implementation

| Status | Finding / evidence |
| --- | --- |
| Verified | Scope files exist: `src/components/game/housing/HouseRoom3D.tsx` and `src/routes/_authenticated/_game/house.tsx`. The route imports the renderer at line 13 and renders it near line 849. This is the actual home-interior slice, not the older HomeInterior renderer. |
| Verified | React 19.3.0, TypeScript 5.9.3, Vite 8.1.5, Three 0.186.1, Fiber 9.8.1, Drei 10.7.9 and Node v24.12.0 are installed. The project is ESM with strict TypeScript and TanStack Start SSR; browser-only engine initialization must respect that boundary. |
| Verified | HouseRoom3D currently uses Fiber Canvas, OrbitControls, optional GLTF models, procedural room/furniture fallbacks, pointer capture, drag preview, compatible empty-slot targeting and suppression of a click following a drag. See its Props near line 24, SlotObject near line 359 and drag handling from line 480 onward. |
| Verified | The route owns canonical state, pending actions, offline guards, selection and temporary move preview. `house-state-sync.ts` owns the shared query key/update and private broadcast subscription. The renderer must not become a second persistence system. |
| Assumed (scope) | No changes to rent/relief, accessories/catalog/outfits, visits, map markers/city rendering, multiplayer, economy or career. Existing data is displayed through the same route; no feature screen, progression or reward is added. |

## Preserve the renderer contract

**Verified:** HouseRoom3D accepts these current props; retain their names and payloads. Slot/placement types are exported by `HouseRoomScene.tsx:5` and `:6`.

| Prop | Confirmed type / meaning |
| --- | --- |
| `houseTypeId` | string; selects room dimensions/model path |
| `accessoryBand` | string; included accessory visibility tier |
| `slots` | HouseSlot[]: id, slot_type, x, y, optional z |
| `placements` | HousePlacement[]: id, item_id, slot, art_key, category, slot_type; optional overlay art |
| `editMode` | boolean |
| `moveEnabled` | boolean; honor pending/offline restrictions supplied by route |
| `onSelectPlacement` | `(placement: HousePlacement) => void` |
| `onSelectSlot` | `(slot: HouseSlot) => void` |
| `onMove` | `(placement: HousePlacement, slot: HouseSlot) => void` |

**Assumed (proposal):** add a renderer boundary with exactly this shared contract. Keep type definitions reusable without importing an engine runtime. Reconcile entity IDs against the newest props; pointer-up must never submit a stale removed placement. Match current room dimensions and normalized slot coordinates, orientation, accessory tier naming and fallback appearance. Do not reinterpret percentage slots as world meters.

## Preserve the authoritative API

**Verified:** `house-api.server.ts:128–150` validates the bearer token with getUser and supplies the authenticated user ID to server-only RPC calls. Renderer callbacks do not submit player identity, ownership or reward values.

| Existing HTTP boundary | Existing RPC / trusted arguments | Source evidence |
| --- | --- | --- |
| GET `/api/house/state` | `get_house_state(p_player_id uuid)` | `house-api.server.ts:141`; Supabase migration `202610170005_server_house_inventory.sql:377` and Drizzle `0041_server_house_inventory.sql:377` |
| POST `/api/house/place`, body `{itemId, slot}` | `house_place(p_player_id uuid, p_item_id text, p_slot text)` | `house-api.server.ts:142`; initial Supabase migration line 414; later Drizzle replacement `0062_housing_starter_furniture_catalogue.sql:22` |
| POST `/api/house/move`, body `{fromSlot, toSlot}` | `house_move(p_player_id uuid, p_from_slot text, p_to_slot text)` | `house-api.server.ts:144`; `drizzle/migrations/0071_atomic_house_furniture_move.sql:2` |
| POST `/api/house/remove`, body `{slot}` | `house_remove(p_player_id uuid, p_slot text)` | `house-api.server.ts:150`; initial Supabase/Drizzle inventory migration line 455 |

**Verified:** get_house_state returns JSON containing house, placements, outfit and inventory. Mutation RPCs return confirmed state on success; the route normalizes the state before updating its query cache and clears move preview on success or error. house_move validates house/placement ownership, matching slot and occupancy, updates canonical/legacy placement atomically, and grants execution to service_role rather than the browser (0071 lines 2–60). `house-api.test.ts`, house state-sync tests and local housing acceptance pass; this is local evidence.

**Assumed (proposal):** keep those handlers, grants and mutation paths untouched. PlayCanvas sends only existing semantic callbacks. React maintains one pending request and the existing rollback/refetch/error path. Renderer switching uses the same canonical snapshot/selection, never local-storage authority. No migration or security change is needed for this visual slice.

**Unverified:** deployed SQL definitions, migration order across both migration trees, hosted RLS/grants and concurrent authenticated mutations were not checked. Do not assume the Supabase migration tree alone includes house_move: its current definition was found in Drizzle 0071. A renderer implementation must not attempt to repair hosted schema automatically.

## Flag, lifecycle and event ownership

All items in this section are **Assumed (proposal)** and are not implemented:

1. Use a house-only flag, provisionally `VITE_HOME_RENDERER=r3f|playcanvas`, default `r3f`. Keep existing R3F code available as a lazy fallback. Only the selected renderer mounts; the current static HouseRoom3D import needs to move behind the boundary during an approved implementation. No PlayCanvas import in the SSR module graph before the client boundary mounts.
2. Dynamically import the standalone engine inside a client effect; do not add a React engine wrapper or a global store. Retain route-owned mutations/queries and pass callbacks through stable refs so state updates do not recreate the application every frame.
3. Use one canvas, one resize observer and one engine update loop. On unmount or flag switch, detach input/visibility/resize listeners, release pointer capture, remove callbacks, unload only owned assets/resources, destroy entities/application and reject or ignore stale async-load completions. StrictMode mount/unmount/remount must leave one live canvas/context.
4. React owns sheets, dialogs, HUD, inventory, status and accessible selection controls. Canvas listeners attach to the canvas, not document. Overlays consume pointer/wheel input; renderer input is disabled while a blocking overlay is active. Opening a sheet during a drag cancels that drag. Keyboard focus remains in the React control that initiated the action.
5. Canvas hit-testing returns placement/slot IDs, then resolves current objects and calls the existing callbacks. Drag uses a movement threshold and compatible empty-slot preview; a completed drag consumes its following click. Pointer cancel, multi-touch, lost capture, route departure and disabled move all cancel without sending a mutation. An orbit gesture cannot also select furniture. Each pointer sequence causes at most one semantic action.
6. On initialization or asset-load failure, dispose the failed engine before mounting R3F and preserve the route snapshot. Do not auto-loop between failing engines. A browser without the necessary WebGL support may fail both; retain accessible React controls and a useful renderer error rather than promising R3F will repair missing GPU capability. Context loss and restoration need an explicit tested policy.
7. Background rendering can pause for battery savings; it must never pause/advance authoritative time or simulate income, needs or rewards independently. Rendering resumes from fresh server state.

## Assets and compression investigation

| Status | Actual inventory / implication |
| --- | --- |
| Verified | `public/models/rooms/development-room.glb` is the only room GLB present: 7,784 bytes, GLB version 2 and matching declared length; JSON asset version 2.0, generator THREE.GLTFExporter r186; four meshes, embedded 3,360-byte buffer, no images, no extensionsUsed/Required. SHA-256: `c7c86192abd23421e5ed97e337755f97ad491550b8718e8a011d305ae5e37088`. Metadata was read from its GLB JSON chunk, not inferred from the extension. |
| Verified | No `public/models/furniture/` directory exists. The room renderer requests six type-derived URLs: shared-room, single-room, studio-flat, mini-flat, bungalow, duplex under `/models/rooms/`; those files are absent. The development GLB is not one of these runtime room URLs. Furniture URLs are sanitized `art_key` names under `/models/furniture/`. See HouseRoom3D lines 429 and 582. |
| Verified | Current loader uses `useGLTF(path, "/models/draco/", true)` after a HEAD probe and supplies model-error/Suspense procedural fallbacks. Development-room itself does not declare Draco, meshopt or texture compression. This does not characterize future exports or all city assets. |
| Verified | Decoder files exist: draco_decoder.js 512,465 bytes, draco_decoder.wasm 192,420 bytes and draco_wasm_wrapper.js 58,456 bytes. `scripts/generate-development-models.mjs` copies them from Three's glTF Draco distribution. `public/models/draco/LICENSE` is Three's MIT notice. |
| Verified / limitation | `public/models/README.md` identifies development models as original procedural fixtures generated by the repository script. This documents provenance, not an independently audited asset license grant. Kenney city packs have separate source notices, but those packs are outside this home migration slice. |
| Unverified | No room/furniture model was loaded in PlayCanvas. No production Blender room/furniture set, decoder interoperability, texture/material fidelity, dimensions/slots or asset redistribution review was validated. The existing Three MIT notice alone is not asserted to settle every upstream Draco attribution requirement. |

**Assumed (technically plausible loading proposal):** load uncompressed glTF 2.0/GLB through the engine's container asset pipeline, instantiate the render hierarchy and map named accessory nodes to the current tier filter. Preserve procedural room/furniture placeholders for missing models. No physics dependency is necessary for plane/slot picking in this proposed slice.

**Verified (documentation only):** PlayCanvas publishes Draco initialization configuration using a JS glue URL and WASM URL. The consulted API page identifies itself as v2.19.6, so it is reference evidence rather than confirmation of the exact candidate version's signatures. [Upstream Draco API](https://api.playcanvas.com/engine/functions/dracoInitialize.html).

**Assumed / Unverified:** for compressed future assets, use a reviewed, version-compatible decoder pair, with correct WASM MIME/CORS/CSP/worker settings; do not assume Three's vendored decoder can be reused unchanged. Check actual extensions and matching engine types/source before approving the loader. An actual PlayCanvas load test would require the separately approved dependency/prototype, so it was not performed.

## Candidate version, license and tooling

**Verified:** a read-only permitted `npm.cmd view playcanvas@2.23.3 version license engines type exports --json` returned version **2.23.3**, license **MIT**, Node **>=18.3.0**, ESM package type, TypeScript declarations at `build/playcanvas.d.ts` and an ESM import export. Node v24.12.0 satisfies that declared floor. This is the package's own registry metadata, not a guessed license. [Package metadata](https://registry.npmjs.org/playcanvas/2.23.3).

**Verified (upstream docs):** the standalone-engine guide describes Vite and TypeScript integration; release listings identify v2.23.3. The versioning page states engine v2 removed WebGL 1 support. [Standalone guide](https://developer.playcanvas.com/user-manual/engine/standalone/), [releases](https://github.com/playcanvas/engine/releases), [versioning](https://developer.playcanvas.com/user-manual/engine/versioning/).

**Assumed (recommendation):** use exact `playcanvas@2.23.3` only as the candidate for an owner-approved benchmark. Metadata/ESM/types are compatible in principle with this repository's Node/TS/Vite setup; no React peer bridge is proposed. Retain license notices and update the lockfile only in that approved implementation. Recheck version advisories/metadata before installation if this decision is delayed.

**Unverified:** actual Vite 8 bundling/tree shaking, SSR/client splitting, TypeScript surface compatibility, WebGL2 support on the target devices, compressed-asset loading, candidate-specific APIs and total dependency footprint. These cannot be called compatible-at-runtime until the prototype/build/device checks run. No dependency or lockfile was changed here.

## Performance targets and risks

**Verified:** the final current game build's largest shared client JS asset is 1,828,078 bytes raw. Build warnings already report a chunk over 1,000 kB. This is a shared bundle observation, not a measured home-only transfer or a mobile frame/memory baseline. PlayCanvas adds a second engine to a project that still uses Three elsewhere.

**Assumed (initial acceptance budgets, owner to confirm):** measure identical content, DPR/resolution and camera/input paths in both engines on the same hardware. Adjust only after recording a baseline and reviewing the tradeoff.

| Metric | Proposed target — all Assumed |
| --- | --- |
| Budget Android, 375px CSS width | No horizontal document overflow; sustained >=30 FPS, p95 frame time <=33.3ms after warm-up; no crash during a 15-minute arrange session |
| Desktop | >=60 FPS / p95 <=16.7ms for the same representative room |
| Usable cold home load | <=5s on a defined 10 Mbps / 100ms-latency profile; warm load <=2s; report asset, shader and interaction-ready times separately |
| Incremental transfer | No engine download outside selected home slice; <=20 kB gzip added to unrelated entry code, candidate engine+adapter <=600 kB gzip, with decoder and assets reported separately |
| Memory | <=150 MB JS heap where measurable and an initial <=128 MB GPU-resource estimate; after 20 home enter/leave cycles no retained canvases/listeners and <=10 MB post-GC heap growth |
| Interaction | Selection/drag feedback within 100ms p95 excluding network; one server request per completed move, no UI success before confirmation |

**Unverified / risk:** engine GPU allocation may not be directly exposed on the selected phone; record available browser metrics and texture/mesh resource estimates rather than invent a measurement. Both engines can remain downloaded after visiting other 3D routes even when only one is mounted. Shader warm-up, dual caches, decoder workers, DPR, thermal throttling and asset quality may outweigh engine gains. Do not claim a win from an empty room or desktop SwiftShader.

## Verification and acceptance plan

All work below is **Assumed (proposed testing after approval)**:

- Unit/adapter: identical props in each renderer; stable selection across snapshot changes; add/remove/move reconciliation; stale IDs ignored; pending/offline/editMode respected; no mutation from invalid/occupied/mismatched slots.
- Input: short click versus drag/orbit, touch and mouse, pointer cancel/lost capture, two fingers, overlay open mid-drag, keyboard selection/escape and focus return. Assert one semantic callback and one existing route mutation per gesture.
- Persistence: use existing house API/state-sync/placement tests; verify successful placement/move/removal, server rejection rollback/refetch, reload and remote changes. Staging tests must use two accounts for unauthorized access; no privileged key reaches the renderer.
- Loading/lifecycle: real uncompressed GLB, real approved Draco sample, missing/corrupt model, missing decoder/WASM, route change during load, ResizeObserver, StrictMode remount, feature-flag switch, context loss, fallback once and route re-entry. Count contexts/canvases/listeners and check asset ownership before disposal.
- Visual parity: every supported house type and accessory band, representative furniture/slots, tier-node visibility and fallback scene. Capture and compare at 375px and desktop with readable React overlays; no click-through or duplicate interactions.
- Device: record a real low-end Android model/RAM/GPU/Android/Chrome version, fresh and warm loads, throttled connection, battery/thermal conditions and 15-minute session. Compare both renderers in randomized order with identical assets. Desktop browser coverage and accessibility are additional checks, not substitutes.
- Repeat existing typecheck, changed-source lint, affected suites, full Vitest and game/public builds. Close any new failures before adoption; record existing repository lint separately.

**Verified current validation:** map stabilization ended with 486/486 tests passing across 113 files, no skips; final typecheck, changed-file lint and both builds passed. Repository lint still has 330 errors / 12 warnings. The existing 375px Chrome check produced no usable lifecycle result on either attempt; no browser/device acceptance is claimed. See `docs/release-qa.md` and `docs/map-issues-inventory.md` for commands, before/after evidence and exact changed files.

**Unverified:** every PlayCanvas rendering/input/fallback/performance test above, actual Android testing, hosted RLS/concurrent actions and authenticated room behavior. This plan does not close those gates.

## Proposed affected files and owner decisions

**Assumed (future implementation only):** a small renderer boundary/type module under `src/components/game/housing/`, a client-only PlayCanvas adapter beside the existing renderer, a house-only flag, lazy selection in `house.tsx`, dedicated adapter/input/lifecycle tests and approved assets/license notices. `package.json` and `package-lock.json` would change only after installation approval. Existing HouseRoom3D remains available. No SQL changes are proposed.

**Owner decisions required:** whether to authorize this isolated benchmark and exact candidate dependency; agree the target phone/browser and budgets; supply or approve reviewed room/furniture assets and decoder notices; then review measured results before any default-renderer change. Repository lint cleanup and later gameplay phases need their own scope decision. Approving this document is not permission to deploy, alter databases or start Phases 3–8.

**Verified final boundary:** this run added no PlayCanvas dependency/code, changed no current home renderer, applied no migrations and performed no commits/pushes/PRs/merges/deployments. **Stop here and wait for explicit owner approval.**

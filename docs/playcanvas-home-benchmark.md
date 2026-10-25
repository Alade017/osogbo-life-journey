# Optional PlayCanvas home benchmark

Date: 2026-10-25, Africa/Lagos. The owner authorized this isolated benchmark by saying “continue” after the home-slice plan. R3F remains the default. This is a prototype, with no recommendation to adopt PlayCanvas as the default.

## Completed

The home route uses a renderer boundary with an explicit `VITE_HOME_RENDERER=playcanvas` opt-in, lazy browser initialization, R3F fallback, and accessible controls if both graphics renderers fail. The existing route owns placements and mutations. The adapter emits selection/move callbacks and does not persist state. Pending actions and overlays cancel gestures. PlayCanvas 2.23.3 is pinned; its MIT license is included under `public/licenses/`.

For local opt-in, set `VITE_HOME_RENDERER=playcanvas` before starting Vite. Remove that variable to use the default. The checked-in `.env.example` documents the flag; the actual `.env` was not changed by this work.

## Browser evidence

Commands: `node scripts/home-renderer-browser-check.mjs 375` and the same command with `1024`. Both passed in local headless Chrome using software rendering, DPR 2 and touch emulation. These are isolated built fixtures, without authentication or a Supabase connection.

| Observation | 375px | 1024px |
| --- | ---: | ---: |
| Loaded GLB instances | 1 | 1 |
| Selection callbacks | 1 | 1 |
| Move callbacks | 2 | 2 |
| Input listeners / observers after disposal | 0 / 0 | 0 / 0 |
| Page errors / unexpected network failures | 0 / 0 | 0 / 0 |
| Observed initialization, ms | 1033.2 | 745.2 |
| Observed readiness, ms | 3844.2 | 1833.8 |
| p95 frame interval, ms | 79.0 | 189.2 |

Both fixtures verified mouse selection, mouse drag, touch drag, cancellation by a second touch, overlay/pending-state cancellation, no canonical placement mutation, no viewport overflow, and idempotent disposal. Screenshots and raw logs are local `.smoke/` artifacts. The fixture contains the original `development-room.glb` plus a procedural bed and empty slot.

The isolated fixture's JavaScript totals 2,096,817 raw bytes / 537,714 gzip bytes, including its shared dependencies. This is not an application entry-size delta. Frame intervals include software rendering and interaction; they are not GPU timings or evidence of a performance improvement. No equivalent R3F comparison was measured.

The harness records canceled HEAD probes separately only when response status is already 200 or 404. Expected missing furniture models exercise procedural fallback. Unexpected asset GET failures remain fatal. An earlier harness run failed on these completed HEAD probes and a favicon request; the final runs include a data-URL favicon and retain the probe diagnostics.

## Files changed for the benchmark

- `.env.example`, `package.json`, `package-lock.json`
- `public/licenses/playcanvas-2.23.3-MIT.txt`
- `src/components/game/housing/house-room-contract.ts`
- `src/components/game/housing/house-room-input.ts`
- `src/components/game/housing/house-playcanvas-runtime.ts`
- `src/components/game/housing/HouseRoomRenderer.tsx`
- `src/components/game/housing/HouseRoomPlayCanvas.tsx`
- `src/components/game/housing/HouseRoom3D.tsx`
- `src/routes/_authenticated/_game/house.tsx`
- `src/styles/house-screen.css`
- `src/test/house-room-input.test.ts`, `src/test/house-room-renderer.test.tsx`
- `scripts/vite.home-benchmark.config.ts`, `scripts/home-renderer-browser-check.mjs`
- `docs/playcanvas-home-slice-plan.md`, this report, `docs/release-qa.md`

The implementation was already present in owner commit `db742945` when this continuation began. This continuation preserves that commit and adjusts only the browser harness and documentation.

## Validation and limits

Focused tests previously passed: 15 tests across 2 files. `npx.cmd vitest run --maxWorkers=1 --reporter=verbose` passed: **501 tests across 115 files, zero skipped**, exit code 0, 828.65 seconds. `npm.cmd run typecheck` passed with exit code 0. `npx.cmd eslint` over all benchmark TypeScript/TSX files, the house route and both benchmark scripts passed with zero errors or warnings. `npm.cmd run build` passed (including client, SSR and Nitro output); `npm.cmd run build:public` passed (17 modules, 228.29 kB JavaScript / 71.03 kB gzip). The game build reports large-chunk warnings. Repository-wide lint remains known debt: 330 errors and 12 warnings; it is not a green check.

Generic boxes still represent some furniture. Pinch zoom, Draco-compressed assets, complete visual parity, budget Android performance/memory, authenticated home-route integration, and hosted RPC/RLS behavior remain unverified. Neither measured software-rendering interval meets the proposed mobile frame budget; these runs cannot approve adoption.

No migrations, RPC/auth changes, production data operations, deployment, branch creation, commits, pushes, PRs, merges, or history rewrites were performed by this continuation. Default adoption and gameplay phases 3–8 remain deferred pending their respective approval gates.

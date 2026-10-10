# Playable neighborhood architecture

This document records the current gameplay boundary and Milestone 1 architecture baseline for the OSOGBO LIFE multiplayer specification. The first scene provides one reusable neighborhood, not a finished full city. Phaser 3 owns world rendering and its frame loop because Arcade Physics gives the world one owner for movement, collision, camera and depth. React retains routes, accessible controls, menus, HUD, nearby interaction prompts and server data. The Milestone 1 baseline was single-player; Milestone 4 now adds a local authoritative room server, with production hosting and authenticated multi-client acceptance still outstanding.

## Architecture decision baseline (Milestone 1)

### Runtime ownership

| Concern | Owner | Current boundary |
| --- | --- | --- |
| Public site, auth forms, onboarding, HUD, accessible menus and interaction panels | React/TanStack Start | Routes and components render user-facing state and issue domain commands. |
| World frame loop, local input, camera, collision, animation and world-side proximity | Phaser 3 | `NeighborhoodScene` owns transient local presentation. It must not write durable economy or progression state. |
| Rules and command adapters | `src/lib` domain services and `src/lib/game.ts` | Existing typed services and Supabase RPC wrappers remain the entry points for travel, jobs, inventory, purchases and persistence. |
| Durable identity and player progression | Supabase Auth/Postgres/RPCs | Existing authenticated records and server-validated RPCs remain authoritative. Do not persist movement per rendered frame. |
| Shared transient player state | Not implemented yet | A dedicated authoritative multiplayer runtime is the recommended target; remote players must not be fabricated in the client. |

React and Phaser communicate through the typed `NeighborhoodBridge` contract in `src/game/neighborhood-scene.ts`. It carries initial world coordinates, proximity/checkpoint notifications, interactions and an asynchronous checkpoint command. Keep that bridge narrow: UI commands flow into the scene through explicit methods, while scene events flow back through callbacks. Do not expose React state setters or Supabase clients to Phaser.

The current React host lazily imports the browser-only scene, creates one engine per mounted host, and destroys it on cleanup. It pauses movement for hidden/offline tabs and pending UI actions. Position saves are stop/interaction checkpoints through the existing revision-checked RPC path. These are source-level boundaries; they do not establish a multiplayer connection or live backend verification.

### Multiplayer decision

Adopt a **dedicated authoritative room server** as the target for shared movement, area membership, presence, disconnect cleanup and reconnect recovery. Keep Supabase Auth as the account identity source and validate a short-lived server-side join credential before admitting a player. Keep durable character, economy, inventory, jobs and home data in Supabase behind existing RLS/RPC rules. The room server owns transient room state; it must not become a second wallet or progression database.

This fits Phaser's scene model and the requirement for validated room membership and movement, while preserving the existing Supabase persistence and React application. Supabase Realtime can be evaluated for low-frequency presence or notifications, but is not selected as the movement authority. Vercel remains suitable for frontend delivery only; do not assume its serverless functions host a continuously running room process.

Milestone 4 selects **Colyseus 0.18** for room management and schema-based state synchronization. It is self-hostable; a paid managed host is deferred until staging needs are known. The local Node server authenticates Supabase access tokens against Supabase Auth, then reads the player's character and selected location through the same user token and database RLS. Each room is keyed by stable location ID, has a 32-player cap and 20 Hz server movement updates. The server accepts movement intent only, validates bounds and collision, and broadcasts transient positions; it does not write the database each frame. A rejected connection leaves the UI frozen until the player manually reconnects. The browser uses `VITE_MULTIPLAYER_URL`; the local default is `ws://127.0.0.1:2567`, and the room process starts with `npm.cmd run multiplayer:dev`.

The room server is not deployed or covered by a live two-account session yet. Hosting, health monitoring, TLS/WSS, production origin configuration, restart/reconnect policy and region latency remain staging decisions. No live domain, auth redirect, paid service or production setting is changed here.

### Milestone 5 area and transition implementation

The first two seeded districts, `city-centre` (Olaiya) and `oja-oba` (Oja-Oba Market), now have separate scene layouts, road palettes and interaction/building positions. `neighborhoodAreaForSlug` is the shared source used by Phaser rendering and the room server's movement collision model, so an area cannot display one footprint while the server blocks another. Unknown location slugs retain the Olaiya layout until a scene is authored for them. District travel continues to use `travel_to_city_location`, including its server validation, request ID and expected position revision; a successful location change leaves the old location room and joins the new location room from the saved checkpoint. The personal 3D home remains the existing interior route, entered after a checkpoint and exited back to the city map.

These are source and unit-test boundaries. Authenticated travel between two live clients and home access/visiting permissions have not been verified; home interiors are not yet shared multiplayer rooms. Additional locations need authored area layouts before they can be described as visually distinct.

### World and persistence model

Use stable area identifiers in the world layer and a data-driven scene/area definition for map reference, bounds, spawn points, exits, collision assets and room mapping. Keep the existing movement grid and database checkpoint format compatible until an explicit migration is reviewed. Travel remains a domain command validated by the existing Supabase RPC; when multiplayer arrives, the room transfer must be coordinated with that successful command so a client cannot teleport by changing local coordinates.

Transient movement, facing, animation and room membership belong to the room runtime once implemented. Durable character appearance, validated wallet transactions, inventory, jobs, home saves and a safe checkpoint remain in Supabase. Local housing/simulation snapshots are not proof of server-persisted ownership or progression. Add social persistence only when a concrete social milestone defines ownership, access policies, retention and moderation requirements; the current schema audit found no player-to-player chat/friend/block/report model.

### Design-system baseline

Reuse the existing tokens in `src/styles.css` and current light game styling. The root palette currently defines porcelain `--background: #f6f1e7`, forest `--primary: #176b45`, and charcoal `--foreground: #202820`; the title screen also uses warm ivory and deep green. Treat these as the current baseline, not a request to replace the design system with a second palette. Extend shared tokens/components only when a scoped screen need is identified. Phaser world colors remain scene-art values and should not be used as a competing React UI token set.

### Domain boundaries and implementation map

- Public website: `public-site/`, `vite.public.config.ts`, `src/routes/index.tsx` (game title route); separately buildable locally, with real domain separation still dependent on hosting configuration.
- Authentication and onboarding: `src/routes/login.tsx`, `src/routes/signup.tsx`, `src/routes/_authenticated/route.tsx`, and `src/routes/_authenticated/create-character.tsx`.
- Game shell and UI: `src/routes/_authenticated/_game.tsx`, `src/components/game/`, `src/styles.css`.
- Phaser world and model: `src/game/neighborhood-scene.ts`, `src/game/neighborhood-model.ts`, `src/components/game/NeighborhoodGame.tsx`.
- Persistent domain adapter: `src/lib/game.ts`, focused `src/lib/*-service.ts` modules, and `drizzle/migrations/`.
- Deployment configuration: `vite.config.ts`, `vite.public.config.ts`, `docs/neighborhood-architecture.md`, and `docs/release-qa.md`; provider projects, production domains and deployed settings are not represented as verified local configuration.

### Milestone 1 acceptance record

- React/Phaser ownership and the typed bridge are documented against existing source.
- Transient and persistent state have separate owners; existing authoritative RPC paths remain in place.
- Existing design tokens are recorded and reused; no duplicate palette or UI framework is introduced.
- Multiplayer is explicitly marked unimplemented, with an authoritative room-server direction and infrastructure decisions left open for evidence-based selection.
- No database schema, package manifest, deployment setting or production service is changed by this baseline.

## Ownership and persistence

- `src/game/neighborhood-scene.ts`: Phaser scene, original generated textures, static collision footprints, normalized velocity, camera follow, mouse/touch destination and keyboard input.
- `src/game/neighborhood-model.ts`: coordinate mapping and proximity rules, independent of rendering. Conventional top-down coordinates are converted to the existing database movement grid; artwork suggests building depth without skewing physics.
- `NeighborhoodGame`: lazy browser-only engine loading and cleanup, React touch controls/dialogue, server checkpoint bridge. Save only on stopping or entering, never each frame. Movement freezes during a request. Failed/stale requests reload the authoritative checkpoint; server-returned revisions prevent concurrent writes.
- Existing server RPCs retain authority for purchases, work, progression and inventory. This phase requires no new database schema. Migration 0024 remains a separate deployment prerequisite for the previously implemented personal simulation.

The existing navigable 3D house is preserved deliberately: it already has rooms, furniture, persistence and collision-aware navigation. Replacing it with a Phaser interior would be a separate conversion with no current gameplay benefit. Entry links to `/home`; the exterior checkpoint is saved before entry and restored on return to `/map`.

## Art rules

Original procedural vector textures: 32 x 44 character canvas, 16 x 12 foot collision body, 32-pixel ground grid. Earthy cream walls, forest roofs, muted ochre shop roofs and slate work roofs; two-pixel outlines, consistent upper-left light, lower-right shadow. Building artwork and invisible rectangular footprints are separate. Actors sort by foot Y, building artwork by its front edge. Labels remain above scenery. These are first-pass modular assets, not imported reference artwork.

## Acceptance criteria

1. Keyboard, touch controls and pointer movement operate without React frame updates.
2. Diagonal velocity has the same magnitude as cardinal velocity; player feet collide with building footprints and city boundaries.
3. Camera follows and resizes with the host; zoom is bounded.
4. Interaction is available only within 65 scene pixels; E/touch opens an actual route or local NPC dialogue.
5. Movement commits through the revision-checked RPC; a rejected checkpoint restores authoritative state. No local currency/XP reward writes.
6. Home remains navigable; map returns to the saved exterior checkpoint.
7. Work, inventory and upgrade routes retain their existing trusted server operations.
8. Hidden/offline tabs stop movement; scene cleanup destroys listeners/canvas.
9. Public website and game build independently; actual domain deployment and live authentication require provider configuration.

## Independent deployment

Public website: `npm.cmd run dev:public` on port 3010; `npm.cmd run build:public` produces `dist-public`. Configure `VITE_GAME_URL` to the game origin. A separate Vercel project can use the repository root, this build command and `dist-public` output; framework preset Other.

Game: `npm.cmd run build` retains the local Node output and `npm.cmd run preview`. For a separate Vercel game project, set `NITRO_PRESET=vercel`, use `npm run build` and Nitro's `.vercel/output` build output. Configure public Supabase build variables and private runtime secrets separately. Set Supabase site/redirect URLs to the game domain, not the public website domain.

Live projects, domains, provider redirect settings and migrations are not created by local builds. Validate the production authentication and transaction loop against staging before release.

## Local verification

`npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run build`, and `npm.cmd run build:public` check the application and independent website. The Vercel preset also builds successfully to `.vercel/output` locally.

Run `node scripts/neighborhood-browser-smoke.mjs` for a real headless Chrome check of movement, diagonal speed, collision, stop checkpoints, NPC proximity, touch input and pause. It uses an isolated local harness, leaves a screenshot in `.smoke/neighborhood.png`, and stops its own server. It does not sign into Supabase or grant rewards.

The test suite passed 156 tests across 40 files in separate runs: 38 files excluding routing/home, followed by those two files. The combined runner occasionally stalls at startup on this Windows setup. Full authenticated browser acceptance, mobile device performance and live migration verification remain staging tasks.

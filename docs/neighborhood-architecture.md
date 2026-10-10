# Playable neighborhood architecture

The uploaded architecture reference governs this incremental implementation. The first scene provides one reusable neighborhood, not a finished full city. Phaser 3 replaces React's per-frame city animation because Arcade Physics gives the world a single owner for movement, collision, camera and depth. React retains menus, accessible controls, nearby interaction prompts and server data. No multiplayer infrastructure is added.

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

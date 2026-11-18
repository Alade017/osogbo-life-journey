# Osun Life

Osun Life is an original browser-based life simulation set in fictionalized, game-inspired towns across Osun State, Nigeria. Create a character, move into town, find work, earn fictional naira, rent a home or market stall, build relationships, play mini-games, and live the life you choose. Other players share the same world in real time.

The game is inspired by Osogbo but is not an exact geographic simulation. Every place, character, brand and asset is original. No copyrighted characters, branding or proprietary assets are used.

## What's in the game

- **Character creation:** name, presentation, appearance, age, personality and starting occupation preference.
- **City:** an interactive map of districts, with a city dashboard and travel between locations.
- **Lifestyles:** hustle, career, school, party and social routes. Jobs, schooling, clinics and businesses sit alongside them.
- **Housing:** rent a home, one active rental at a time. Overdue rent has a grace period, then loan, job or repossession options.
- **Market:** earn, rent a stall, customise it, and see other players' stalls.
- **Party life:** clubs, drinks, dancing and hosted events across three event centres.
- **Mini-games:** Ludo (offline, 2–4 players against computers, with your colour choice) and Whot.
- **Economy and progress:** wallet, inventory, missions, daily tasks, login streaks, notifications and a player profile with core stats.
- **Messaging:** in-game chat with voice notes, quote replies, pinning and muting.

Important game state (money, progression, character data) is decided on the server. The client sends intents; server functions validate them.

## Tech stack

- **Frontend:** React, TypeScript, TanStack Start and Router, Vite, Tailwind CSS, Radix UI.
- **3D:** Three.js through React Three Fiber and drei.
- **Backend:** Supabase (Auth, PostgreSQL, Realtime, Storage, Edge Functions) with server-side RPCs and migrations in `supabase/`.
- **Multiplayer:** Colyseus rooms in `multiplayer/` (neighbourhood, party and Ludo rooms), backed by Redis for presence.
- **Hosting:** Vercel for the web app and scheduled jobs; the multiplayer server runs separately (for example on Railway).
- **Tests:** Vitest and Testing Library.

## Project layout

```
src/
  routes/          TanStack file routes (auth, character creation, game screens, API)
  components/      UI, map, 3D scenes and mini-games
  game/            Game logic: navigation, layouts, geometry and world models
  lib/             Shared client utilities, mini-game engines (e.g. Ludo) and services
  shared/          Code shared between client and server
  test/            Vitest suites
multiplayer/       Colyseus server and room definitions
supabase/          Migrations, config and edge functions
scripts/           Database, release and verification tooling
docs/              Design, architecture and implementation notes
public/            Static assets
```

## Getting started

Requirements: Node.js and npm (the repo pins `npm@11`). A Supabase project is needed for auth and data.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill in your values:

   ```bash
   cp .env.example .env
   ```

   Only `VITE_*` values reach the browser, and they must be publishable keys. Server secrets (service role key, database URL, cron secret) belong in your deployment secret manager, never in `VITE_*` variables.

3. Start the game:

   ```bash
   npm run dev
   ```

   The dev server runs on port 3000.

4. Start the multiplayer server, if you are working on live features:

   ```bash
   npm run multiplayer:dev
   ```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run preview` | Run the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript check with no emit |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm run db:check` | Check database migrations are in sync |
| `npm run db:apply` | Apply database migrations |
| `npm run verify:map:live` | Smoke-check the live map |

Before merging, run `npm run typecheck`, `npm test` and `npm run build`.

## Contributing

- Present the architecture and game-loop plan before building a new feature.
- Keep game-critical logic server-authoritative: add or change RPCs rather than trusting client state.
- Reuse the existing design tokens and components.
- Don't rewrite published Git history.
- Add or update tests with each change.

## Design

Osun Life has a distinctive miniature Nigerian city look: flat, colourful and playful, with 3D-style elements. The design direction lives in `docs/osogbo-life-art-bible.md`. Use original shapes, illustrations and UI components only.

## Audio licences

Licence records for game audio are kept in `docs/audio-license-records.md`.

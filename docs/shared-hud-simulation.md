# Shared HUD and personal simulation

The shared header separates identity, wallet, needs, location, personal simulation controls, and the Lagos wall clock. Needs tiles open existing food, home, and social routes. The mobile navigation includes a labeled phone launcher.

Personal needs, activities, queued actions, clock preferences, and simulation skills are persisted through `personal_simulation_command`. The server owns action definitions and effects; the browser never submits replacement stats, money, XP, duration, or rewards. Activity completion advances the personal clock by the configured duration, retaining the existing explicit Complete activity interaction. Simulation skill values remain separate from career skill rewards.

Heartbeats run every six seconds while the tab is visible and connected. Reopening uses `open`, which grants no elapsed progress. Gaps over fifteen seconds also grant no catch-up. A session lease and revision checks prevent two devices from advancing the same player concurrently. Activity receipts prevent duplicate completion effects. Passive offline energy regeneration is disabled; rest and other personal activities recover energy.

The shared city clock is the server's Africa/Lagos time. Weather, events, traffic, shop opening hours, and job shift eligibility use this clock and are unaffected by personal pause/speed. Existing authoritative wallet, XP, job reward, inventory, and travel transactions remain in their RPCs. Event joining requires the correct current district and an active event window, with one participation record per character/event/world day.

## Deployment

Apply after migration 0023. Set `DATABASE_URL` to the development database's migration connection, then run:

```powershell
node scripts/apply-shared-hud-migration.mjs
```

The command applies migration 0024 in one transaction, records it in the existing Drizzle ledger if present, and requests a Supabase schema reload. It refuses to overwrite existing simulation tables. Deploy the interface after the migration. Without these RPCs, the interface displays an unavailable state and blocks simulation controls.

## Verification

```powershell
npx.cmd vitest run src/test/shared-hud-database.test.ts --maxWorkers=1
npx.cmd vitest run src/test/game-hud.test.tsx src/test/simulation-service.test.ts src/test/life-simulation.test.ts src/test/world-simulation.test.ts --maxWorkers=1
npx.cmd tsc --noEmit
npm.cmd run build
```

The database acceptance suite runs all repository migrations in isolated PostgreSQL via PGlite. It checks active-only progress, duplicate protection, conflicts, event eligibility, and ownership. These checks do not establish that a live Supabase project has received the migration.

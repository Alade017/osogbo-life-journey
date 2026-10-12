# Railway multiplayer service

The Colyseus neighborhood server runs separately from the Vercel website. The server validates Supabase access tokens and reads each player's saved character and location using that player's token. Colyseus owns only live room membership and movement; durable game state remains in Supabase.

## Railway service setup

Create a Railway Redis service and one Colyseus service from this repository. For each Colyseus service, use the repository root and configure:

- Build command: `npm ci`
- Start command: `npm run multiplayer:start`
- Health check path: `/healthz`
- A generated public domain
- Variables listed below

Railway provides `PORT` and `RAILWAY_PUBLIC_DOMAIN`. The server binds to `0.0.0.0` when Railway supplies `PORT`, uses the generated domain as its Colyseus public address, and requires Redis configuration in Railway environments.

### Required variables on every Colyseus service

| Variable                      | Value                                                                                     |
| ----------------------------- | ----------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                | Supabase project URL                                                                      |
| `SUPABASE_PUBLISHABLE_KEY`    | Supabase publishable key; never use the service-role key                                  |
| `MULTIPLAYER_ALLOWED_ORIGINS` | Exact comma-separated website origins, such as `https://your-site.vercel.app`             |
| `REDIS_URL`                   | Private Railway Redis URL; use the same Redis service reference on every Colyseus service |

Do not set `MULTIPLAYER_PUBLIC_ADDRESS` unless overriding Railway's generated service domain. If set, use the service's hostname without `https://` or `wss://`.

## Multiple Colyseus services

Colyseus room sockets must connect to the specific server process that owns each room. Railway currently distributes traffic randomly and does not support sticky sessions, so do **not** increase a single Colyseus Railway service's replica count. Instead, create multiple Colyseus services from this repository, give each its own generated domain, keep one replica per service, and connect all services to the same Redis database. Redis Presence shares inter-process messages and Redis Driver shares room listings and matchmaking state.

Set `VITE_MULTIPLAYER_URL` in the website's build environment to a comma-separated list of secure WebSocket endpoints, for example:

```dotenv
VITE_MULTIPLAYER_URL=wss://osogbo-room-a.up.railway.app,wss://osogbo-room-b.up.railway.app
```

The browser tries the configured endpoints in randomized order and retries another endpoint if one cannot complete matchmaking. Colyseus returns the selected room's public address so its WebSocket connects directly to the service hosting that room. Redeploy the website after changing this variable.

## Local server

Install dependencies and run `npm run multiplayer:dev`. Without Railway's `PORT`, the server listens on `127.0.0.1:2567` and uses in-memory room coordination. For local shared-room testing, use one process. `REDIS_URL` enables Redis coordination locally when desired.

## Release verification

Run repository and read-only endpoint checks with Node 24:

```powershell
node scripts/release-readiness-check.mjs --site https://osogbo-life-journey.vercel.app --multiplayer wss://osogbo-life-journey-production.up.railway.app --origin https://osogbo-life-journey.vercel.app
```

Repeat `--multiplayer` for each additional service. With no arguments the script checks only the repository migration journal. It does not read `.env`, authenticate users, apply migrations or change hosted configuration. A failed network check can indicate local network restrictions; distinguish that from an HTTP failure. A successful check establishes delivery/health/origin behavior only.

1. Confirm `/healthz` returns HTTP 200 for each public service.
2. Check that production and any approved custom domains appear in `MULTIPLAYER_ALLOWED_ORIGINS`; do not add preview domains unless they are intentionally trusted.
3. Sign in with two independent test accounts from two browser sessions and enter the same location. Verify each player sees the other, movement updates, and disconnect cleanup works when the accounts select different Colyseus service endpoints.
4. Verify travel moves each player to the saved destination room and reconnect uses the current saved location.
5. Check Railway logs and resource use under expected concurrency. Railway health checks gate deployment activation but are not continuous uptime monitoring.

Hosted multiplayer, Supabase migration state, authenticated travel/save recovery, and desktop/mobile browser checks still require the configured staging environment and real browser sessions. Local builds do not prove those hosted behaviors.

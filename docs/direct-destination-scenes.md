# Direct destination scenes

Confirmed arrival is based on the character query's server-saved `current_location_id`. Before arrival, the destination page continues to own travel selection and confirmation. After arrival, authored venues mount as the destination world; a district without an authored interior opens `/neighborhood` automatically. Banks use their existing lobby route. The redundant district `Walk …` link and venue `Explore the space` badge are removed. Arrival never submits another travel payment.

The destination route opts into a full-viewport layout. Basic interiors, clinic, campus, mall/street and worship scenes have explicit viewport hooks. Existing embedded building panels retain their dimensions. Clinic and campus lose their document-card styling in world mode; clinic framing is closer and the full viewport is used. World controls and existing activities/services remain accessible in compact drawers with dock and safe-area spacing. Header positions track the actual weather/event strip through ResizeObserver rather than assuming its mobile height.

A neighborhood mounts its real location environment while the room connects. A connection failure leaves the environment visible with a connection notice, Retry and Map controls instead of hiding everything behind a loading screen. Room-owned players are not fabricated. Ground movement, interaction targets and zone selection remain disabled until the authoritative room connects. Existing server-side travel, collision, economy and service checks remain in place.

## Multiplayer deployment requirement

`VITE_MULTIPLAYER_URL` must be configured with a public `wss://` room server in production. Localhost remains a development-only default. A missing, insecure or malformed production endpoint now produces a configuration-specific error instead of connecting players to their own phones' localhost. Multiple configured servers retain failover order behavior. This code change cannot make a missing or unavailable deployed server reachable.

The repository documents a Railway service, but its current health and the Vercel deployment's environment setting were not verified in this workspace. No production environment variables were changed.

## Verification

Regression tests cover confirmed arrival, no second travel charge, district auto-entry, authored venue selection, visible worlds with failed room connections, disabled disconnected movement, existing venue controls, and development/production endpoint handling. Typecheck, build and scoped lint are also run. Real browser/WebGL rendering and touch verification remain outstanding because the available browser environments could not access local fixtures; no visual pass is claimed.

Validation results: full suite 364 files / 2,323 tests passed; final focused rerun 67 tests passed. Typecheck, production build, scoped ESLint and whitespace checks passed. No merge or deployment is included in this change.

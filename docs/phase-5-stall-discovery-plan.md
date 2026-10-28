# Phase 5.2 — discover player stalls

Status: approved and implemented locally. Validation and release boundaries are recorded in `phase-5-stall-discovery-implementation.md`.

## Verified source findings

- Both Market and Market Stalls in `PhoneLauncher.tsx` open `components/game/phone/PhoneMarketApp.tsx`. Its My Stall tab already manages the owner's persisted name, goods and open flag, shows passive income, and lists NPC stalls. It does not query or display other players' stalls.
- `player_stalls` already exists in `0060_phone_community_apps.sql`. Its authenticated SELECT policy exposes open stalls and the caller's own stall. Table-wide SELECT access includes `user_id`, so merely choosing public columns in a new client query would not prevent account-ID exposure through the Data API.
- The current owner reads in PhoneMarketApp and `/property` select only `id,name,goods,is_open` and filter by the caller's character. An owner-only SELECT policy can preserve these flows while public discovery uses a separate, restricted projection.
- The latest `save_player_stall` RPC derives both account and character on the server, requires a registered account, validates name/goods lengths, and settles existing income under locks before saving. Keep that implementation and signature. Existing income reads/claims stay owner-only.
- MapCanvas defines a stall marker type, but the stall table has no position or market-location field. This milestone does not need invented coordinates or a second stall ownership system.
- `CourseAndStallApps` has a local preview with separate tests. The active phone market uses PhoneMarketApp; preserve that preview rather than treating it as durable discovery.

The working tree was clean at audit start, at owner commit `6e2bf534`. These are local source findings; hosted migration state was not checked.

## Architecture and game loop

Add a **Player stalls** tab to the existing phone market. A player opens Market, chooses Player stalls, and browses cards with the owner's character display name, saved stall name as the short sign, and saved goods description. Visitors can browse and load another page; cards have no owner edit, open/close, claim, purchase, payment, or inventory action. Existing My Stall and City Shops remain available.

Use the existing stall name (2–64 characters) as the sign and goods field (2–200 characters) as the description. A second sign column or new editor would duplicate existing data. New presentation uses neutral fictional-market wording and existing design tokens. No claim of live player presence or a physical stall visit is introduced.

### Database boundary

Create one local forward migration after the phone-community baseline and passive-income migration:

1. Replace the permissive visitor SELECT policy with owner-only SELECT. Retain owner reads, server-derived saves, existing grants needed by owner queries, and service-role administration. Do not grant visitor writes or expose income tables.
2. Add a registered-account/character-gated, read-only `get_public_player_stalls` RPC using an empty search path and explicit function grants. Its security-definer query returns only open stalls belonging to other players, joined to the owning character for the display name.
3. Return only stall ID, owner display name, stall sign/name, and goods description. Exclude account IDs, character IDs, private profile fields, wallet data, exact location, and income. Server-side filtering applies before pagination.
4. Use deterministic stall-ID ordering and keyset pagination: 20 entries per page, hard maximum 50, optional validated stall-ID cursor, and a next cursor only when another eligible row exists. No total player count or unrestricted table dump is needed. Closed/deleted stalls disappear on the next refresh; already displayed data is labeled as the latest fetched listing rather than live presence.

The existing save and income functions remain authoritative and unchanged. Discovery reads must not settle income, write visit counters, or award anything. Do not edit historical migrations or apply hosted SQL.

### Client boundary

Add a typed service/parser and account-keyed paged query. Mount it only when the new tab is selected; reset pages on account change. Use existing polling/focus conventions with a 30-second refresh while visible/online, plus manual refresh. Invalidate the listing after a confirmed owner save so changes are reflected when browsing again.

Support loading, no open stalls, error with retry, more pages, and cached offline states. Keep owner management and NPC shops usable if discovery is unavailable or its migration is missing. Render player text as text, wrap long signs/goods, and target a 375px viewport. Avoid new packages and map subscriptions.

## Acceptance and validation

- Real SQL: open stalls from other owners are listed with the correct display name/sign; own and closed stalls are excluded; pagination has no duplicates; input/page limits apply; signed-out and anonymous accounts cannot call the RPC.
- Privacy/permissions: visitors cannot read raw rows, including account IDs, or mutate another stall. Owners can still read/save their own stall; callers cannot choose another owner through RPC input. Returned JSON keys are explicitly checked. Direct writes remain denied.
- Regression: after a valid owner save/open/close, listings refresh correctly. Discovery does not change wallet balances, income cursors/ledgers, or stall ownership. Re-run existing passive-income, market and property tests.
- Client/UI: parse failures, pagination, loading/empty/retry/offline states, account isolation, and visitor cards without owner actions. Exercise the actual phone market in an isolated 375px browser fixture, then distinguish this from hosted authenticated testing.
- TypeScript, scoped lint, game/public builds, diff check, focused tests, and the full suite. Report existing renderer/lint failures separately if reproduced.

Before release, verify migration prerequisites and exercise two authenticated owners plus an outsider against the target API/RLS. Hosted SQL, production writes, deployments, commits and pushes are outside this approval. Phase 5.3 invitations remain a separate milestone.

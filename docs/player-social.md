# Player social systems

Milestone 6 adds player-to-player discovery and communication while retaining the existing NPC relationship route.

## Ownership

- Colyseus owns connected neighborhood presence and transient positions. Phaser lets a player select another connected character only within interaction distance; React opens that character's public profile.
- React/TanStack owns player search, friend lists, request actions, chat panels, blocking, and reporting.
- Supabase/Postgres owns public profile lookup, friendship state, blocks, reports, and persistent messages. The characters table remains owner-readable only.
- Security-definer RPCs validate friend changes, message channels, limits, and report submissions. RLS controls reads and Realtime subscriptions. The browser cannot write social tables directly.

## Public data and privacy

Player name, appearance, and level are returned by bounded authenticated profile RPCs. Search requires at least two characters and returns at most 20 results. Search does not return email, exact location, or world coordinates.

Area messages are readable by a character whose saved current location matches the channel. Private conversations require an accepted friendship. Messages are persisted until the relevant character is deleted. Message text is limited to 500 characters and each character may submit at most 12 messages per minute.

Friend requests are available across the game, not restricted by district. Only one pending request can exist for a pair. A reciprocal request accepts the existing request. Sending is limited to 20 requests per hour. Private messages are limited to friends.

Blocking cancels pending requests and removes the friendship. It prevents future requests and private messages, hides the pair from each other's profile search, and filters the pair's messages. Unblocking does not restore the friendship. Reports are visible to their reporter; the moderation queue is reserved to service_role. Reports are limited to three per hour and can include the message being reported.

## Operations and boundaries

The repository has no moderator account model or moderation console. Reports are safely stored for authorized backend review, but an operator and review workflow must be assigned before reports can be actioned. Do not expose the service-role credential to the browser.

Realtime subscriptions rely on the Supabase supabase_realtime publication. The migration adds the social tables when the publication exists and the migration role has permission. Local PGlite tests validate database rules but do not prove the hosted Supabase publication or two-account delivery.

## Acceptance

- Search and public profile lookup expose only the approved character fields and hide either side of a blocked pair.
- Friend request create, duplicate, reciprocal accept, accept, reject, cancel, remove, and block paths are authorized and transaction-safe.
- Direct writes to social tables are denied to authenticated clients.
- Area chat is restricted to the saved current location; private chat requires an accepted friendship and both conversation participants.
- Message length, request idempotency, persistence, rate limits, blocking, and message-report ownership are checked against an isolated PostgreSQL-compatible database.
- Authenticated browser verification with two Supabase accounts and Realtime enabled remains required before describing hosted multiplayer chat as verified.

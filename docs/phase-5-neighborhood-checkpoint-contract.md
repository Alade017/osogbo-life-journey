# Phase 5: durable neighborhood checkpoint contract

Status: proposal only — no database migration or persistence behavior is implemented by this document.

## Why a separate contract is required

The neighborhood room's authoritative player coordinates are expressed in the existing world-coordinate adapter (X 0–14, Y 0–12), with a distinct origin for each playable location. The room converts those coordinates to scene coordinates for rendering and collision.

The existing `save_player_world_position` RPC is not a suitable multiplayer checkpoint API. It models a player-initiated city walk: it checks the global position revision, limits travel distance, charges energy, advances game time, and changes movement state. Calling it for routine neighborhood movement would charge and advance the game clock for an action already simulated by the authoritative room. It also stores the city/world position rather than a location-scoped neighborhood checkpoint.

The room currently restores from `characters.world_x/world_y` and falls back to the area's origin when that point is not a valid, occupiable checkpoint. The live Colyseus position is transient; there is no dedicated durable location-scoped checkpoint write in the room lifecycle.

## Proposed storage boundary

Add a dedicated `character_neighborhood_checkpoints` record, keyed by `(character_id, location_id)`, rather than overloading `characters.world_x/world_y`.

Minimum fields:
- `character_id`: FK to the owning character, not a client-supplied arbitrary identity.
- `location_id`: FK to the playable location.
- `world_x`, `world_y`: authoritative neighborhood world coordinates in the same 0–14 / 0–12 coordinate space used by `NetworkPlayer`, never projected scene coordinates.
- `revision`: monotonically increasing per character/location checkpoint revision.
- `updated_at`: server timestamp.

The table must have RLS disabled for direct client access (or equivalent deny-all policies), and no grants to `anon` or `authenticated`. Browser clients must not write checkpoints.

## Proposed server-only write contract

A new server-only database function or authenticated multiplayer-server endpoint should:
1. Resolve the character from a verified bearer/session identity; never trust a client-supplied character ID.
2. Verify the character is still assigned to the supplied active `location_id`.
3. Accept only finite world coordinates within the established 0–14 / 0–12 coordinate bounds.
4. Verify the point is occupiable against the same location's authoritative area objects, obstacles and collision rules. Do not accept projected scene coordinates.
5. Require a monotonically increasing checkpoint revision or server-issued sequence so delayed writes from an old room cannot overwrite a newer checkpoint.
6. Be idempotent for a checkpoint operation/request ID.
7. Update only the location-scoped checkpoint record. It must not debit energy, advance game time, change the city-map position revision, or alter property/location ownership.
8. Authorize writes only from the trusted multiplayer server (service-role-only execution or a private server credential). Do not expose the service-role key to the browser.

## Proposed room lifecycle

- On authenticated join, load the checkpoint for the exact character/location pair and revalidate it with `canRestoreNeighborhoodCheckpoint`; otherwise use the existing area origin.
- Persist a throttled checkpoint from the server's authoritative `NetworkPlayer.x/y` state, not client coordinates. Coalesce writes and skip unchanged positions.
- On leave/disconnect, attempt a final checkpoint write for the departing room session.
- Bind every asynchronous write to the room instance, session, character and location. A completion from a superseded room must not update a newer room's checkpoint.
- Treat persistence failure as recoverable: keep the active room running, log a structured server-side error, and retry on the next eligible checkpoint. Never claim durability until the write is confirmed.

## Required acceptance coverage

- Character A in location X cannot read or write character B's checkpoint.
- A session in location X cannot write a checkpoint for location Y.
- An inactive or non-playable location is rejected.
- Invalid, non-finite, out-of-bounds and obstacle-overlapping coordinates are rejected.
- A stale room/session sequence cannot overwrite a newer checkpoint.
- Duplicate request IDs are idempotent.
- A successful checkpoint does not change energy, hunger, thirst, game time, `world_position_revision`, wallet, or location ownership.
- Rejoin restores the last confirmed checkpoint for the same location; switching locations never reuses another location's checkpoint.
- Leave and delayed persistence completion cannot overwrite the active room's state.
- Database integration tests verify grants, RLS and ownership checks.

## Scope and approval

This contract intentionally does not add a migration, table, RPC, service-role call, or client write. Database changes and server persistence require separate approval because they introduce a new durable gameplay contract. Until that approval and implementation exist, live neighborhood positions remain room-authoritative and a reconnect may fall back to the existing saved city/world checkpoint or area origin.

# House Migration Review — 2026-11-19

**Branch:** `fix/supabase-production-migration-reconciliation`  
**Scope:** bungalow/duplex bedroom corrections and house rearrangement RPC  
**Database:** hosted project `btpiqjhhxkvjwgwtznav`  
**Execution status:** read-only review; no SQL changes made

## 1. Bungalow and duplex bedroom corrections

Repository migrations:

- `20261118010000_bungalow_two_bedroom_gym.sql`: sets `house_types.bedrooms = 2` for `bungalow`.
- `20261118020000_duplex_upstairs_gym.sql`: sets `house_types.bedrooms = 3` for `duplex`.

The hosted database currently reports:

| House | Hosted bedrooms | Repository target |
|---|---:|---:|
| Bungalow | 3 | 2 |
| Duplex | 4 | 3 |

The changes update only the `house_types` catalogue rows; they do not directly update player-owned house rows, rent, deposits, inventory, or placements.

Read-only production counts found one ended bungalow lease and one ended duplex lease, with no active bungalow or duplex leases. The currently active leases are two shared-room leases and one single-room lease. This reduces immediate exposure to active tenants, but it does not establish that changing the catalogue is correct for all game rules. The product decision that a bungalow is two-bedroom and a duplex is three-bedroom should be confirmed against the current room blueprints and rental UI before deployment.

**Disposition:** SQL is simple and appears data-preserving, but hold for product/blueprint consistency review and staging validation.

## 2. House rearrangement migration

Files inspected:

- `supabase/migrations/20261118024000_house_rearrange.sql`
- `drizzle/migrations/0105_house_rearrange.sql`
- `src/lib/house-rearrange.server.ts`
- `src/game/house-arrangement.ts`
- `src/test/house-rearrange-api.test.ts`
- `src/test/house-free-placement-database.test.ts`

The hosted database does not currently contain `public.house_rearrange_owned_items(uuid,uuid,jsonb,jsonb)`.

### Positive properties

- The server handler authenticates the request and derives the player ID from the verified access token.
- It fetches a server-side house snapshot and calculates the layout server-side; it ignores client-supplied player and furniture data.
- The database function locks the owned active house and its placements.
- It compares the complete expected placement snapshot to detect stale edits.
- It rejects foreign placement IDs, invalid grid positions, invalid floors, invalid rotations, duplicate cells, and incomplete move sets.
- It retains placement row IDs and slot keys; it does not create or consume inventory items.
- Execution is revoked from `PUBLIC`, `anon`, and `authenticated`, and granted to `service_role`. The application calls the RPC through its server-side Supabase admin client.
- Existing tests cover authentication, server-derived state, stale snapshots, duplicate positions, ownership rejection, and inventory quantity preservation.

### Defect: legacy home-item projection is only partially synchronized

The function updates `house_placements.x`, `y`, `floor`, and `rotation_deg`, but the follow-up update to `home_items` only copies `x` and `y`:

```sql
update public.home_items i
set x=p.x, y=p.y, updated_at=now()
from public.house_placements p
where p.player_house_id=h.id
  and i.user_id=p_player_id
  and i.slot_id=p.slot
  and i.placed;
```

The hosted `home_items` table also has `floor` and `rotation_deg` columns. If this table remains a live projection consumed by any UI or gameplay path, those fields can become stale after rearrangement. The current database test checks placement identities/slots and inventory quantities, but does not assert that the legacy `home_items` projection remains synchronized.

**Required follow-up before deployment:**
1. Trace every read/write path for `home_items` and establish whether it is still a live projection or legacy data.
2. If it is live, synchronize `floor` and `rotation_deg` as well as `x` and `y`.
3. Confirm the join key is sufficiently scoped. The current update matches by `user_id` and `slot_id`; inspect whether a player can have multiple characters or overlapping slot identifiers before relying on that predicate.
4. Extend the database test to assert all projected placement fields, including floor and rotation.
5. Run the focused rearrangement and house database tests against the corrected migration in an isolated test database.

### Additional review notes

- The function is `SECURITY DEFINER` with `search_path = public`. Its execute grant is appropriately restricted to `service_role`, but a deployment review should inspect schema CREATE privileges and consider a hardened search path (e.g. trusted schemas only) while schema-qualifying all referenced objects.
- The function calls `_process_player_house_status` before validating the requested house. This is an existing stateful house-maintenance routine; verify its side effects and transaction behaviour in the deployment test.
- The RPC returns `get_house_state`, which itself invokes house-status processing. Confirm this double invocation is intentional and idempotent.
- The planner is server-side and considers room geometry, doorways, stairs, furniture collisions, and room reachability. Keep it authoritative; do not move layout planning to untrusted client input.

**Disposition:** Do not deploy the current rearrangement SQL until the legacy projection semantics and synchronization gap are resolved and the tests cover it.

## 3. Production safety

No migration was applied, no data was changed, and no migration ledger was repaired during this review.

Do not run `supabase db push` or `supabase migration repair` for these files yet. The shared production database has live player records, and the local Supabase stack is unavailable without Docker/Podman. Validate the corrected SQL in a separate staging database before seeking approval for production deployment.

## 4. Validation still required

- Confirm bungalow/duplex bedroom counts against room blueprints and rental UX.
- Resolve the `home_items` synchronization and ownership-scope questions.
- Add/adjust database assertions for floor and rotation.
- Run focused house tests, full typecheck, lint, and build.
- Verify the final function definition, grants, and RLS after staging deployment.

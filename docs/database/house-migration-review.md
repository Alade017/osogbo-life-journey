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

### Corrected finding: `home_items` is a legacy compatibility path, not the authoritative house layout

The initial concern that the rearrangement RPC necessarily leaves the live house scene stale was too broad. Tracing the current code and hosted database shows two distinct paths:

- The authoritative house scene is built from `get_house_state`'s `placements` array. The hosted function returns `house_placements` with `x`, `y`, `floor`, and `rotation_deg`; `homeSceneFromAuthoritativeState` also constructs its placed items from that authoritative `placements` array.
- The older `housing-api.server.ts` home endpoint still reads `home_items`, but its select list includes `x`, `y`, and `z` only—not `floor` or `rotation_deg`. The `0041_server_house_inventory.sql` migration explicitly describes the legacy table as being retained for older screens and installs an `AFTER INSERT OR UPDATE OR DELETE` trigger to mirror legacy writes into authoritative tables.

The trigger matters: `_sync_legacy_home_item()` is `SECURITY DEFINER` and writes to `house_placements`, `player_items`, and `player_outfit`. An update to `home_items` from the rearrangement RPC therefore fires this trigger. Its current implementation upserts the corresponding active-house placement using the legacy row's item and slot, and synchronizes x/y; it does not map floor or rotation.

A read-only production check found three active/overdue house rows:
- One house had 7 authoritative placements and 7 placed `home_items` rows, but none matched the placements by item ID or slot.
- One house had 7 authoritative placements and no placed `home_items` rows.
- One house had no placements.

This means the current production data does not demonstrate a functioning one-to-one `home_items` mirror for those active houses. It also means the current rearrangement query's `user_id + slot_id` predicate matched no corresponding rows in the sampled active-house data. Do not interpret this as proof that players' authoritative placements are missing: `get_house_state` reads from `house_placements`, and those rows remain present.

### Concrete issue: the legacy update predicate was insufficiently scoped

The original update matched legacy rows using only `i.user_id=p_player_id` and `i.slot_id=p.slot`. The hosted `home_items` table has a unique constraint on `(character_id,item_id)`, but no unique constraint on `(user_id,slot_id)`. A slot identifier alone is not a safe identity for a legacy item. The legacy mirror trigger also upserts `house_placements` on `(player_house_id,slot)`; updating an unrelated legacy row with the same slot can therefore replace the authoritative placement's item ID.

**Implemented correction on this branch:** both copies of the rearrangement migration now constrain the legacy update by:
- the player's unique `characters.user_id` row and matching `i.character_id`;
- `i.user_id = p_player_id`;
- `i.item_id = p.item_id`;
- `i.slot_id = p.slot`;
- `i.placed = true`.

This is deliberately a no-op when the matching legacy row does not exist. It does not create compatibility rows or touch another item that happens to reuse the same slot identifier.

The update continues to mirror only x/y. The current legacy home API selects x/y/z but not floor/rotation, while the authoritative scene gets floor and rotation from `house_placements`. The hosted legacy columns `floor` and `rotation_deg` are not treated as current-scene state and are not updated by this compatibility write.

### Regression coverage added

The rearrangement database test now:
- creates a deliberately inconsistent, placed legacy decoy with the same slot ID but a different item ID (with the mirror trigger temporarily disabled only while seeding that invalid fixture);
- removes the legacy row for another authoritative placement, when one exists;
- runs rearrangement with the real legacy trigger enabled;
- asserts authoritative placement IDs, item IDs, slots, x/y, floor, and rotation remain correct;
- asserts only the exact matching legacy row receives the new x/y;
- asserts the same-slot/different-item decoy remains untouched;
- asserts a missing legacy row is not recreated or used to move an unrelated item;
- retains the inventory-quantity, stale-snapshot, duplicate-cell, and foreign-house checks.

**Test harness correction:** the PGlite test now explicitly loads `supabase/migrations/20261118024000_house_rearrange.sql` after its prerequisite migrations, and projects the expected snapshot into the exact six fields consumed by the RPC (`id`, `slot`, `x`, `y`, `floor`, `rotation_deg`). This prevents a false `LAYOUT_CHANGED` caused by passing the test query's extra `item_id` field.

**Remaining validation:** run the focused PGlite/Vitest test and the broader house database suite. The test harness and migration are committed to the draft reconciliation PR, but no test run has yet been performed in this environment.

### Additional review notes

- The function is `SECURITY DEFINER` with `search_path = public`. Its execute grant is appropriately restricted to `service_role`, but a deployment review should inspect schema CREATE privileges and consider a hardened search path (e.g. trusted schemas only) while schema-qualifying all referenced objects.
- The function calls `_process_player_house_status` before validating the requested house. This is an existing stateful house-maintenance routine; verify its side effects and transaction behaviour in the deployment test.
- The RPC returns `get_house_state`, which itself invokes house-status processing. Confirm this double invocation is intentional and idempotent.
- The planner is server-side and considers room geometry, doorways, stairs, furniture collisions, and room reachability. Keep it authoritative; do not move layout planning to untrusted client input.

**Disposition:** The scoped legacy mirror fix and regression coverage are now present in the draft PR. Do not deploy until the tests pass in an isolated database and the remaining function security/transaction review is complete.

## 3. Production safety

No migration was applied, no data was changed, and no migration ledger was repaired during this review.

Do not run `supabase db push` or `supabase migration repair` for these files yet. The shared production database has live player records, and the local Supabase stack is unavailable without Docker/Podman. Validate the corrected SQL in a separate staging database before seeking approval for production deployment.

## 4. Validation still required

- Run the focused `house-free-placement-database.test.ts` PGlite/Vitest test and the broader house database suite.
- Run full typecheck, lint, and production build.
- Review the `SECURITY DEFINER` search path, schema CREATE privileges, and the idempotency/side effects of the two house-status processing calls.
- Validate the corrected migration in an isolated staging database before production approval.
- Separately confirm bungalow/duplex bedroom counts against room blueprints and rental UX; that catalogue mismatch is outside this rearrangement fix.

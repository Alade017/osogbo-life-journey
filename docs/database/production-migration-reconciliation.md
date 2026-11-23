# Production Supabase Migration Reconciliation

**Audit date:** 2026-11-19  
**Repository:** `Alade017/osogbo-life-journey`  
**Target database:** hosted Supabase project `btpiqjhhxkvjwgwtznav`  
**Safety status:** documentation only; no production SQL executed

## Purpose

Record the observed differences between the repository migration directory and the hosted Supabase migration ledger, and define a safe reconciliation process. The hosted database is shared by local development and deployed environments; there is no separate local database in the workflow described during this audit.

## Observed baseline

The user-provided output from `supabase migration list --linked` showed:

- 68 migration versions present in both local and remote ledgers.
- 26 remote-only migration versions.
- 12 local-only migration versions.
- 106 distinct version entries in the union.

These are **ledger-version counts**, not counts of missing features. Different timestamps, renamed files, equivalent SQL, and later hosted changes can produce unmatched entries without representing missing functionality.

The local `supabase status` command could not inspect a local stack because Docker/Podman was unavailable. The linked migration-list command did connect to the hosted project successfully. This local container limitation does not indicate a hosted database outage.

A previous read-only hosted schema audit reported 163 public tables, 132 populated tables, 31 empty tables, and approximately 9,132 rows across the counted tables. These are point-in-time audit figures, not a local-versus-remote row comparison.

## Migration ledger discrepancies

### Local-only versions

The following local versions were observed with no exact matching remote version:

- `20261113120000`
- `20261113130000`
- `20261115090000`
- `20261117060000`
- `20261117190000`
- `20261118010000`
- `20261118020000`
- `20261118024000` (file renamed on 2026-11-22 to `20261122052147_house_rearrange.sql`, the version the hosted ledger recorded when it was applied)
- `20261118123000`
- `20261118133000`
- `20261118193000`
- `20261119064500`

Do not infer that every one is unapplied. The audit found likely equivalents or superseding hosted implementations for neighbourhood bounds, secure checkpoints, shared-room accessories, and the Okada ride-request fix. These require SQL-definition comparison before any ledger repair or execution.

The Ludo migration `20261115090000_ludo_matches.sql` explicitly identifies itself as not applied and attempts to create `public.profiles`, which already exists in production. It must be redesigned to integrate with the existing profile schema and policies before deployment.

### Remote-only versions

The following remote versions were observed without an exact local version:

- `20261110182944` home_item_placement_fields
- `20261111024351` shared_home_tenancy_tables
- `20261111024630` shared_home_join_leave
- `20261111025428` shared_home_placements
- `20261111025959` shared_home_tenant_space
- `20261111031453` shared_home_state
- `20261111034654` catalogue_zoning_rug
- `20261111034702` catalogue_zoning_rug_decor
- `20261111041924` catalogue_zoning_rug_variants
- `20261111043531` house_blocked_zones
- `20261111051415` deactivate_duplicate_listings
- `20261111053408` economy_fixes_shared_room_and_deposits
- `20261111105645` whot_engine_functions_server_only
- `20261111202008` ludo_stake_tables
- `20261114070425` open_locked_map_landmarks
- `20261117052057` shared_room_accessories
- `20261117053336` expand_neighborhood_world_bounds_repo
- `20261117053341` secure_neighborhood_checkpoints_repo
- `20261117055447` open_town_map_landmarks
- `20261117061433` ogo_oluwa_location
- `20261117062455` oja_oba_mosque_landmark
- `20261119054601` okada_ride_request_fix
- `20261119114738` osun_mall_presence
- `20261119114845` osun_mall_presence_revoke_anon
- `20261119125025` worship_prayer_bonus
- `20261119153134` worship_prayer_schedule

The hosted-only ledger entries must be preserved. Recover original SQL from version control, backups, or migration artifacts where possible. If source SQL cannot be recovered, document the observed live schema/function state and create a forward-only baseline strategy; do not fabricate historical migration files and mark them applied without evidence.

## Read-only schema findings requiring forward migrations or code review

The previous hosted probes reported:

| Area | Observed production state | Required follow-up |
|---|---|---|
| House bedroom configuration | Bungalow has 3 bedrooms; duplex has 4 | Compare current game design and migration effects before changing data |
| House rearrangement | `house_rearrange_owned_items(uuid,uuid,jsonb,jsonb)` absent | Review function dependencies, ownership checks, validation, and atomicity |
| Barber/POS services | `neighborhood_personal_services` absent | Inspect complete migration, RLS, grants, and receipt dependencies |
| Adire crafting | `adire_recipes` absent; related catalogue/shop data absent | Inspect full schema, material consumption, job lifecycle, and catalogue seeds |
| Mini-game recovery | `_mini_game_sweep_mine(uuid)` absent; `mini_game_tables` exists | Review recovery/settlement idempotency and concurrency |
| Wearable outfits | Expected catalogue/shop entries absent | Confirm catalogue schema and seed idempotency |
| Ludo matches | `matches` and `ludo_matches` absent; `profiles` exists | Rewrite migration around existing profile schema and current RLS |

These findings are scoped to the probes performed; they are not a complete audit of every table, function, trigger, policy, grant, or application dependency.

## Known hosted implementations that must not be downgraded

The previous inspection found that:

- The hosted checkpoint function is server-only; do not restore broader client execution grants from an older migration.
- The hosted `request_okada_ride` function includes street-presence validation associated with Osun Mall. Do not replace it with an older repository definition that lacks this validation.
- Shared-room accessory catalogue rows already exist. Do not seed duplicates.
- Neighbourhood bounds and secure checkpoint behaviour appear to have hosted equivalents under different migration versions. Compare exact definitions before considering ledger reconciliation.

## Required workflow

1. Freeze production migration execution while this reconciliation is in progress.
2. Fetch the exact `main` versions of all relevant migration files and compare their SQL with the live schema, function definitions, policies, triggers, and grants.
3. Recover the original SQL for remote-only versions. Preserve their order and original timestamps as historical evidence; do not invent SQL.
4. Classify each local-only migration as: genuinely unapplied, already represented by a different remote migration, superseded by a newer hosted implementation, or unsafe/incompatible.
5. Create **new forward-only migrations** for genuine missing functionality. Do not edit already-applied historical migrations.
6. For every forward migration, review:
   - dependencies and foreign keys;
   - RLS policies and explicit grants/revokes;
   - server-authoritative ownership and authorization;
   - idempotency and concurrency;
   - transaction boundaries and rollback/recovery;
   - existing production rows and uniqueness constraints;
   - compatibility with the current application code.
7. Validate on a separate staging database before production. The staging project previously appeared inactive; verify its state and schema before relying on it.
8. Back up production and obtain explicit approval before applying any production migration.
9. After deployment, verify schema, function definitions, permissions, seeded catalogue rows, and application flows with read-only checks.

## Explicit prohibitions

Until the reconciliation is reviewed and staging validation is complete:

- Do not run `supabase db push` against production.
- Do not run `supabase db reset`.
- Do not use `supabase migration repair` to force ledger alignment.
- Do not reapply equivalent migrations under new timestamps.
- Do not replace newer hosted functions with older repository SQL.
- Do not delete, truncate, reseed, or rewrite player-owned data.
- Do not claim local records are missing: the application and production share the same hosted database, and no separate local dataset was identified.

## Completion criteria

Reconciliation is complete only when every unmatched ledger version has a documented disposition, every required live feature is represented by reviewed forward migrations, the Ludo schema is compatible with existing production profiles, staging validation passes, and production changes are separately approved and verified.

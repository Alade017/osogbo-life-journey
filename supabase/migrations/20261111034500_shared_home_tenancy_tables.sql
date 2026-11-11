-- Shared room tenancy: one row per shared room, one row per tenant bed. Approved 2026-11-11.

-- One physical shared room. Its capacity is the number of beds it has.
create table if not exists public.shared_home_units (
  id uuid primary key default gen_random_uuid(),
  game_property_id uuid not null references public.game_properties(id) on delete restrict,
  label text not null,
  capacity smallint not null check (capacity between 1 and 4),
  created_at timestamptz not null default now()
);

-- A tenant's occupancy of one bed. Ending it sets ended_at and keeps the history.
create table if not exists public.shared_home_occupancies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.shared_home_units(id) on delete restrict,
  character_id uuid not null references public.characters(id) on delete cascade,
  bed_slot smallint not null check (bed_slot >= 1),
  moved_in_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Two tenants can never hold the same bed in the same unit.
create unique index if not exists shared_home_one_tenant_per_bed
  on public.shared_home_occupancies (unit_id, bed_slot) where ended_at is null;

-- A character occupies at most one shared room at a time.
create unique index if not exists shared_home_one_unit_per_character
  on public.shared_home_occupancies (character_id) where ended_at is null;

-- Server-only access, like the other housing tables: RLS on, no client policies.
alter table public.shared_home_units enable row level security;
alter table public.shared_home_occupancies enable row level security;

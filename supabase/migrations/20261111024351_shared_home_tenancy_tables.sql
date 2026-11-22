create table if not exists public.shared_home_units (
  id uuid primary key default gen_random_uuid(),
  game_property_id uuid not null references public.game_properties(id) on delete restrict,
  label text not null,
  capacity smallint not null check (capacity between 1 and 4),
  created_at timestamptz not null default now()
);

create table if not exists public.shared_home_occupancies (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.shared_home_units(id) on delete restrict,
  character_id uuid not null references public.characters(id) on delete cascade,
  bed_slot smallint not null check (bed_slot >= 1),
  moved_in_at timestamptz not null default now(),
  ended_at timestamptz
);

create unique index if not exists shared_home_one_tenant_per_bed
  on public.shared_home_occupancies (unit_id, bed_slot) where ended_at is null;

create unique index if not exists shared_home_one_unit_per_character
  on public.shared_home_occupancies (character_id) where ended_at is null;

alter table public.shared_home_units enable row level security;
alter table public.shared_home_occupancies enable row level security;

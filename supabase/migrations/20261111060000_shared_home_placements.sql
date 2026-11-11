-- Furniture the game places in a shared room. Tenants cannot move or remove these pieces.
-- A piece with bed_slot belongs to that bed's tenant space. Positions are room percentages.
create table if not exists public.shared_home_placements (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.shared_home_units(id) on delete restrict,
  item_id text not null references public.content_items(id) on delete restrict,
  slot text not null,
  bed_slot smallint check (bed_slot is null or bed_slot >= 1),
  x numeric not null check (x between 0 and 100),
  y numeric not null check (y between 0 and 100),
  rotation_deg numeric not null default 0 check (rotation_deg >= 0 and rotation_deg < 360),
  placed_at timestamptz not null default now(),
  unique (unit_id, slot)
);

alter table public.shared_home_placements enable row level security;

-- Default layout for "Shared room 1", from the blueprint's room layout.
insert into public.shared_home_placements (unit_id, item_id, slot, bed_slot, x, y, rotation_deg)
select u.id, v.item_id, v.slot, v.bed_slot, v.x, v.y, v.rotation_deg
from public.shared_home_units u
cross join (values
  ('starter-bed',   'bed-1',       1::smallint, 24::numeric, 30::numeric, 0::numeric),
  ('starter-bed',   'bed-2',       2::smallint, 76::numeric, 30::numeric, 0::numeric),
  ('starter-seat',  'seat-1',      1::smallint, 26::numeric, 48::numeric, 0::numeric),
  ('starter-seat',  'seat-2',      2::smallint, 74::numeric, 48::numeric, 0::numeric),
  ('starter-light', 'light',       null::smallint, 50::numeric, 22::numeric, 0::numeric),
  ('television',    'television',  null::smallint, 36::numeric, 84::numeric, 0::numeric),
  ('stove',         'stove',       null::smallint, 92::numeric, 62::numeric, 90::numeric)
) as v(item_id, slot, bed_slot, x, y, rotation_deg)
where u.label = 'Shared room 1'
on conflict (unit_id, slot) do nothing;

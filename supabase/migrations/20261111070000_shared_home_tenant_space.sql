-- Each shared-room tenant places furniture only inside their own bed zone, and not on top of the
-- game's shared pieces. The check is a trigger on house_placements, so every path that writes a
-- tenant's furniture is covered. Zones are room percentages, seeded as data.
create table if not exists public.shared_home_bed_zones (
  unit_id uuid not null references public.shared_home_units(id) on delete cascade,
  bed_slot smallint not null check (bed_slot >= 1),
  x_min numeric not null check (x_min >= 0),
  x_max numeric not null check (x_max <= 100),
  y_min numeric not null check (y_min >= 0),
  y_max numeric not null check (y_max <= 100),
  primary key (unit_id, bed_slot),
  check (x_min < x_max and y_min < y_max)
);

alter table public.shared_home_bed_zones enable row level security;

insert into public.shared_home_bed_zones (unit_id, bed_slot, x_min, x_max, y_min, y_max)
select u.id, z.bed_slot, z.x_min, z.x_max, 0, 100
from public.shared_home_units u
cross join (values
  (1::smallint, 0::numeric, 50::numeric),
  (2::smallint, 50::numeric, 100::numeric)
) as z(bed_slot, x_min, x_max)
where u.label = 'Shared room 1'
on conflict (unit_id, bed_slot) do nothing;

create or replace function public._shared_tenant_space_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  occ public.shared_home_occupancies%rowtype;
  zone public.shared_home_bed_zones%rowtype;
begin
  select o.* into occ
  from public.player_houses ph
  join public.player_properties pp on pp.id = ph.player_property_id
  join public.shared_home_occupancies o on o.character_id = pp.character_id and o.ended_at is null
  where ph.id = new.player_house_id;
  -- Not a shared-room tenant: nothing to check.
  if not found then return new; end if;

  select z.* into zone from public.shared_home_bed_zones z
    where z.unit_id = occ.unit_id and z.bed_slot = occ.bed_slot;
  if not found or new.x < zone.x_min or new.x > zone.x_max or new.y < zone.y_min or new.y > zone.y_max then
    raise exception 'OUTSIDE_TENANT_SPACE';
  end if;

  -- Keep clear of the game's shared pieces: no closer than 8 percent of the room.
  if exists (
    select 1 from public.shared_home_placements sp
    where sp.unit_id = occ.unit_id
      and sqrt(power(sp.x - new.x, 2) + power(sp.y - new.y, 2)) < 8
  ) then
    raise exception 'SPACE_TAKEN';
  end if;
  return new;
end $$;

revoke all on function public._shared_tenant_space_guard() from public, anon, authenticated;

-- Named to run after the default-position trigger, so the position checked is the final one.
drop trigger if exists z_shared_tenant_space_guard on public.house_placements;
create trigger z_shared_tenant_space_guard
  before insert or update of x, y, player_house_id on public.house_placements
  for each row execute function public._shared_tenant_space_guard();

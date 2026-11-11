-- Areas of a home that furniture may not occupy, such as a duplex's staircase and its landings.
-- Zones are room percentages per floor, read by a trigger so every write path is checked.
create table if not exists public.house_blocked_zones (
  house_type_id text not null references public.house_types(id) on delete cascade,
  floor smallint not null check (floor in (0, 1)),
  reason text not null,
  x_min numeric not null check (x_min >= 0),
  x_max numeric not null check (x_max <= 100),
  y_min numeric not null check (y_min >= 0),
  y_max numeric not null check (y_max <= 100),
  primary key (house_type_id, floor, reason),
  check (x_min < x_max and y_min < y_max)
);

alter table public.house_blocked_zones enable row level security;

-- Duplex staircase: from the foot on the ground floor to the top upstairs, with its landings.
insert into public.house_blocked_zones (house_type_id, floor, reason, x_min, x_max, y_min, y_max)
values
  ('duplex', 0, 'stairs', 0, 8, 58, 96),
  ('duplex', 1, 'stairs', 0, 8, 58, 96)
on conflict (house_type_id, floor, reason) do nothing;

create or replace function public._house_blocked_zone_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_reason text;
begin
  select ph.house_type_id into v_type from public.player_houses ph where ph.id = new.player_house_id;
  if v_type is null then return new; end if;
  select z.reason into v_reason from public.house_blocked_zones z
    where z.house_type_id = v_type and z.floor = coalesce(new.floor, 0)
      and new.x between z.x_min and z.x_max and new.y between z.y_min and z.y_max
    limit 1;
  if found then raise exception 'BLOCKED_ZONE'; end if;
  return new;
end $$;

revoke all on function public._house_blocked_zone_guard() from public, anon, authenticated;

drop trigger if exists z_house_blocked_zone_guard on public.house_placements;
create trigger z_house_blocked_zone_guard
  before insert or update of x, y, floor, player_house_id on public.house_placements
  for each row execute function public._house_blocked_zone_guard();

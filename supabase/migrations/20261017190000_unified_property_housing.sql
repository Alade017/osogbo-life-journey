-- Unified property housing. game_properties is the listing catalogue and
-- player_properties is the only authoritative active-home record.

alter table public.game_properties
  add column if not exists house_type_id text references public.house_types(id),
  add column if not exists svg_x numeric,
  add column if not exists svg_y numeric,
  add constraint game_properties_svg_x_range check (svg_x is null or svg_x between 0 and 1200),
  add constraint game_properties_svg_y_range check (svg_y is null or svg_y between 0 and 800);

update public.game_properties
set house_type_id = case
  when slug = 'courtyard-starter-room' then 'shared-room'
  when property_type = 'room' then 'single-room'
  when property_type = 'apartment' then 'studio-flat'
  when property_type = 'house' then 'bungalow'
  else house_type_id
end
where house_type_id is null;

-- Keep a single selected active home when an older account has overlapping legacy rows.
with ranked as (
  select id, row_number() over (partition by character_id order by acquired_at desc, created_at desc) as row_number
  from public.player_properties where is_active
)
update public.player_properties property
set is_active = false, updated_at = now()
from ranked
where property.id = ranked.id and ranked.row_number > 1;

create unique index if not exists one_active_home_per_character
  on public.player_properties(character_id) where is_active;
create index if not exists game_properties_house_type_location_idx
  on public.game_properties(location_id, house_type_id) where is_active;

create table if not exists public.property_rent_cycles (
  id uuid primary key default gen_random_uuid(),
  player_property_id uuid not null references public.player_properties(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  period_start_at timestamptz not null,
  due_at timestamptz not null,
  grace_ends_at timestamptz not null,
  rescue_ends_at timestamptz not null,
  amount_minor bigint not null check (amount_minor > 0),
  status text not null check (status in ('current','due','grace','rescue','paid','repossessed')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(player_property_id, period_start_at)
);
create index if not exists property_rent_cycles_current_idx
  on public.property_rent_cycles(character_id, due_at) where status in ('current','due','grace','rescue');
alter table public.property_rent_cycles enable row level security;
revoke all on public.property_rent_cycles from anon, authenticated;
grant all on public.property_rent_cycles to service_role;
create policy property_rent_cycles_owner_read on public.property_rent_cycles
  for select to authenticated using (character_id = public._my_character_id());

create table if not exists public.property_rent_rescue_loans (
  id uuid primary key default gen_random_uuid(),
  rent_cycle_id uuid not null unique references public.property_rent_cycles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  principal_minor bigint not null check (principal_minor > 0),
  instalment_minor bigint not null check (instalment_minor > 0),
  instalments_total smallint not null default 4 check (instalments_total between 1 and 4),
  instalments_paid smallint not null default 0 check (instalments_paid between 0 and 4),
  status text not null default 'open' check (status in ('open','paid','cancelled')),
  created_at timestamptz not null default now()
);
create unique index if not exists one_open_rent_rescue_loan_per_character
  on public.property_rent_rescue_loans(character_id) where status = 'open';
alter table public.property_rent_rescue_loans enable row level security;
revoke all on public.property_rent_rescue_loans from anon, authenticated;
grant all on public.property_rent_rescue_loans to service_role;
create policy property_rent_loans_owner_read on public.property_rent_rescue_loans
  for select to authenticated using (character_id = public._my_character_id());

create or replace function public.get_property_map_pins(p_location_id uuid, p_limit integer default 12)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', property.id, 'name', property.name, 'locationId', property.location_id,
    'houseTypeId', property.house_type_id, 'weeklyRentMinor', property.rent_price,
    'depositMinor', coalesce(type.weekly_rent_minor * type.deposit_weeks, 0),
    'levelRequired', property.level_required, 'svgX', property.svg_x, 'svgY', property.svg_y,
    'state', case when mine.id is not null then 'yours'
                  when exists (select 1 from public.player_properties occupied where occupied.property_id=property.id and occupied.is_active) then 'taken'
                  else 'available' end
  ) order by property.level_required, property.rent_price, property.name), '[]'::jsonb)
  from (select * from public.game_properties where is_active and location_id = p_location_id order by level_required, rent_price, name limit greatest(1, least(coalesce(p_limit, 12), 24))) property
  left join public.house_types type on type.id = property.house_type_id
  left join public.player_properties mine on mine.property_id = property.id and mine.is_active and mine.character_id = public._my_character_id();
$$;
revoke all on function public.get_property_map_pins(uuid,integer) from public,anon,authenticated;
grant execute on function public.get_property_map_pins(uuid,integer) to service_role;

create or replace function public._advance_property_rent_cycles()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer := 0;
begin
  update public.property_rent_cycles set status='due' where status='current' and due_at <= now();
  get diagnostics changed = row_count;
  update public.property_rent_cycles set status='grace' where status='due' and due_at <= now();
  update public.property_rent_cycles set status='rescue' where status in ('due','grace') and grace_ends_at <= now();
  with repossessed as (
    update public.property_rent_cycles set status='repossessed'
    where status='rescue' and rescue_ends_at <= now()
    returning player_property_id, character_id
  ), ended as (
    update public.player_properties property set is_active=false, updated_at=now()
    from repossessed where property.id=repossessed.player_property_id returning property.character_id
  )
  update public.characters character set current_location_id = location.id, updated_at=now()
  from ended join public.locations location on location.slug='city-centre'
  where character.id=ended.character_id;
  return changed;
end;
$$;
revoke all on function public._advance_property_rent_cycles() from public,anon,authenticated;

create or replace function public.property_rent_status()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce((
    select jsonb_build_object('propertyId', property.id, 'name', listing.name, 'tenure', property.tenure,
      'cycleId', cycle.id, 'status', cycle.status, 'amountMinor', cycle.amount_minor,
      'dueAt', cycle.due_at, 'graceEndsAt', cycle.grace_ends_at, 'rescueEndsAt', cycle.rescue_ends_at)
    from public.player_properties property
    join public.game_properties listing on listing.id=property.property_id
    left join lateral (select * from public.property_rent_cycles where player_property_id=property.id and status in ('current','due','grace','rescue') order by due_at desc limit 1) cycle on true
    where property.character_id=public._my_character_id() and property.is_active
  ), '{}'::jsonb);
$$;
revoke all on function public.property_rent_status() from public,anon,authenticated;
grant execute on function public.property_rent_status() to service_role;

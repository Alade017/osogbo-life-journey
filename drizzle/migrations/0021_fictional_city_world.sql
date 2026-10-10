-- Milestone 12: add fictional city coordinates without discarding legacy saves.
alter table public.characters
  add column world_x double precision,
  add column world_y double precision,
  add column world_building_slug text,
  add column world_position_revision bigint not null default 0;

update public.characters c
set world_x = case l.slug
      when 'city-centre' then 7 when 'oja-oba' then 3 when 'oke-fia' then 10
      when 'old-garage' then 3 when 'student-district' then 5 when 'residential' then 9
      when 'business-district' then 8 when 'cultural-district' then 2
      when 'rural-outskirts' then 12 else 7 end,
    world_y = case l.slug
      when 'city-centre' then 6 when 'oja-oba' then 5 when 'oke-fia' then 3
      when 'old-garage' then 8 when 'student-district' then 9 when 'residential' then 9
      when 'business-district' then 6 when 'cultural-district' then 2
      when 'rural-outskirts' then 11 else 6 end,
    world_building_slug = null,
    movement_state = 'idle'
from public.locations l
where l.id = c.current_location_id;

update public.characters
set world_x = 7, world_y = 6, world_building_slug = null, movement_state = 'idle'
where world_x is null or world_y is null;

alter table public.characters
  alter column world_x set default 7,
  alter column world_x set not null,
  alter column world_y set default 6,
  alter column world_y set not null,
  add constraint characters_world_position_bounds_check
    check (world_x between 0 and 14 and world_y between 0 and 12),
  add constraint characters_world_building_slug_check
    check (world_building_slug is null or world_building_slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  add constraint characters_world_revision_check check (world_position_revision >= 0);

comment on column public.characters.world_x is 'Fictional OSOGBO LIFE city coordinate; unrelated to geography or viewport pixels.';
comment on column public.characters.world_y is 'Fictional OSOGBO LIFE city coordinate; unrelated to geography or viewport pixels.';
comment on column public.characters.world_building_slug is 'Stable selected/entered fictional building identifier.';

create table public.character_world_operations (
  character_id uuid not null references public.characters(id) on delete cascade,
  operation_id uuid not null,
  operation_type text not null check (operation_type in ('walk', 'travel')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (character_id, operation_id)
);
alter table public.character_world_operations enable row level security;
revoke all on public.character_world_operations from public, anon, authenticated;
grant all on public.character_world_operations to service_role;

create or replace function public.save_player_world_position(
  p_world_x double precision,
  p_world_y double precision,
  p_building_slug text,
  p_expected_revision bigint,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
  prior_result jsonb;
  revision bigint;
  distance numeric;
  energy_cost integer;
  walk_minutes integer;
  total_minutes integer;
  days_passed integer;
  minute_of_day integer;
  new_game_hour integer;
  new_game_minute integer;
  new_game_day integer;
  new_game_weekday integer;
  result jsonb;
begin
  if cid is null then raise exception 'Character not found'; end if;
  if p_request_id is null then raise exception 'A movement request ID is required'; end if;
  if p_world_x is null or p_world_y is null
    or p_world_x not between 0 and 14 or p_world_y not between 0 and 12 then
    raise exception 'Position is outside the fictional city';
  end if;
  if p_building_slug is not null and p_building_slug !~ '^[a-z0-9][a-z0-9_-]{0,79}$' then
    raise exception 'Invalid building identifier';
  end if;

  select * into player from public.characters
  where id = cid and user_id = auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;

  select o.result into prior_result from public.character_world_operations o
  where o.character_id = cid and o.operation_id = p_request_id;
  if found then return prior_result || jsonb_build_object('duplicate', true); end if;
  if player.world_position_revision <> p_expected_revision then
    raise exception 'Your city position changed. Refresh the map and try again.';
  end if;

  distance := sqrt(power(p_world_x - player.world_x, 2) + power(p_world_y - player.world_y, 2));
  if distance > 9 then raise exception 'That destination is too far to reach on foot'; end if;
  energy_cost := case when distance < 0.01 then 0 else greatest(1, ceil(distance * 0.65)::integer) end;
  walk_minutes := case when distance < 0.01 then 0 else greatest(1, ceil(distance * 2)::integer) end;
  if player.energy < energy_cost then
    raise exception 'Not enough energy to walk there (need %) ', energy_cost;
  end if;

  total_minutes := player.game_time_hour * 60 + player.game_time_minute + walk_minutes;
  days_passed := total_minutes / 1440;
  minute_of_day := mod(total_minutes, 1440);
  new_game_hour := minute_of_day / 60;
  new_game_minute := mod(minute_of_day, 60);
  new_game_day := player.game_day + days_passed;
  new_game_weekday := mod(player.game_weekday + days_passed, 7);
  revision := player.world_position_revision + 1;

  update public.characters set
    world_x = p_world_x,
    world_y = p_world_y,
    world_building_slug = p_building_slug,
    world_position_revision = revision,
    movement_state = 'idle',
    energy = energy - energy_cost,
    hunger = least(100, hunger + ceil(walk_minutes::numeric / 35)::integer),
    thirst = least(100, thirst + ceil(walk_minutes::numeric / 25)::integer),
    game_time_hour = new_game_hour,
    game_time_minute = new_game_minute,
    game_day = new_game_day,
    game_weekday = new_game_weekday
  where id = cid;

  result := jsonb_build_object(
    'world_x', p_world_x, 'world_y', p_world_y, 'building_slug', p_building_slug,
    'revision', revision, 'energy_spent', energy_cost, 'walk_minutes', walk_minutes,
    'game_time', jsonb_build_object(
      'minute', new_game_minute, 'hour', new_game_hour, 'day', new_game_day,
      'weekday', new_game_weekday
    )
  );
  insert into public.character_world_operations(character_id, operation_id, operation_type, result)
    values (cid, p_request_id, 'walk', result);
  return result;
end $$;

create or replace function public.travel_to_city_location(
  p_location_id uuid,
  p_mode text,
  p_world_x double precision,
  p_world_y double precision,
  p_expected_revision bigint,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
  destination public.locations%rowtype;
  prior_result jsonb;
  result jsonb;
  expected_x double precision;
  expected_y double precision;
begin
  if cid is null then raise exception 'Character not found'; end if;
  if p_request_id is null then raise exception 'A travel request ID is required'; end if;
  select * into player from public.characters
  where id = cid and user_id = auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;

  select o.result into prior_result from public.character_world_operations o
  where o.character_id = cid and o.operation_id = p_request_id;
  if found then return prior_result || jsonb_build_object('duplicate', true); end if;
  if player.world_position_revision <> p_expected_revision then
    raise exception 'Your city position changed. Refresh the map and try again.';
  end if;

  select * into destination from public.locations where id = p_location_id and is_active;
  if not found then raise exception 'Destination is not available'; end if;
  expected_x := case destination.slug
    when 'city-centre' then 7 when 'oja-oba' then 3 when 'oke-fia' then 10
    when 'old-garage' then 3 when 'student-district' then 5 when 'residential' then 9
    when 'business-district' then 8 when 'cultural-district' then 2
    when 'rural-outskirts' then 12 else 7 end;
  expected_y := case destination.slug
    when 'city-centre' then 6 when 'oja-oba' then 5 when 'oke-fia' then 3
    when 'old-garage' then 8 when 'student-district' then 9 when 'residential' then 9
    when 'business-district' then 6 when 'cultural-district' then 2
    when 'rural-outskirts' then 11 else 6 end;
  if p_world_x is distinct from expected_x or p_world_y is distinct from expected_y then
    raise exception 'Invalid fictional destination position';
  end if;

  result := public.travel_to_location(p_location_id, p_mode);
  update public.characters set
    world_x = p_world_x,
    world_y = p_world_y,
    world_building_slug = null,
    world_position_revision = world_position_revision + 1,
    movement_state = 'idle'
  where id = cid;
  result := result || jsonb_build_object(
    'world_x', p_world_x, 'world_y', p_world_y,
    'revision', player.world_position_revision + 1
  );
  insert into public.character_world_operations(character_id, operation_id, operation_type, result)
    values (cid, p_request_id, 'travel', result);
  return result;
end $$;

revoke all on function public.save_player_world_position(double precision,double precision,text,bigint,uuid) from public, anon;
grant execute on function public.save_player_world_position(double precision,double precision,text,bigint,uuid) to authenticated;
revoke all on function public.travel_to_city_location(uuid,text,double precision,double precision,bigint,uuid) from public, anon;
grant execute on function public.travel_to_city_location(uuid,text,double precision,double precision,bigint,uuid) to authenticated;

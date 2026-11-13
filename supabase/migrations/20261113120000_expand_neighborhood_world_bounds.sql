-- Expand the explorable neighbourhood and keep all persisted position APIs aligned.
-- Coordinates remain simulation units; this migration does not alter existing saved positions.
alter table public.characters
  drop constraint if exists characters_world_position_bounds_check;

alter table public.characters
  add constraint characters_world_position_bounds_check
  check (world_x between 0 and 24 and world_y between 0 and 20);

create or replace function public.save_player_world_position(
  p_world_x double precision,
  p_world_y double precision,
  p_building_slug text,
  p_expected_revision bigint,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = '' as $
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
    or p_world_x not between 0 and 24 or p_world_y not between 0 and 20 then
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

-- Remember where the character stands in the neighbourhood, so the next sign-in starts there.
-- Unlike save_player_world_position, this costs no energy or game time: it only records the spot.
-- Positions are not saved while the character is inside a house, since the house is the saved place.
create or replace function public.save_my_world_checkpoint(p_world_x double precision, p_world_y double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
begin
  if auth.uid() is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_world_x is null or p_world_y is null
    or p_world_x not between 0 and 24 or p_world_y not between 0 and 20 then
    raise exception 'Position is outside the fictional city';
  end if;
  select * into player from public.characters where id = cid and user_id = auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if player.inside_home_property_id is not null then
    return jsonb_build_object('saved', false);
  end if;
  update public.characters set world_x = p_world_x, world_y = p_world_y where id = cid;
  return jsonb_build_object('saved', true, 'world_x', p_world_x, 'world_y', p_world_y);
end $$;
revoke all on function public.save_my_world_checkpoint(double precision, double precision) from public, anon;
grant execute on function public.save_my_world_checkpoint(double precision, double precision) to authenticated;

notify pgrst, 'reload schema';

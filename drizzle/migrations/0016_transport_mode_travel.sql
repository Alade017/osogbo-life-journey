-- Server authoritative travel modes, estimates, affordability checks and arrival.
drop function if exists public.travel_to_location(uuid);

create function public.travel_to_location(p_location_id uuid, p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
  destination public.locations%rowtype;
  payment public.wallets%rowtype;
  first_visit boolean;
  trip_fare integer;
  trip_minutes integer;
  fare_factor numeric;
  duration_factor numeric;
  extra_minutes integer;
  configured_modes jsonb;
  total_game_minutes integer;
  days_passed integer;
  minute_of_day integer;
  new_game_hour integer;
  new_game_minute integer;
  new_game_day integer;
  new_game_weekday integer;
begin
  if cid is null then raise exception 'No character'; end if;
  if p_mode is null or p_mode not in ('walking','danfo','keke','okada','car') then
    raise exception 'Invalid travel mode';
  end if;
  select * into player from public.characters where id = cid and user_id = auth.uid() for update;
  select * into destination from public.locations where id = p_location_id and is_active;
  if not found then raise exception 'Destination is not available'; end if;
  if player.current_location_id = destination.id then raise exception 'You are already at this destination'; end if;
  if player.level < destination.level_required then raise exception 'You need level % to travel here', destination.level_required; end if;

  configured_modes := destination.metadata -> 'available_transport_modes';
  if jsonb_typeof(configured_modes) = 'array' and not (configured_modes ? p_mode) then
    raise exception '% is not available for this destination', p_mode;
  end if;

  case p_mode
    when 'walking' then fare_factor := 0; duration_factor := 2.4; extra_minutes := 0;
    when 'danfo' then fare_factor := 0.75; duration_factor := 1.25; extra_minutes := 5;
    when 'keke' then fare_factor := 1.15; duration_factor := 0.95; extra_minutes := 2;
    when 'okada' then fare_factor := 1.4; duration_factor := 0.8; extra_minutes := 1;
    when 'car' then fare_factor := 2.2; duration_factor := 0.7; extra_minutes := 2;
  end case;
  trip_fare := ceil(destination.travel_fare * fare_factor)::integer;
  trip_minutes := greatest(1, ceil(destination.travel_minutes * duration_factor)::integer + extra_minutes);

  if trip_fare > 0 then
    update public.wallets set balance = balance - trip_fare,
      total_expenses = total_expenses + trip_fare
      where character_id = cid and user_id = auth.uid() and balance >= trip_fare returning * into payment;
    if not found then raise exception 'Not enough in-game Naira for this fare (need %)', trip_fare; end if;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description, metadata)
      values (auth.uid(), payment.id, cid, trip_fare, 'expense', 'travel',
        'Travel to ' || destination.name || ' by ' || p_mode,
        jsonb_build_object('mode', p_mode, 'destination_id', destination.id));
    update public.characters set wealth = least(100, 10 + (payment.balance / 10000)::int) where id = cid;
  end if;

  total_game_minutes := player.game_time_hour * 60 + player.game_time_minute + trip_minutes;
  days_passed := total_game_minutes / 1440;
  minute_of_day := mod(total_game_minutes, 1440);
  new_game_hour := minute_of_day / 60;
  new_game_minute := mod(minute_of_day, 60);
  new_game_day := player.game_day + days_passed;
  new_game_weekday := mod(player.game_weekday + days_passed, 7);
  first_visit := not exists (select 1 from public.location_visits where character_id = cid and location_id = destination.id);

  update public.characters set current_location_id = destination.id,
    virtual_latitude = case when destination.latitude between 7.48 and 8.02
      and destination.longitude between 4.25 and 4.88 then destination.latitude else virtual_latitude end,
    virtual_longitude = case when destination.latitude between 7.48 and 8.02
      and destination.longitude between 4.25 and 4.88 then destination.longitude else virtual_longitude end,
    movement_state = 'idle', game_time_hour = new_game_hour,
    game_time_minute = new_game_minute, game_day = new_game_day, game_weekday = new_game_weekday,
    stress = least(100, stress + case when trip_minutes >= 10 then 2 else 1 end),
    hunger = least(100, hunger + ceil(trip_minutes::numeric / 20)::integer),
    thirst = least(100, thirst + ceil(trip_minutes::numeric / 15)::integer)
    where id = cid;
  insert into public.location_visits(user_id, character_id, location_id)
    values (auth.uid(), cid, destination.id)
    on conflict (character_id, location_id) do update
      set visit_count = location_visits.visit_count + 1, last_visited_at = now();
  if first_visit then
    perform public._grant_xp(cid, 10);
    perform public._notify(cid, 'Discovered ' || destination.name, '+10 XP for exploring a new district.', 'explore');
  end if;
  perform public._recalc_missions(cid);
  return jsonb_build_object('location', destination.name, 'mode', p_mode, 'fare', trip_fare,
    'travel_minutes', trip_minutes, 'first_visit', first_visit,
    'game_time', jsonb_build_object('minute', new_game_minute, 'hour', new_game_hour,
      'day', new_game_day, 'weekday', new_game_weekday));
end $$;

revoke all on function public.travel_to_location(uuid, text) from public, anon;
grant execute on function public.travel_to_location(uuid, text) to authenticated;

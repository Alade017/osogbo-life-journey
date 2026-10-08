alter table public.characters
  add column game_time_minute smallint not null default 0
    constraint characters_game_time_minute_check check (game_time_minute between 0 and 59),
  add column game_time_hour smallint not null default 8
    constraint characters_game_time_hour_check check (game_time_hour between 0 and 23),
  add column game_day integer not null default 1
    constraint characters_game_day_check check (game_day >= 1),
  add column game_weekday smallint not null default 0
    constraint characters_game_weekday_check check (game_weekday between 0 and 6);

create or replace function public.travel_to_location(p_location_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
  destination public.locations%rowtype;
  payment public.wallets%rowtype;
  first_visit boolean;
  total_game_minutes integer;
  days_passed integer;
  minute_of_day integer;
  new_game_hour integer;
  new_game_minute integer;
  new_game_day integer;
  new_game_weekday integer;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid for update;
  select * into destination from public.locations where id = p_location_id;
  if not found then raise exception 'Location not found'; end if;
  if player.current_location_id = destination.id then raise exception 'You are already in this district'; end if;

  if destination.travel_fare > 0 then
    update public.wallets set balance = balance - destination.travel_fare,
      total_expenses = total_expenses + destination.travel_fare
      where character_id = cid and balance >= destination.travel_fare returning * into payment;
    if not found then raise exception 'Not enough in-game Naira for this fare (need %)', destination.travel_fare; end if;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (auth.uid(), payment.id, cid, destination.travel_fare, 'expense', 'travel', 'Travel to ' || destination.name);
    update public.characters set wealth = least(100, 10 + (payment.balance / 10000)::int) where id = cid;
  end if;

  total_game_minutes := player.game_time_hour * 60 + player.game_time_minute + destination.travel_minutes;
  days_passed := total_game_minutes / 1440;
  minute_of_day := mod(total_game_minutes, 1440);
  new_game_hour := minute_of_day / 60;
  new_game_minute := mod(minute_of_day, 60);
  new_game_day := player.game_day + days_passed;
  new_game_weekday := mod(player.game_weekday + days_passed, 7);

  first_visit := not exists (select 1 from public.location_visits where character_id = cid and location_id = destination.id);
  update public.characters set
    current_location_id = destination.id,
    game_time_hour = new_game_hour,
    game_time_minute = new_game_minute,
    game_day = new_game_day,
    game_weekday = new_game_weekday,
    stress = least(100, stress + case when destination.travel_minutes >= 10 then 2 else 1 end)
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
  return jsonb_build_object(
    'location', destination.name,
    'fare', destination.travel_fare,
    'travel_minutes', destination.travel_minutes,
    'first_visit', first_visit,
    'game_time', jsonb_build_object(
      'minute', new_game_minute,
      'hour', new_game_hour,
      'day', new_game_day,
      'weekday', new_game_weekday
    )
  );
end $$;

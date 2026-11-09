-- Keep both travel systems bound to the same canonical character used by
-- the client and multiplayer rooms. Lock the profiles row to serialize a
-- concurrent character insert against a travel request.
create or replace function public.map_start_travel(
  p_user_id uuid,
  p_landmark_id text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  player public.characters%rowtype;
  destination public.map_landmarks%rowtype;
  route public.map_district_distances%rowtype;
  payment public.wallets%rowtype;
  prior public.map_travels%rowtype;
  active_trip public.map_travels%rowtype;
  completed_trip public.map_travels%rowtype;
  trip_fare bigint;
  trip_minutes integer;
  travel_id uuid := gen_random_uuid();
  started_at timestamptz := clock_timestamp();
  arrival timestamptz;
  response_payload jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then
    raise exception using message = 'INVALID_IDEMPOTENCY_KEY', errcode = '22023';
  end if;
  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception using message = 'NO_CHARACTER', errcode = 'P0002'; end if;
  select * into player from public.characters
    where user_id = p_user_id
    order by created_at desc, id desc
    limit 1 for update;
  if not found then raise exception using message = 'NO_CHARACTER', errcode = 'P0002'; end if;

  select * into prior from public.map_travels
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if prior.landmark_id <> p_landmark_id then
      raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = '23505';
    end if;
    update public.map_travels set status = 'completed'
      where id = prior.id and status = 'travelling' and arrival_at <= started_at;
    return prior.response;
  end if;

  select * into completed_trip from public.map_travels
    where character_id = player.id and status = 'travelling' and arrival_at <= started_at
    order by arrival_at desc limit 1;
  if found then
    update public.characters set current_location_id = landmark.location_id,
        map_district_id = landmark.district_id
      from public.map_landmarks landmark
      where public.characters.id = player.id and landmark.id = completed_trip.landmark_id;
    update public.map_travels set status = 'completed'
      where character_id = player.id and status = 'travelling' and arrival_at <= started_at;
  end if;
  select landmark.* into destination from public.map_landmarks landmark
    join public.locations location on location.id = landmark.location_id and location.is_active
    where landmark.id = p_landmark_id and landmark.is_available;
  if not found then raise exception using message = 'UNKNOWN_LANDMARK', errcode = 'P0002'; end if;
  if destination.min_age >= 18 and not player.is_adult then
    raise exception using message = 'AGE_RESTRICTED', errcode = '42501';
  end if;
  select * into active_trip from public.map_travels
    where character_id = player.id and status = 'travelling' and arrival_at > started_at
    order by departed_at desc limit 1;
  if found then raise exception using message = 'ALREADY_TRAVELLING', errcode = '55000'; end if;
  select * into route from public.map_district_distances
    where from_district_id = player.map_district_id and to_district_id = destination.district_id;
  if not found then raise exception using message = 'UNKNOWN_LANDMARK', errcode = 'P0002'; end if;

  trip_minutes := greatest(1, ceil(route.distance_m::numeric / 250)::integer);
  trip_fare := greatest(50, ceil(route.distance_m::numeric / 30)::bigint);
  select * into payment from public.wallets
    where character_id = player.id and user_id = p_user_id for update;
  if not found or payment.balance < trip_fare then
    raise exception using message = 'INSUFFICIENT_FUNDS', errcode = 'P0001';
  end if;
  arrival := started_at + make_interval(mins => trip_minutes);
  update public.wallets set balance = balance - trip_fare,
      total_expenses = total_expenses + trip_fare, updated_at = started_at
    where id = payment.id returning * into payment;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description, metadata)
    values (p_user_id, payment.id, player.id, trip_fare, 'expense', 'travel',
      'Travel to map landmark ' || p_landmark_id,
      jsonb_build_object('landmark_id', p_landmark_id, 'distance_m', route.distance_m,
        'travel_minutes', trip_minutes, 'idempotency_key', p_idempotency_key));
  update public.characters set current_location_id = destination.location_id,
      map_district_id = destination.district_id
    where id = player.id;
  response_payload := jsonb_build_object(
    'travel_id', travel_id, 'landmark_id', destination.id,
    'fare', trip_fare, 'distance_m', route.distance_m,
    'travel_minutes', trip_minutes, 'departed_at', started_at,
    'arrival_at', arrival, 'status', 'travelling'
  );
  insert into public.map_travels(
    id, user_id, character_id, idempotency_key, landmark_id, from_district_id,
    to_district_id, distance_m, fare, travel_minutes, departed_at, arrival_at, response
  ) values (
    travel_id, p_user_id, player.id, p_idempotency_key, destination.id, player.map_district_id,
    destination.district_id, route.distance_m, trip_fare, trip_minutes, started_at, arrival, response_payload
  );
  return response_payload;
end;
$$;

create or replace function public.start_osun_town_travel(
  p_user_id uuid,p_destination_id text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare player public.characters%rowtype; wallet public.wallets%rowtype;
  route public.osun_town_routes%rowtype; prior jsonb; result jsonb;
  trip_id uuid:=gen_random_uuid(); arrival timestamptz; completed_destination text;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  perform 1 from public.profiles where id=p_user_id for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  select response into prior from public.osun_town_travels
    where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then
    if prior->>'to_town_id' is distinct from p_destination_id then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return prior || jsonb_build_object('duplicate',true);
  end if;
  select * into player from public.characters where user_id=p_user_id
    order by created_at desc, id desc limit 1 for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  select to_town_id into completed_destination from public.osun_town_travels
    where character_id=player.id and status='travelling' and arrival_at<=clock_timestamp()
    order by arrival_at desc limit 1 for update;
  if found then
    update public.osun_town_travels set status='completed'
      where character_id=player.id and status='travelling' and arrival_at<=clock_timestamp();
    update public.characters set current_town_id=completed_destination where id=player.id;
    select * into player from public.characters where id=player.id;
  end if;
  if exists(select 1 from public.osun_town_travels where character_id=player.id
    and status='travelling' and arrival_at>clock_timestamp()) then raise exception 'ALREADY_TRAVELLING'; end if;
  if player.current_town_id=p_destination_id then raise exception 'ALREADY_THERE'; end if;
  select r.* into route from public.osun_town_routes r join public.osun_towns destination
    on destination.id=r.to_town_id and destination.travel_enabled
    where r.from_town_id=player.current_town_id and r.to_town_id=p_destination_id;
  if not found then raise exception 'TOWN_UNAVAILABLE'; end if;
  select * into wallet from public.wallets where character_id=player.id and user_id=p_user_id for update;
  if not found then raise exception 'NO_WALLET'; end if;
  if wallet.balance<route.fare_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;
  arrival:=clock_timestamp()+(route.travel_minutes||' minutes')::interval;
  update public.wallets set balance=balance-route.fare_minor,
    total_expenses=total_expenses+route.fare_minor where id=wallet.id;
  result:=jsonb_build_object('travel_id',trip_id,'from_town_id',route.from_town_id,
    'to_town_id',route.to_town_id,'fare',route.fare_minor,
    'travel_minutes',route.travel_minutes,'arrival_at',arrival,'status','travelling');
  insert into public.osun_town_travels(id,user_id,character_id,idempotency_key,from_town_id,
    to_town_id,fare_minor,travel_minutes,arrival_at,response)
  values(trip_id,p_user_id,player.id,p_idempotency_key,route.from_town_id,route.to_town_id,
    route.fare_minor,route.travel_minutes,arrival,result);
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(p_user_id,wallet.id,player.id,route.fare_minor,'expense','transport',
    'Town travel to '||(select name from public.osun_towns where id=p_destination_id),
    'travel','cash',route.from_town_id,route.to_town_id,wallet.balance-route.fare_minor,
    jsonb_build_object('town_travel_id',trip_id,'request_id',p_idempotency_key));
  return result;
end $$;

notify pgrst,'reload schema';

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
  select response into prior from public.osun_town_travels
    where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return prior || jsonb_build_object('duplicate',true); end if;
  select * into player from public.characters where user_id=p_user_id
    order by created_at desc limit 1 for update;
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

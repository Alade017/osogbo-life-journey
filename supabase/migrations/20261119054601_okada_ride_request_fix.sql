-- Okada rides: a new ride starts as 'requested' (searching for a rider), so the 20-second search
-- and cancelling work. The destination must be "Home" or the name of a real location.
create or replace function public.request_okada_ride(p_destination text, p_request_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  wallet public.wallets%rowtype;
  fare bigint;
  ride_id uuid;
  cash_after bigint;
  destination_text text := btrim(coalesce(p_destination, ''));
  result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null or length(destination_text) not between 2 and 120 then
    raise exception 'Choose a destination and include a request ID';
  end if;
  if destination_text <> 'Home' and not exists (
    select 1 from public.locations l where l.name = destination_text
  ) then
    raise exception 'That destination is not on the rider''s list';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select er.result into result
  from public.economy_request_results er
  where er.character_id = cid and er.request_id = p_request_id and er.operation = 'okada_ride';
  if found then
    return jsonb_set(
      result,
      '{status}',
      to_jsonb(coalesce(
        (select r.status from public.okada_ride_requests r
         where r.id = (result ->> 'rideId')::uuid and r.user_id = uid),
        result ->> 'status'
      ))
    );
  end if;

  select amount_minor into fare
  from public.town_service_prices
  where service = 'okada_ride' and active
  for update;
  if fare is null then raise exception 'Okada rides are unavailable'; end if;

  select * into wallet
  from public.wallets
  where character_id = cid and user_id = uid
  for update;
  if not found or wallet.balance < fare then raise exception 'Insufficient cash'; end if;
  cash_after := wallet.balance - fare;
  update public.wallets
  set balance = cash_after, total_expenses = total_expenses + fare
  where id = wallet.id;

  insert into public.okada_ride_requests(
    user_id, character_id, destination, fare_minor, status
  )
  values (uid, cid, destination_text, fare, 'requested')
  returning id into ride_id;

  insert into public.transactions(
    user_id, wallet_id, character_id, amount, kind, category, description,
    transaction_type, account, source, destination, balance_after, metadata
  )
  values (
    uid, wallet.id, cid, fare, 'expense', 'transport',
    'Okada ride to ' || destination_text, 'purchase', 'cash',
    'Okada rides', destination_text, cash_after,
    jsonb_build_object('ride_id', ride_id, 'request_id', p_request_id)
  );
  result := jsonb_build_object(
    'rideId', ride_id, 'fare', fare, 'cash', cash_after, 'status', 'requested'
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
  values (cid, p_request_id, 'okada_ride', result);
  return result;
end
$$;

-- Rides created by the earlier version were marked assigned without a time, so they never
-- completed. Give them the time they were created so the sync can finish them.
update public.okada_ride_requests
set assigned_at = created_at
where status = 'assigned' and assigned_at is null;

notify pgrst, 'reload schema';

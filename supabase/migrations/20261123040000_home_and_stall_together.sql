-- Home and market stall together.
-- A player can hold one home (owned or rented) and one market stall at the same time.
-- Every tenancy is tagged with its kind, so the database enforces those two slots, and the
-- home-only rent and relief paths never touch a stall.
-- Also retires the legacy recurring-rent collector, which billed every rented tenancy again on
-- each game load, next to the cycle-based rent that players actually pay.
-- Function bodies below start from the live definitions (pg_get_functiondef, 2026-11-23) and
-- change only what is described in each comment.

-- 1. Tag every tenancy with its kind.
alter table public.player_properties add column if not exists housing_kind text;

update public.player_properties tenancy
  set housing_kind = case
    when listing.house_type_id is not null then 'home'
    when listing.property_type = 'market_stall' then 'stall'
    else 'other' end
  from public.game_properties listing
  where listing.id = tenancy.property_id and tenancy.housing_kind is null;

alter table public.player_properties alter column housing_kind set not null;
alter table public.player_properties drop constraint if exists player_properties_housing_kind_check;
alter table public.player_properties add constraint player_properties_housing_kind_check
  check (housing_kind in ('home', 'stall', 'other'));

-- 2. One rented home and one rented stall at a time. Owning homes is not limited by this index:
-- a player may own several homes and select one. Renting a home while owning one is still refused
-- by the rent functions, which check every active home.
drop index if exists public.one_active_rental_per_character;
create unique index if not exists one_active_rented_home_per_character
  on public.player_properties(character_id)
  where is_active and tenure = 'rented' and housing_kind = 'home';
create unique index if not exists one_active_stall_per_character
  on public.player_properties(character_id) where is_active and housing_kind = 'stall';

-- 3. The rent trigger tags the kind on insert and whenever the property changes. Rent fields are unchanged.
create or replace function public._initialize_property_rent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare listing public.game_properties%rowtype;
begin
  select * into listing from public.game_properties where id = new.property_id;
  new.housing_kind := case
    when listing.house_type_id is not null then 'home'
    when listing.property_type = 'market_stall' then 'stall'
    else 'other' end;
  if new.tenure = 'rented' then
    new.rent_amount := listing.rent_price;
    new.rent_period_days := listing.rent_period_days;
    new.next_rent_due_at := coalesce(new.acquired_at, now()) + make_interval(days => listing.rent_period_days);
  else
    new.rent_amount := null;
    new.rent_period_days := null;
    new.next_rent_due_at := null;
  end if;
  return new;
end $function$;

-- 4. Retire the legacy recurring-rent collector. Rent is collected through property_rent_cycles:
-- pay_property_rent for homes and pay_market_stall_rent for stalls.
create or replace function public.process_my_property_rent()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object('paid', 0, 'periods_paid', 0, 'unpaid_periods', 0, 'retired', true);
$$;

-- 5. Cycle advance. A stall repossession no longer moves the player out of the city centre.
create or replace function public._advance_property_rent_cycles()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare changed integer := 0; ended_ids uuid[];
begin
  update public.property_rent_cycles set status = 'due'
    where status = 'current' and due_at <= now();
  get diagnostics changed = row_count;
  update public.property_rent_cycles set status = 'grace'
    where status = 'due' and due_at <= now();
  update public.property_rent_cycles set status = 'rescue'
    where status in ('due','grace') and grace_ends_at <= now();
  update public.player_houses room set status = 'overdue'
    from public.property_rent_cycles cycle
    where room.player_property_id = cycle.player_property_id
      and room.status = 'active' and cycle.status in ('grace','rescue');
  with repossessed as (
    update public.property_rent_cycles set status = 'repossessed'
      where status = 'rescue' and rescue_ends_at <= now()
      returning player_property_id, character_id
  ), ended as (
    update public.player_properties tenancy set is_active = false, updated_at = now()
      from repossessed where tenancy.id = repossessed.player_property_id
      returning tenancy.id, tenancy.character_id, tenancy.user_id, tenancy.housing_kind
  ), moved as (
    update public.characters character set current_location_id = location.id, updated_at = now()
      from ended join public.locations location on location.slug = 'city-centre'
      where character.id = ended.character_id and ended.housing_kind = 'home'
        and not exists (
          select 1 from public.player_properties home
          where home.character_id = character.id and home.is_active and home.housing_kind = 'home'
        ) returning character.id
  ), ended_rooms as (
    update public.player_houses room set status = 'ended'
      from ended where room.player_property_id = ended.id
        and room.status in ('active','overdue') returning room.id
  ) select array_agg(id) into ended_ids from ended_rooms;
  if ended_ids is not null then
    delete from public.house_placements where player_house_id = any(ended_ids);
    delete from public.player_homes legacy where legacy.user_id in (
      select player_id from public.player_houses where id = any(ended_ids))
      and not exists (select 1 from public.player_properties home
        where home.user_id = legacy.user_id and home.is_active and home.is_home);
    update public.home_items item set placed = false, slot_id = null, updated_at = now()
      where item.user_id in (select player_id from public.player_houses where id = any(ended_ids))
        and not exists (select 1 from public.player_properties home
          where home.user_id = item.user_id and home.is_active and home.is_home);
  end if;
  return changed;
end $function$;

-- 6. Ending a rented home never ends a rented stall. Only the home slot is checked and released.
create or replace function public._end_rented_home_with_refund(p_character_id uuid, p_user_id uuid, p_keep_property_id uuid)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  tenancy public.player_properties%rowtype;
  listing public.game_properties%rowtype;
  house public.house_types%rowtype;
  refund bigint := 0;
  wallet public.wallets%rowtype;
begin
  select * into tenancy from public.player_properties
    where character_id = p_character_id and is_active and tenure = 'rented' and housing_kind = 'home'
      and (p_keep_property_id is null or property_id <> p_keep_property_id)
    for update;
  if not found then return 0; end if;

  -- Overdue rent must be settled first, otherwise the switch would waive it.
  if exists (
    select 1 from public.property_rent_cycles
    where player_property_id = tenancy.id and status in ('due', 'grace', 'rescue')
  ) then
    raise exception 'PAY_OVERDUE_RENT_FIRST';
  end if;

  select * into listing from public.game_properties where id = tenancy.property_id;
  if listing.house_type_id is not null then
    select * into house from public.house_types where id = listing.house_type_id;
    refund := house.weekly_rent_minor * house.deposit_weeks;
  end if;

  if refund > 0 then
    update public.wallets
      set balance = balance + refund,
          total_expenses = greatest(0, total_expenses - refund),
          updated_at = now()
      where character_id = p_character_id
      returning * into wallet;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (p_user_id, wallet.id, p_character_id, refund, 'income', 'housing_deposit_refund',
        'Deposit refund for ' || listing.name || ' (moved out)');
  end if;

  -- Rent for the current period was already paid; nothing is charged or waived here.
  update public.property_rent_cycles set status = 'paid', paid_at = now()
    where player_property_id = tenancy.id and status = 'current';
  -- Rooms are kept, not deleted, so the furniture stays for a later return.
  update public.player_houses set status = 'ended'
    where player_id = p_user_id and status in ('active', 'overdue')
      and (player_property_id = tenancy.id or player_property_id is null)
      and house_type_id = listing.house_type_id;
  delete from public.player_homes
    where character_id = p_character_id and house_type_id = listing.house_type_id;
  update public.player_properties set is_active = false, is_home = false, updated_at = now()
    where id = tenancy.id;

  return refund;
end $function$;

-- 7. Owning or renting a home blocks a second home. A stall does not count.
create or replace function public._housing_rent_property_original(p_user_id uuid, p_property_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cid uuid; property public.game_properties%rowtype; house public.house_types%rowtype;
  wallet public.wallets%rowtype; tenancy public.player_properties%rowtype;
  cycle public.property_rent_cycles%rowtype; result jsonb; upfront bigint;
  accessory_band text; accessory_items jsonb; receipt_operation text; eligible jsonb;
begin
  if p_request_id is null or p_property_id is null then raise exception 'INVALID_REQUEST'; end if;
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select receipt.operation, receipt.result into receipt_operation, result
    from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id;
  if found then
    if receipt_operation <> 'housing_rent_property'
      or result->>'propertyId' <> p_property_id::text then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return result;
  end if;
  perform 1 from public.characters where id = cid for update;
  if exists (select 1 from public.player_properties where character_id = cid and is_active and housing_kind = 'home')
    or exists (select 1 from public.player_houses where player_id = p_user_id and status in ('active','overdue'))
    or exists (select 1 from public.player_homes where character_id = cid) then
    raise exception 'ALREADY_RENTING';
  end if;
  select * into property from public.game_properties
    where id = p_property_id and is_active for share;
  if not found or property.house_type_id is null then raise exception 'UNKNOWN_PROPERTY'; end if;
  select * into house from public.house_types where id = property.house_type_id and is_active for share;
  if not found then raise exception 'UNKNOWN_HOUSE'; end if;
  select item into eligible from jsonb_array_elements(
    public.housing_eligible_houses(p_user_id)->'houses'
  ) as entries(item) where item->>'id' = house.id;
  if coalesce((eligible->>'eligible')::boolean, false) = false then
    raise exception '%', coalesce(eligible->>'reason_code', 'HOUSE_INELIGIBLE');
  end if;
  select * into wallet from public.wallets where character_id = cid for update;
  upfront := house.weekly_rent_minor * (house.deposit_weeks + 1);
  if not found or wallet.balance < upfront then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update public.wallets set balance = balance - upfront,
    total_expenses = total_expenses + upfront, updated_at = now()
    where id = wallet.id returning * into wallet;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values(p_user_id, wallet.id, cid, upfront, 'expense', 'housing_rent',
      'Move-in deposit and first week: ' || house.label);
  insert into public.player_properties(user_id, character_id, property_id, tenure, lease_ends_at)
    values(p_user_id, cid, property.id, 'rented', now() + interval '7 days')
    returning * into tenancy;
  insert into public.property_rent_cycles(
    player_property_id, character_id, period_start_at, due_at, grace_ends_at,
    rescue_ends_at, amount_minor, status
  ) values (
    tenancy.id, cid, now(), now() + interval '7 days', now() + interval '10 days',
    now() + interval '11 days', house.weekly_rent_minor, 'current'
  ) returning * into cycle;
  accessory_band := public._housing_accessory_band(wallet.balance);
  accessory_items := coalesce(house.starter_accessories -> accessory_band, '[]'::jsonb);
  insert into public.player_home_accessory_sets(character_id, player_property_id, budget_minor, band, items)
    values(cid, tenancy.id, wallet.balance, accessory_band, accessory_items)
    on conflict (player_property_id) do update set
      budget_minor = excluded.budget_minor, band = excluded.band, items = excluded.items;
  insert into public.player_items(player_id, item_id, source, is_stackable, quantity)
    select p_user_id, item.id, 'gift', item.stackable, 1
    from jsonb_array_elements_text(accessory_items) chosen(item_id)
    join public.content_items item on item.id = chosen.item_id and item.is_active
    on conflict(player_id, item_id) where not is_stackable do nothing;
  result := jsonb_build_object(
    'propertyId', property.id, 'houseTypeId', house.id, 'status', cycle.status,
    'dueAt', cycle.due_at, 'weeklyRentMinor', cycle.amount_minor,
    'accessoryBand', accessory_band, 'walletBalance', wallet.balance
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(cid, p_request_id, 'housing_rent_property', result);
  return result;
end $function$;

-- 8. A stall is rented while a home is held, and only one stall at a time.
create or replace function public.rent_market_stall(p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  uid uuid := auth.uid();
  cid uuid;
  listing public.game_properties%rowtype;
  wallet public.wallets%rowtype;
  tenancy public.player_properties%rowtype;
  due timestamptz;
  cached jsonb;
  operation text;
  receipt jsonb;
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id=uid and not coalesce(account.is_anonymous,false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  select character.id into cid from public.characters character where character.user_id=uid;
  if cid is null then raise exception 'Create a character first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cid::text||p_request_id::text,0));
  select result.operation,result.result into operation,cached
    from public.economy_request_results result
    where result.character_id=cid and result.request_id=p_request_id;
  if found then
    if operation <> 'market_stall_rent' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return cached || jsonb_build_object('duplicate',true);
  end if;
  perform 1 from public.characters character where character.id=cid and character.user_id=uid for update;
  if exists (
    select 1 from public.player_properties property where property.character_id=cid
      and property.is_active and property.housing_kind='stall'
  ) then raise exception 'ALREADY_RENTING'; end if;
  select * into listing from public.game_properties
    where slug='oja-oba-market-stall' and property_type='market_stall' and is_active for share;
  if not found or listing.rent_price is null then raise exception 'MARKET_STALL_UNAVAILABLE'; end if;
  select w.* into wallet from public.wallets w where w.character_id=cid and w.user_id=uid for update;
  if not found or wallet.balance<listing.rent_price then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update public.wallets set balance=balance-listing.rent_price,
    total_expenses=total_expenses+listing.rent_price,updated_at=now()
    where id=wallet.id returning * into wallet;
  insert into public.player_properties(user_id,character_id,property_id,tenure,lease_ends_at)
    values(uid,cid,listing.id,'rented',clock_timestamp()+interval '7 days')
    returning * into tenancy;
  due := tenancy.lease_ends_at;
  insert into public.property_rent_cycles(player_property_id,character_id,period_start_at,due_at,
    grace_ends_at,rescue_ends_at,amount_minor,status)
  values(tenancy.id,cid,clock_timestamp(),due,due+interval '3 days',due+interval '4 days',
    listing.rent_price,'current');
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,wallet.id,cid,listing.rent_price,'expense','market_stall_rent',
    'First week rent: Oja-Oba Market Stall','expense','cash','wallet','market_stall',
    wallet.balance,jsonb_build_object('property_id',listing.id,'request_id',p_request_id));
  receipt:=jsonb_build_object('propertyId',listing.id,'playerPropertyId',tenancy.id,
    'weeklyRentMinor',listing.rent_price,'dueAt',due,'status','current','cash',wallet.balance);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'market_stall_rent',receipt);
  return receipt || jsonb_build_object('duplicate',false);
end
$function$;

-- 9. Home rent (service role). Homes only. The rent this pays is the home's cycle, never a stall's.
create or replace function public.housing_rent(p_user_id uuid, p_house_type_id text, p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare response jsonb; cid uuid; listing_id uuid; legacy_due timestamptz;
  tenancy public.player_properties%rowtype;
begin
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if exists (select 1 from public.player_properties where character_id = cid and is_active and housing_kind = 'home')
    and not exists (select 1 from public.player_houses where player_id = p_user_id
      and house_type_id = p_house_type_id and status in ('active','overdue')) then
    perform public._audit_house_action(p_user_id, 'housing.rent', p_house_type_id,
      'rejected', 'ALREADY_RENTING', p_idempotency_key);
    return jsonb_build_object('ok', false, 'code', 'ALREADY_RENTING');
  end if;
  response := public._housing_rent_legacy(p_user_id, p_house_type_id, p_idempotency_key);
  if coalesce((response->>'ok')::boolean, false) = false then return response; end if;
  select id into listing_id from public.game_properties
    where slug = 'housing-' || p_house_type_id and is_active;
  if listing_id is null then raise exception 'UNKNOWN_PROPERTY'; end if;
  select * into tenancy from public.player_properties
    where character_id = cid and is_active and housing_kind = 'home' for update;
  if found then
    if tenancy.property_id <> listing_id then raise exception 'ALREADY_RENTING'; end if;
    return response;
  end if;
  select next_rent_due_at into legacy_due from public.player_houses
    where player_id = p_user_id and house_type_id = p_house_type_id
      and status in ('active','overdue') order by created_at desc limit 1;
  insert into public.player_properties(user_id, character_id, property_id, tenure, lease_ends_at)
    values(p_user_id, cid, listing_id, 'rented', legacy_due) returning * into tenancy;
  insert into public.property_rent_cycles(
    player_property_id, character_id, period_start_at, due_at, grace_ends_at,
    rescue_ends_at, amount_minor, status
  ) select tenancy.id, cid, now(), legacy_due, legacy_due + interval '3 days',
    legacy_due + interval '4 days', house.weekly_rent_minor, 'current'
    from public.house_types house where house.id = p_house_type_id;
  return response;
end $function$;

-- 10. Shared home join: a home slot is required, a stall does not block it.
create or replace function public.shared_home_join(p_user_id uuid, p_unit_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  cid uuid;
  unit public.shared_home_units%rowtype;
  listing public.game_properties%rowtype;
  house public.house_types%rowtype;
  wallet public.wallets%rowtype;
  tenancy public.player_properties%rowtype;
  cycle public.property_rent_cycles%rowtype;
  eligible jsonb;
  bed smallint;
  upfront bigint;
  active_count integer;
  accessory_band text;
  accessory_items jsonb;
  receipt_operation text;
  result jsonb;
begin
  if p_request_id is null or p_unit_id is null then raise exception 'INVALID_REQUEST'; end if;
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));

  select receipt.operation, receipt.result into receipt_operation, result
    from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id;
  if found then
    if receipt_operation <> 'shared_home_join' or result->>'unitId' <> p_unit_id::text then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return result;
  end if;

  perform 1 from public.characters where id = cid for update;
  if exists (select 1 from public.player_properties where character_id = cid and is_active and housing_kind = 'home')
    or exists (select 1 from public.player_houses where player_id = p_user_id and status in ('active', 'overdue'))
    or exists (select 1 from public.player_homes where character_id = cid)
    or exists (select 1 from public.shared_home_occupancies where character_id = cid and ended_at is null) then
    raise exception 'ALREADY_RENTING';
  end if;

  select * into unit from public.shared_home_units where id = p_unit_id for update;
  if not found then raise exception 'UNKNOWN_UNIT'; end if;
  select * into listing from public.game_properties where id = unit.game_property_id and is_active;
  if not found or listing.house_type_id is null then raise exception 'UNKNOWN_PROPERTY'; end if;
  select * into house from public.house_types where id = listing.house_type_id and is_active;
  if not found then raise exception 'UNKNOWN_HOUSE'; end if;

  select item into eligible from jsonb_array_elements(
    public.housing_eligible_houses(p_user_id)->'houses'
  ) as entries(item) where item->>'id' = house.id;
  if coalesce((eligible->>'eligible')::boolean, false) = false then
    raise exception '%', coalesce(eligible->>'reason_code', 'HOUSE_INELIGIBLE');
  end if;

  select count(*) into active_count from public.shared_home_occupancies
    where unit_id = unit.id and ended_at is null;
  if active_count >= unit.capacity then raise exception 'UNIT_FULL'; end if;
  select min(candidate.bed) into bed
    from generate_series(1, unit.capacity) as candidate(bed)
    where not exists (
      select 1 from public.shared_home_occupancies o
      where o.unit_id = unit.id and o.bed_slot = candidate.bed and o.ended_at is null
    );
  if bed is null then raise exception 'UNIT_FULL'; end if;

  select * into wallet from public.wallets where character_id = cid for update;
  upfront := house.weekly_rent_minor * (house.deposit_weeks + 1);
  if not found or wallet.balance < upfront then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update public.wallets set balance = balance - upfront,
    total_expenses = total_expenses + upfront, updated_at = now()
    where id = wallet.id returning * into wallet;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values(p_user_id, wallet.id, cid, upfront, 'expense', 'housing_rent',
      'Move-in deposit and first week: ' || house.label || ' (' || unit.label || ')');

  insert into public.player_properties(user_id, character_id, property_id, tenure, lease_ends_at)
    values(p_user_id, cid, listing.id, 'rented', now() + interval '7 days')
    returning * into tenancy;
  insert into public.property_rent_cycles(
    player_property_id, character_id, period_start_at, due_at, grace_ends_at,
    rescue_ends_at, amount_minor, status
  ) values (
    tenancy.id, cid, now(), now() + interval '7 days', now() + interval '10 days',
    now() + interval '11 days', house.weekly_rent_minor, 'current'
  ) returning * into cycle;
  insert into public.shared_home_occupancies(unit_id, character_id, bed_slot)
    values(unit.id, cid, bed);

  accessory_band := public._housing_accessory_band(wallet.balance);
  accessory_items := coalesce(house.starter_accessories -> accessory_band, '[]'::jsonb);
  insert into public.player_home_accessory_sets(character_id, player_property_id, budget_minor, band, items)
    values(cid, tenancy.id, wallet.balance, accessory_band, accessory_items)
    on conflict (player_property_id) do update set
      budget_minor = excluded.budget_minor, band = excluded.band, items = excluded.items;
  insert into public.player_items(player_id, item_id, source, is_stackable, quantity)
    select p_user_id, item.id, 'gift', item.stackable, 1
    from jsonb_array_elements_text(accessory_items) chosen(item_id)
    join public.content_items item on item.id = chosen.item_id and item.is_active
    on conflict(player_id, item_id) where not is_stackable do nothing;

  result := jsonb_build_object(
    'unitId', unit.id, 'bedSlot', bed, 'propertyId', listing.id, 'houseTypeId', house.id,
    'status', cycle.status, 'dueAt', cycle.due_at, 'weeklyRentMinor', cycle.amount_minor,
    'accessoryBand', accessory_band, 'walletBalance', wallet.balance
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(cid, p_request_id, 'shared_home_join', result);
  return result;
end $function$;

-- 11. Home rent payment. Homes only. A stall is paid through pay_market_stall_rent.
create or replace function public.pay_property_rent(p_user_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cid uuid; cycle public.property_rent_cycles%rowtype; wallet public.wallets%rowtype;
  result jsonb; next_due timestamptz; receipt_operation text;
begin
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select receipt.operation, receipt.result into receipt_operation, result
    from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id;
  if found then
    if receipt_operation <> 'property_rent_payment' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return result;
  end if;
  perform public._advance_property_rent_cycles();
  select rent_cycle.* into cycle from public.property_rent_cycles rent_cycle
    join public.player_properties tenancy on tenancy.id = rent_cycle.player_property_id
    where rent_cycle.character_id = cid and tenancy.is_active and tenancy.housing_kind = 'home'
      and rent_cycle.status in ('current', 'due', 'grace', 'rescue')
    order by rent_cycle.due_at limit 1 for update of rent_cycle;
  if not found then raise exception 'NO_RENT_DUE'; end if;
  select * into wallet from public.wallets where character_id = cid for update;
  if not found or wallet.balance < cycle.amount_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update public.wallets set balance = balance - cycle.amount_minor,
    total_expenses = total_expenses + cycle.amount_minor, updated_at = now()
    where id = wallet.id returning * into wallet;
  update public.property_rent_cycles set status = 'paid', paid_at = now() where id = cycle.id;
  next_due := greatest(cycle.due_at, now()) + interval '7 days';
  insert into public.property_rent_cycles(
    player_property_id, character_id, period_start_at, due_at, grace_ends_at,
    rescue_ends_at, amount_minor, status
  ) values (
    cycle.player_property_id, cid, now(), next_due, next_due + interval '3 days',
    next_due + interval '4 days', cycle.amount_minor, 'current'
  ) returning * into cycle;
  update public.player_properties set lease_ends_at = cycle.due_at, updated_at = now()
    where id = cycle.player_property_id;
  update public.player_houses set status = 'active', next_rent_due_at = cycle.due_at
    where player_id = p_user_id and status in ('active', 'overdue')
      and (player_property_id = cycle.player_property_id or player_property_id is null);
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values(p_user_id, wallet.id, cid, cycle.amount_minor, 'expense', 'housing_rent', 'Weekly property rent');
  result := jsonb_build_object('status', cycle.status, 'dueAt', cycle.due_at,
    'weeklyRentMinor', cycle.amount_minor, 'walletBalance', wallet.balance);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(cid, p_request_id, 'property_rent_payment', result);
  return result;
end $function$;

-- 12. Overdue relief. An optional kind ('home' or 'stall') picks which rental the relief is for.
-- With no kind it behaves as before, so existing callers keep working.
drop function if exists public.resolve_property_overdue(uuid, text, uuid);
create or replace function public.resolve_property_overdue(p_user_id uuid, p_option text, p_request_id uuid, p_kind text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cid uuid; cycle public.property_rent_cycles%rowtype; cycle_kind text; result jsonb; instalment bigint;
  hustle_id uuid; receipt_operation text; next_due timestamptz;
begin
  if p_request_id is null or p_option not in ('loan', 'job') then raise exception 'INVALID_REQUEST'; end if;
  if p_kind is not null and p_kind not in ('home', 'stall') then raise exception 'INVALID_REQUEST'; end if;
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select receipt.operation, receipt.result into receipt_operation, result
    from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id;
  if found then
    if receipt_operation <> 'property_overdue_resolution' or result->>'option' <> p_option then
      raise exception 'IDEMPOTENCY_CONFLICT';
    end if;
    return result;
  end if;
  perform public._advance_property_rent_cycles();
  select rent_cycle.* into cycle from public.property_rent_cycles rent_cycle
    join public.player_properties tenancy on tenancy.id = rent_cycle.player_property_id
    where rent_cycle.character_id = cid and rent_cycle.status = 'rescue' and now() < rent_cycle.rescue_ends_at
      and tenancy.is_active and (p_kind is null or tenancy.housing_kind = p_kind)
    order by rent_cycle.due_at limit 1 for update of rent_cycle;
  if not found then raise exception 'OVERDUE_OPTION_UNAVAILABLE'; end if;
  select housing_kind into cycle_kind from public.player_properties where id = cycle.player_property_id;
  if p_option = 'loan' then
    instalment := ceil(cycle.amount_minor / 4.0)::bigint;
    insert into public.property_rent_rescue_loans(
      rent_cycle_id, character_id, principal_minor, instalment_minor, instalments_total
    ) values(cycle.id, cid, cycle.amount_minor, instalment, 4)
    on conflict (rent_cycle_id) do nothing;
    if not found then raise exception 'OVERDUE_OPTION_UNAVAILABLE'; end if;
    update public.property_rent_cycles set status = 'paid', paid_at = now() where id = cycle.id;
    next_due := now() + interval '7 days';
    insert into public.property_rent_cycles(
      player_property_id, character_id, period_start_at, due_at, grace_ends_at,
      rescue_ends_at, amount_minor, status
    ) values (
      cycle.player_property_id, cid, now(), next_due, next_due + interval '3 days',
      next_due + interval '4 days', cycle.amount_minor, 'current'
    );
    update public.player_properties set lease_ends_at = next_due, updated_at = now()
      where id = cycle.player_property_id;
    update public.player_houses legacy set status = 'active', next_rent_due_at = next_due
      where legacy.player_id = p_user_id and legacy.status in ('active', 'overdue')
        and (legacy.player_property_id = cycle.player_property_id
          or (legacy.player_property_id is null and cycle_kind = 'home'));
    result := jsonb_build_object('option', 'loan', 'status', 'paid',
      'principalMinor', cycle.amount_minor, 'instalmentMinor', instalment, 'instalmentsTotal', 4);
  else
    insert into public.player_side_hustles(character_id, rent_cycle_id, shift_pay_minor, next_shift_at)
      values(cid, cycle.id, ceil(cycle.amount_minor / 3.0)::bigint, now())
      on conflict(character_id, rent_cycle_id, title) do update set status = 'active', dropped_at = null
      returning id, shift_pay_minor into hustle_id, instalment;
    result := jsonb_build_object(
      'option', 'job', 'id', hustle_id, 'status', 'active', 'shiftPayMinor', instalment
    );
  end if;
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(cid, p_request_id, 'property_overdue_resolution', result);
  return result;
end $function$;
revoke all on function public.resolve_property_overdue(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.resolve_property_overdue(uuid, text, uuid, text) to service_role;

-- 13. Relief state. The same optional kind filters the notice, jobs and offers.
drop function if exists public.housing_relief_state(uuid);
create or replace function public.housing_relief_state(p_user_id uuid, p_kind text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_character_id uuid; v_notice jsonb; v_hustles jsonb;
  v_loan_offer jsonb; v_job_offer jsonb; v_cycle public.property_rent_cycles%rowtype;
begin
  if p_kind is not null and p_kind not in ('home', 'stall') then raise exception 'INVALID_REQUEST'; end if;
  select id into v_character_id from public.characters where user_id = p_user_id;
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  perform public._advance_property_rent_cycles();

  select jsonb_build_object(
    'cycleId', rent.id, 'houseName', listing.name,
    'repossessedAt', coalesce(rent.repossessed_at, rent.rescue_ends_at)
  ) into v_notice
  from public.property_rent_cycles rent
  join public.player_properties tenancy on tenancy.id = rent.player_property_id
  join public.game_properties listing on listing.id = tenancy.property_id
  where rent.character_id = v_character_id and rent.status = 'repossessed'
    and rent.notice_acknowledged_at is null
    and (p_kind is null or tenancy.housing_kind = p_kind)
  order by rent.repossessed_at desc nulls last, rent.rescue_ends_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', hustle.id, 'title', hustle.title,
    'shiftPayMinor', hustle.shift_pay_minor,
    'shiftsTotal', hustle.shifts_total,
    'shiftsCompleted', hustle.shifts_completed,
    'nextShiftAt', hustle.next_shift_at,
    'canWorkNow', hustle.next_shift_at <= now(),
    'rentPaid', rent.status = 'paid',
    'keepConfirmedAt', hustle.keep_confirmed_at
  ) order by hustle.created_at desc), '[]'::jsonb) into v_hustles
  from public.player_side_hustles hustle
  join public.property_rent_cycles rent on rent.id = hustle.rent_cycle_id
  join public.player_properties tenancy on tenancy.id = rent.player_property_id
  where hustle.character_id = v_character_id and hustle.status = 'active'
    and (p_kind is null or tenancy.housing_kind = p_kind);

  select rent.* into v_cycle from public.property_rent_cycles rent
    join public.player_properties tenancy on tenancy.id = rent.player_property_id
    where rent.character_id = v_character_id and rent.status = 'rescue'
      and now() < rent.rescue_ends_at and tenancy.is_active
      and (p_kind is null or tenancy.housing_kind = p_kind)
    order by rent.due_at desc limit 1;
  if found then
    if not exists (select 1 from public.property_rent_rescue_loans loan
      where loan.character_id = v_character_id and loan.status = 'open') then
      v_loan_offer := jsonb_build_object(
        'principalMinor', v_cycle.amount_minor,
        'instalmentMinor', ceil(v_cycle.amount_minor / 4.0)::bigint,
        'instalmentsTotal', 4
      );
    end if;
    if not exists (select 1 from public.player_side_hustles hustle
      where hustle.rent_cycle_id = v_cycle.id and hustle.character_id = v_character_id
        and hustle.status = 'active') then
      v_job_offer := jsonb_build_object(
        'shiftPayMinor', ceil(v_cycle.amount_minor / 3.0)::bigint,
        'shiftsTotal', 3
      );
    end if;
  end if;
  return jsonb_build_object('notice', v_notice, 'hustles', v_hustles,
    'loanOffer', v_loan_offer, 'jobOffer', v_job_offer);
end $function$;
revoke all on function public.housing_relief_state(uuid, text) from public, anon, authenticated;
grant execute on function public.housing_relief_state(uuid, text) to service_role;

-- 14. Cancelling a rented home ends its tenancy and its current rent period. Overdue rent must be paid first.
create or replace function public._cancel_player_house_original(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare h public.player_houses%rowtype;
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Sign in to cancel your tenancy'; end if;
  perform public._process_player_house_status(p_user_id);
  select * into h from public.player_houses where player_id = p_user_id and status in ('active','overdue')
    order by created_at desc limit 1 for update;
  if not found then raise exception 'There is no active tenancy to cancel'; end if;
  if h.player_property_id is not null and exists (
    select 1 from public.property_rent_cycles
    where player_property_id = h.player_property_id and status in ('due', 'grace', 'rescue')
  ) then raise exception 'PAY_OVERDUE_RENT_FIRST'; end if;
  update public.player_houses set status = 'ended' where id = h.id;
  if h.player_property_id is not null then
    update public.property_rent_cycles set status = 'paid', paid_at = coalesce(paid_at, now())
      where player_property_id = h.player_property_id and status = 'current';
    update public.player_properties set is_active = false, is_home = false, updated_at = now()
      where id = h.player_property_id and tenure = 'rented' and is_active;
  end if;
  delete from public.house_placements where player_house_id = h.id;
  delete from public.player_homes where user_id = p_user_id;
  update public.home_items set placed = false, slot_id = null, updated_at = now() where user_id = p_user_id;
  perform public._audit_house_action(p_user_id, 'tenancy.cancel', h.id::text, 'success', null, null,
    jsonb_build_object('refund_minor', 0, 'items_returned_to_inventory', true));
  return jsonb_build_object('ok', true, 'houseId', h.id, 'status', 'ended', 'refundMinor', 0);
end $function$;

-- 15. Rent relief job for an overdue rental. The optional kind chooses the home or the stall.
drop function if exists public.apply_rent_relief_hustle(uuid, uuid);
create or replace function public.apply_rent_relief_hustle(p_user_id uuid, p_request_id uuid, p_kind text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare cid uuid; cycle public.property_rent_cycles%rowtype; result jsonb; hustle public.player_side_hustles%rowtype;
begin
  if p_kind is not null and p_kind not in ('home', 'stall') then raise exception 'INVALID_REQUEST'; end if;
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select receipt.result into result from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id
      and receipt.operation = 'rent_relief_apply';
  if found then return result; end if;
  perform public._advance_property_rent_cycles();
  select rent.* into cycle from public.property_rent_cycles rent
    join public.player_properties tenancy on tenancy.id = rent.player_property_id
    where rent.character_id = cid and rent.status = 'rescue' and now() < rent.rescue_ends_at
      and tenancy.is_active and (p_kind is null or tenancy.housing_kind = p_kind)
    order by rent.due_at limit 1 for update of rent;
  if not found then raise exception 'RENT_RELIEF_UNAVAILABLE'; end if;
  insert into public.player_side_hustles(character_id, rent_cycle_id, shift_pay_minor, next_shift_at)
    values(cid, cycle.id, ceil(cycle.amount_minor / 3.0)::bigint, now())
    on conflict(character_id, rent_cycle_id, title) do update set status = 'active', dropped_at = null
    returning * into hustle;
  result := jsonb_build_object(
    'id', hustle.id, 'shiftPayMinor', hustle.shift_pay_minor,
    'nextShiftAt', hustle.next_shift_at, 'status', hustle.status
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(cid, p_request_id, 'rent_relief_apply', result);
  return result;
end $function$;
revoke all on function public.apply_rent_relief_hustle(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.apply_rent_relief_hustle(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';

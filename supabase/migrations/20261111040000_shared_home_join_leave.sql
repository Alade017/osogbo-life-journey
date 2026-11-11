-- Shared room join and leave. Money and tenancy rules are the same as renting a private home:
-- eligibility, deposit plus first week on join, the existing tenancy and rent cycle, and the
-- deposit refund on leaving. Every amount is read from house_types and game_properties.

create or replace function public.shared_home_join(p_user_id uuid, p_unit_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
  if exists (select 1 from public.player_properties where character_id = cid and is_active)
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
  -- The lowest bed number that no active tenant holds. Two tenants can never get the same bed.
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
end $$;

create or replace function public.shared_home_leave(p_user_id uuid, p_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  cid uuid;
  occupancy public.shared_home_occupancies%rowtype;
  refund bigint;
  receipt_operation text;
  result jsonb;
begin
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));

  select receipt.operation, receipt.result into receipt_operation, result
    from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id;
  if found then
    if receipt_operation <> 'shared_home_leave' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return result;
  end if;

  perform 1 from public.characters where id = cid for update;
  select * into occupancy from public.shared_home_occupancies
    where character_id = cid and ended_at is null for update;
  if not found then raise exception 'NOT_IN_SHARED_ROOM'; end if;

  -- Same refund and overdue rule as ending a rented home. Furniture is kept for a later return.
  refund := public._end_rented_home_with_refund(cid, p_user_id, null);
  update public.shared_home_occupancies set ended_at = now() where id = occupancy.id;

  result := jsonb_build_object(
    'unitId', occupancy.unit_id, 'bedSlot', occupancy.bed_slot, 'refundMinor', refund
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(cid, p_request_id, 'shared_home_leave', result);
  return result;
end $$;

revoke all on function public.shared_home_join(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.shared_home_leave(uuid, uuid) from public, anon, authenticated;
grant execute on function public.shared_home_join(uuid, uuid, uuid) to service_role;
grant execute on function public.shared_home_leave(uuid, uuid) to service_role;

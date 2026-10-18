-- Consolidate all new housing writes on the unified property model.
-- game_properties is the public catalogue; player_properties and
-- property_rent_cycles are the private, server-authoritative tenancy state.

alter table public.player_properties enable row level security;
revoke insert, update, delete on public.player_properties from anon, authenticated;
grant select on public.player_properties to authenticated;

alter table public.game_properties enable row level security;
revoke insert, update, delete on public.game_properties from anon, authenticated;
grant select on public.game_properties to authenticated;

-- Every house type has a catalogue listing. These listings are reusable type
-- definitions; tenancy remains character-scoped in player_properties.
insert into public.game_properties (
  slug, name, description, property_type, location_id, rent_price,
  rent_period_days, level_required, house_type_id, metadata
)
select
  'housing-' || house.id,
  house.label,
  house.description,
  case when house.id in ('shared-room', 'single-room') then 'room'
       when house.id in ('studio-flat', 'mini-flat') then 'apartment'
       else 'house' end,
  location.id,
  house.weekly_rent_minor,
  7,
  0,
  house.id,
  jsonb_build_object('world', 'fictional', 'housing', true)
from public.house_types house
join public.locations location on location.slug = 'residential'
where house.is_active
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  rent_price = excluded.rent_price,
  rent_period_days = excluded.rent_period_days,
  house_type_id = excluded.house_type_id,
  is_active = true,
  updated_at = now();

create index if not exists game_properties_housing_type_idx
  on public.game_properties(house_type_id) where is_active and house_type_id is not null;

create or replace function public.housing_property_listings(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid;
begin
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'propertyId', listing.id,
      'houseTypeId', house.id,
      'label', house.label,
      'description', house.description,
      'weeklyRentMinor', house.weekly_rent_minor,
      'depositWeeks', house.deposit_weeks,
      'priceMinor', house.weekly_rent_minor * (house.deposit_weeks + 1),
      'upfrontTotalMinor', house.weekly_rent_minor * (house.deposit_weeks + 1),
      'slotCount', jsonb_array_length(house.slots),
      'assetKey', house.asset_key,
      'starterAccessories', house.starter_accessories,
      'isCurrentHome', exists (
        select 1 from public.player_properties mine
        where mine.character_id = cid and mine.property_id = listing.id and mine.is_active
      ),
      'available', not exists (
        select 1 from public.player_properties mine
        where mine.character_id = cid and mine.is_active
      )
    ) order by house.sort_order), '[]'::jsonb)
    from public.game_properties listing
    join public.house_types house on house.id = listing.house_type_id and house.is_active
    where listing.is_active and listing.slug = 'housing-' || house.id
  );
end $$;
revoke all on function public.housing_property_listings(uuid) from public, anon, authenticated;
grant execute on function public.housing_property_listings(uuid) to service_role;

create or replace function public.housing_rent_property(
  p_user_id uuid,
  p_property_id uuid,
  p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
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
  if exists (select 1 from public.player_properties where character_id = cid and is_active)
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
end $$;
revoke all on function public.housing_rent_property(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.housing_rent_property(uuid,uuid,uuid) to service_role;

create or replace function public.pay_property_rent(p_user_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
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
  select * into cycle from public.property_rent_cycles
    where character_id = cid and status in ('current', 'due', 'grace', 'rescue')
    order by due_at limit 1 for update;
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
    where player_id = p_user_id and status in ('active', 'overdue');
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values(p_user_id, wallet.id, cid, cycle.amount_minor, 'expense', 'housing_rent', 'Weekly property rent');
  result := jsonb_build_object('status', cycle.status, 'dueAt', cycle.due_at,
    'weeklyRentMinor', cycle.amount_minor, 'walletBalance', wallet.balance);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(cid, p_request_id, 'property_rent_payment', result);
  return result;
end $$;
revoke all on function public.pay_property_rent(uuid,uuid) from public, anon, authenticated;
grant execute on function public.pay_property_rent(uuid,uuid) to service_role;

create or replace function public.resolve_property_overdue(
  p_user_id uuid, p_option text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; cycle public.property_rent_cycles%rowtype; result jsonb; instalment bigint;
  hustle_id uuid; receipt_operation text; next_due timestamptz;
begin
  if p_request_id is null or p_option not in ('loan', 'job') then raise exception 'INVALID_REQUEST'; end if;
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
  select * into cycle from public.property_rent_cycles
    where character_id = cid and status = 'rescue' and now() < rescue_ends_at
    order by due_at limit 1 for update;
  if not found then raise exception 'OVERDUE_OPTION_UNAVAILABLE'; end if;
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
      where legacy.player_id = p_user_id and legacy.status in ('active', 'overdue');
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
end $$;
revoke all on function public.resolve_property_overdue(uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.resolve_property_overdue(uuid,text,uuid) to service_role;

-- The legacy endpoint remains available, but it must offer relief only after
-- the three-day grace period, alongside the loan option above.
create or replace function public.apply_rent_relief_hustle(p_user_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; cycle public.property_rent_cycles%rowtype; result jsonb; hustle public.player_side_hustles%rowtype;
begin
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select receipt.result into result from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id
      and receipt.operation = 'rent_relief_apply';
  if found then return result; end if;
  perform public._advance_property_rent_cycles();
  select * into cycle from public.property_rent_cycles
    where character_id = cid and status = 'rescue' and now() < rescue_ends_at
    order by due_at limit 1 for update;
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
end $$;
revoke all on function public.apply_rent_relief_hustle(uuid,uuid) from public, anon, authenticated;
grant execute on function public.apply_rent_relief_hustle(uuid,uuid) to service_role;

-- Keep the established onboarding route usable while recording every new
-- legacy rental in the canonical property tables. The legacy RPC still owns
-- its existing move-in charge and room inventory; this wrapper charges nothing.
alter function public.housing_rent(uuid,text,text) rename to _housing_rent_legacy;
revoke all on function public._housing_rent_legacy(uuid,text,text) from public, anon, authenticated;

create function public.housing_rent(p_user_id uuid,p_house_type_id text,p_idempotency_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare response jsonb; cid uuid; listing_id uuid; legacy_due timestamptz;
  tenancy public.player_properties%rowtype;
begin
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if exists (select 1 from public.player_properties where character_id = cid and is_active)
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
    where character_id = cid and is_active for update;
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
end $$;
revoke all on function public.housing_rent(uuid,text,text) from public, anon, authenticated;
grant execute on function public.housing_rent(uuid,text,text) to service_role;

-- Existing active legacy rentals are retained without a second charge.
insert into public.player_properties(user_id, character_id, property_id, tenure, lease_ends_at)
select legacy.player_id, character.id, listing.id, 'rented', legacy.next_rent_due_at
from public.player_houses legacy
join public.characters character on character.user_id = legacy.player_id
join public.game_properties listing on listing.slug = 'housing-' || legacy.house_type_id
where legacy.status in ('active','overdue')
  and not exists (select 1 from public.player_properties existing
    where existing.character_id = character.id and existing.is_active);

insert into public.property_rent_cycles(
  player_property_id, character_id, period_start_at, due_at, grace_ends_at,
  rescue_ends_at, amount_minor, status
)
select tenancy.id, tenancy.character_id, tenancy.acquired_at, legacy.next_rent_due_at,
  legacy.next_rent_due_at + interval '3 days', legacy.next_rent_due_at + interval '4 days',
  house.weekly_rent_minor, 'current'
from public.player_properties tenancy
join public.game_properties listing on listing.id = tenancy.property_id
join public.house_types house on house.id = listing.house_type_id
join public.player_houses legacy on legacy.player_id = tenancy.user_id
  and legacy.house_type_id = house.id and legacy.status in ('active','overdue')
where tenancy.is_active and tenancy.tenure = 'rented'
  and not exists (select 1 from public.property_rent_cycles cycle
    where cycle.player_property_id = tenancy.id and cycle.status in ('current','due','grace','rescue'))
on conflict(player_property_id,period_start_at) do nothing;

-- Keep the older house screen in step with the canonical rent clock.
create or replace function public._advance_property_rent_cycles()
returns integer language plpgsql security definer set search_path=public as $$
declare changed integer := 0; ended_ids uuid[];
begin
  update public.property_rent_cycles set status = 'due'
    where status = 'current' and due_at <= now();
  get diagnostics changed = row_count;
  update public.property_rent_cycles set status = 'grace'
    where status = 'due' and due_at <= now();
  update public.property_rent_cycles set status = 'rescue'
    where status in ('due','grace') and grace_ends_at <= now();
  update public.player_houses legacy set status = 'overdue'
    from public.characters character
    join public.property_rent_cycles cycle on cycle.character_id = character.id
    where legacy.player_id = character.user_id and legacy.status = 'active'
      and cycle.status in ('grace','rescue');
  with repossessed as (
    update public.property_rent_cycles set status = 'repossessed'
      where status = 'rescue' and rescue_ends_at <= now()
      returning player_property_id, character_id
  ), ended as (
    update public.player_properties property set is_active = false, updated_at = now()
      from repossessed where property.id = repossessed.player_property_id
      returning property.character_id, property.user_id
  ), moved as (
    update public.characters character set current_location_id = location.id, updated_at = now()
      from ended join public.locations location on location.slug = 'city-centre'
      where character.id = ended.character_id returning ended.user_id
  ), ended_houses as (
    update public.player_houses legacy set status = 'ended'
      from moved where legacy.player_id = moved.user_id
        and legacy.status in ('active','overdue') returning legacy.id
  )
  select array_agg(id) into ended_ids from ended_houses;
  if ended_ids is not null then
    delete from public.house_placements where player_house_id = any(ended_ids);
    delete from public.player_homes where user_id in (
      select player_id from public.player_houses where id = any(ended_ids));
    update public.home_items set placed = false, slot_id = null, updated_at = now()
      where user_id in (select player_id from public.player_houses where id = any(ended_ids));
  end if;
  return changed;
end $$;
revoke all on function public._advance_property_rent_cycles() from public, anon, authenticated;

create or replace function public._process_player_house_status(p_player_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare ended_ids uuid[];
begin
  perform public._advance_property_rent_cycles();
  -- Orphaned legacy rows retain their original expiry rule until migrated.
  with ended as (
    update public.player_houses legacy set status = 'ended'
      where legacy.player_id = p_player_id and legacy.status in ('active','overdue')
        and legacy.next_rent_due_at + interval '7 days' <= now()
        and not exists (
          select 1 from public.player_properties property
          where property.user_id = p_player_id and property.is_active
        ) returning legacy.id
  ) select array_agg(id) into ended_ids from ended;
  if ended_ids is not null then
    delete from public.house_placements where player_house_id = any(ended_ids);
    delete from public.player_homes where user_id = p_player_id;
    update public.home_items set placed = false, slot_id = null, updated_at = now()
      where user_id = p_player_id;
  end if;
end $$;
revoke all on function public._process_player_house_status(uuid) from public, anon, authenticated;

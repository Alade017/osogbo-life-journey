-- Records the live definitions of behaviour-changing functions as they run in production.
-- Source of truth: pg_get_functiondef on project btpiqjhhxkvjwgwtznav, 2026-11-22.
-- Forward-only: each statement replaces the function body with the live text. No applied migration is edited.

CREATE OR REPLACE FUNCTION public._advance_property_rent_cycles()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      returning player_property_id,character_id
  ), ended as (
    update public.player_properties tenancy set is_active = false,updated_at = now()
      from repossessed where tenancy.id = repossessed.player_property_id
      returning tenancy.id,tenancy.character_id,tenancy.user_id
  ), moved as (
    update public.characters character set current_location_id = location.id,updated_at = now()
      from ended join public.locations location on location.slug = 'city-centre'
      where character.id = ended.character_id and not exists (
        select 1 from public.player_properties home
        join public.game_properties listing on listing.id = home.property_id
        where home.character_id = character.id and home.is_active
          and listing.house_type_id is not null
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
    update public.home_items item set placed = false,slot_id = null,updated_at = now()
      where item.user_id in (select player_id from public.player_houses where id = any(ended_ids))
        and not exists (select 1 from public.player_properties home
          where home.user_id = item.user_id and home.is_active and home.is_home);
  end if;
  return changed;
end $function$;

CREATE OR REPLACE FUNCTION public._housing_rent_legacy(p_user_id uuid, p_house_type_id text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare prior public.housing_choice_idempotency%rowtype; c public.characters%rowtype;
  w public.wallets%rowtype; h public.house_types%rowtype; new_house public.player_houses%rowtype;
  listing jsonb; house_eligibility jsonb; eligibility_error text; response jsonb;
  request_hash text; paid_at timestamptz:=now();
begin
  perform public._process_player_house_status(p_user_id);
  begin
    if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then raise exception 'INVALID_IDEMPOTENCY_KEY'; end if;
    perform pg_advisory_xact_lock(hashtextextended(p_user_id::text||p_idempotency_key,0));
    request_hash:=md5('weekly-rent:'||p_house_type_id);
    select * into prior from public.housing_choice_idempotency
      where user_id=p_user_id and idempotency_key=p_idempotency_key for update;
    if found then
      if prior.request_hash<>request_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
      perform public._audit_house_action(p_user_id,'housing.rent',p_house_type_id,'replayed',null,p_idempotency_key);
      return prior.response;
    end if;
    select * into c from public.characters where user_id=p_user_id for update;
    if not found then raise exception 'NO_CHARACTER'; end if;
    if exists(select 1 from public.player_houses where player_id=p_user_id and status in ('active','overdue'))
      then raise exception 'ALREADY_RENTING'; end if;
    select * into h from public.house_types where id=p_house_type_id and is_active for share;
    if not found then raise exception 'UNKNOWN_HOUSE'; end if;
    select * into w from public.wallets where user_id=p_user_id and character_id=c.id for update;
    if not found then raise exception 'NO_WALLET'; end if;
    listing:=public.housing_eligible_houses(p_user_id);
    select item into house_eligibility from jsonb_array_elements(listing->'houses') as entries(item)
      where item->>'id'=p_house_type_id;
    if coalesce((house_eligibility->>'eligible')::boolean,false)=false then
      eligibility_error:=coalesce(house_eligibility->>'reason_code','HOUSE_INELIGIBLE');
      raise exception '%',eligibility_error;
    end if;
    if h.weekly_rent_minor*(h.deposit_weeks+1)>w.balance then raise exception 'INSUFFICIENT_FUNDS'; end if;

    update public.wallets set balance=balance-h.weekly_rent_minor*h.deposit_weeks,
      total_expenses=total_expenses+h.weekly_rent_minor*h.deposit_weeks,updated_at=paid_at
      where id=w.id returning * into w;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
      values(p_user_id,w.id,c.id,h.weekly_rent_minor*h.deposit_weeks,'expense','housing_deposit','Housing deposit: '||h.label);
    update public.wallets set balance=balance-h.weekly_rent_minor,
      total_expenses=total_expenses+h.weekly_rent_minor,updated_at=paid_at
      where id=w.id returning * into w;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
      values(p_user_id,w.id,c.id,h.weekly_rent_minor,'expense','housing_rent','First week rent: '||h.label);

    insert into public.player_houses(player_id,house_type_id,rented_at,next_rent_due_at,status)
      values(p_user_id,h.id,paid_at,paid_at+interval '7 days','active') returning * into new_house;
    insert into public.player_homes(user_id,character_id,house_type_id,moved_in_at,next_rent_at)
      values(p_user_id,c.id,h.id,paid_at,paid_at+interval '7 days')
      on conflict(character_id) do update set house_type_id=excluded.house_type_id,
        moved_in_at=excluded.moved_in_at,next_rent_at=excluded.next_rent_at;
    update public.characters set onboarding_step='done',updated_at=paid_at where id=c.id;

    insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
    values('starter-bed','furniture','bed','bed',0,true,false),
      ('starter-light','furniture','light','light',0,true,false),
      ('starter-seat','furniture','seat','seat',0,true,false)
    on conflict(id) do nothing;
    insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
    values(p_user_id,'starter-bed','reward',false,1),(p_user_id,'starter-light','reward',false,1),
      (p_user_id,'starter-seat','reward',false,1)
    on conflict(player_id,item_id) where not is_stackable do nothing;
    insert into public.house_placements(player_house_id,item_id,slot)
    select new_house.id,v.item_id,v.slot from (values
      ('starter-bed','bed'),('starter-light','light'),('starter-seat','seat')) v(item_id,slot)
    where exists(select 1 from jsonb_array_elements(h.slots) s where s->>'id'=v.slot and s->>'slot_type'=(
      select ci.slot_type from public.content_items ci where ci.id=v.item_id))
    on conflict(player_house_id,slot) do nothing;
    insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,placed)
    select p_user_id,c.id,v.item_id,ci.slot_type,v.slot,true
      from (values ('starter-bed','bed'),('starter-light','light'),('starter-seat','seat')) v(item_id,slot)
      join public.content_items ci on ci.id=v.item_id
    on conflict(character_id,item_id) do update set placed=true,slot_id=excluded.slot_id,updated_at=now();

    response:=jsonb_build_object('ok',true,'home',jsonb_build_object('id',new_house.id,
      'house_type_id',h.id,'rented_at',new_house.rented_at,'next_rent_due_at',new_house.next_rent_due_at,
      'status',new_house.status),'home_items',coalesce((select jsonb_agg(to_jsonb(i))
      from public.home_items i where i.character_id=c.id),'[]'::jsonb),
      'wallet_balance',w.balance,'onboarding_step','done','state',public.get_house_state(p_user_id));
    insert into public.housing_choice_idempotency(user_id,idempotency_key,request_hash,response)
      values(p_user_id,p_idempotency_key,request_hash,response);
    perform public._audit_house_action(p_user_id,'housing.rent',p_house_type_id,'success',null,p_idempotency_key);
    return response;
  exception when others then
    perform public._audit_house_action(p_user_id,'housing.rent',p_house_type_id,'rejected',sqlerrm,p_idempotency_key);
    return public._house_error(sqlerrm);
  end;
end;
$function$;

CREATE OR REPLACE FUNCTION public._process_player_house_status(p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.apply_rent_relief_hustle(p_user_id uuid, p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.housing_rent(p_user_id uuid, p_house_type_id text, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION public.my_account_summary()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select pg_catalog.jsonb_build_object(
    'email', u.email,
    'is_guest', coalesce(u.is_anonymous, false),
    'account_type', case
      when coalesce(u.is_anonymous, false) then 'guest'
      when exists (
        select 1 from public.username_accounts ua where ua.user_id = u.id
      ) then 'username'
      else 'email'
    end
  )
  from auth.users u
  where u.id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.save_player_stall(p_name text, p_goods text, p_is_open boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  uid uuid := auth.uid();
  cid uuid;
  stamp timestamptz;
  v_stall_id uuid;
  category_id text := public._stall_category_id(p_goods);
  category_label text;
  clean_name text := btrim(coalesce(p_name,''));
  should_open boolean := coalesce(p_is_open,false);
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id = uid and not coalesce(account.is_anonymous,false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if length(clean_name) not between 2 and 64 then
    raise exception 'Use a stall name of 2 to 64 characters';
  end if;
  select character.id into cid from public.characters character where character.user_id=uid for update;
  if cid is null then raise exception 'Create a character first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stall-income:'||uid::text,0));
  stamp := clock_timestamp();
  if not public._market_stall_active(cid,stamp) then raise exception 'Rent a current stall before saving'; end if;
  select label into category_label from public.stall_categories where id=category_id;
  insert into public.stall_income_state(user_id,settled_at)
    values(uid,stamp) on conflict(user_id) do nothing;
  perform 1 from public.stall_income_state state where state.user_id=uid for update;
  perform 1 from public.player_stalls stall where stall.user_id=uid for update;
  stamp := greatest(clock_timestamp(),coalesce(
    (select state.settled_at from public.stall_income_state state where state.user_id=uid),clock_timestamp()
  ));
  perform public._settle_stall_income(uid,stamp);
  if should_open and not public._market_stall_active(cid,stamp) then
    raise exception 'The stall lease is not current';
  end if;
  insert into public.player_stalls(user_id,character_id,name,goods,is_open,stall_category,updated_at)
    values(uid,cid,clean_name,category_label,should_open,category_id,stamp)
  on conflict(user_id) do update set
    character_id=excluded.character_id,
    name=excluded.name,
    goods=excluded.goods,
    is_open=excluded.is_open,
    stall_category=excluded.stall_category,
    updated_at=excluded.updated_at
  returning id into v_stall_id;
  update public.stall_income_state
    set stall_id=v_stall_id,is_open=should_open,settled_at=stamp
    where user_id=uid;
  return jsonb_build_object('ok',true,'isOpen',should_open,'category',category_id);
end
$function$;

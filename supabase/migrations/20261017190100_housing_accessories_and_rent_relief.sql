-- Automatic move-in accessories and rent-relief side hustles.
-- Side hustles deliberately do not use character_jobs, which remains the one-main-job system.

alter table public.house_types
  add column if not exists starter_accessories jsonb not null default '{}'::jsonb
  check (jsonb_typeof(starter_accessories) = 'object');

-- A move-in budget selects an included set; it is not a second charge.  These
-- catalogue ids are deliberately fictional starter assets already understood
-- by the item-art pipeline.
update public.house_types set starter_accessories = case id
  when 'shared-room' then '{"basic":["starter-bed","starter-light","starter-seat"],"comfortable":["starter-bed","starter-light","starter-seat","plant"],"premium":["starter-bed","starter-light","starter-seat","plant","television"]}'::jsonb
  when 'single-room' then '{"basic":["starter-bed","starter-light","starter-seat"],"comfortable":["starter-bed","starter-light","starter-seat","plant"],"premium":["starter-bed","starter-light","starter-seat","plant","television"]}'::jsonb
  when 'studio-flat' then '{"basic":["starter-bed","starter-light","starter-seat","stove"],"comfortable":["starter-bed","starter-light","starter-seat","stove","plant"],"premium":["starter-bed","starter-light","starter-seat","stove","plant","television"]}'::jsonb
  when 'mini-flat' then '{"basic":["starter-bed","starter-light","starter-seat","stove"],"comfortable":["starter-bed","starter-light","starter-seat","stove","plant","sofa"],"premium":["starter-bed","starter-light","starter-seat","stove","plant","sofa","television"]}'::jsonb
  when 'bungalow' then '{"basic":["starter-bed","starter-light","starter-seat","stove","sofa"],"comfortable":["starter-bed","starter-light","starter-seat","stove","sofa","plant","television"],"premium":["starter-bed","starter-light","starter-seat","stove","sofa","plant","television","computer"]}'::jsonb
  when 'duplex' then '{"basic":["starter-bed","starter-light","starter-seat","stove","sofa","television"],"comfortable":["starter-bed","starter-light","starter-seat","stove","sofa","television","plant","computer"],"premium":["starter-bed","starter-light","starter-seat","stove","sofa","television","plant","computer","shower"]}'::jsonb
  else starter_accessories
end;

create table if not exists public.player_home_accessory_sets (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  player_property_id uuid not null references public.player_properties(id) on delete cascade,
  budget_minor bigint not null check (budget_minor >= 0),
  band text not null check (band in ('basic','comfortable','premium')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  unique (player_property_id)
);
alter table public.player_home_accessory_sets enable row level security;
revoke all on public.player_home_accessory_sets from anon, authenticated;
grant all on public.player_home_accessory_sets to service_role;
create policy player_home_accessory_sets_read on public.player_home_accessory_sets
  for select to authenticated using (character_id = public._my_character_id());

create table if not exists public.player_side_hustles (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  rent_cycle_id uuid not null references public.property_rent_cycles(id) on delete cascade,
  title text not null default 'Rent relief shift',
  shift_pay_minor bigint not null check (shift_pay_minor > 0),
  shifts_total smallint not null default 3 check (shifts_total between 1 and 3),
  shifts_completed smallint not null default 0 check (shifts_completed between 0 and 3),
  next_shift_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','completed','dropped')),
  created_at timestamptz not null default now(),
  dropped_at timestamptz,
  unique (character_id, rent_cycle_id, title)
);
create index if not exists player_side_hustles_active_idx on public.player_side_hustles(character_id,next_shift_at) where status='active';
alter table public.player_side_hustles enable row level security;
revoke all on public.player_side_hustles from anon, authenticated;
grant all on public.player_side_hustles to service_role;
create policy player_side_hustles_read on public.player_side_hustles
  for select to authenticated using (character_id = public._my_character_id());

create or replace function public._housing_accessory_band(p_budget_minor bigint)
returns text language sql immutable as $$
  select case when p_budget_minor >= 20000 then 'premium' when p_budget_minor >= 5000 then 'comfortable' else 'basic' end;
$$;
revoke all on function public._housing_accessory_band(bigint) from public, anon, authenticated;

create or replace function public.apply_rent_relief_hustle(p_user_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; cycle public.property_rent_cycles%rowtype; result jsonb; hustle public.player_side_hustles%rowtype;
begin
  select id into cid from public.characters where user_id=p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select receipt.result into result from public.economy_request_results receipt where receipt.character_id=cid and receipt.request_id=p_request_id and receipt.operation='rent_relief_apply';
  if found then return result; end if;
  select * into cycle from public.property_rent_cycles where character_id=cid and status='grace' and now()<grace_ends_at order by due_at limit 1 for update;
  if not found then raise exception 'RENT_RELIEF_UNAVAILABLE'; end if;
  insert into public.player_side_hustles(character_id,rent_cycle_id,shift_pay_minor,next_shift_at)
    values(cid,cycle.id,ceil(cycle.amount_minor/3.0)::bigint,now())
    on conflict(character_id,rent_cycle_id,title) do update set status='active',dropped_at=null
    returning * into hustle;
  result:=jsonb_build_object('id',hustle.id,'shiftPayMinor',hustle.shift_pay_minor,'nextShiftAt',hustle.next_shift_at,'status',hustle.status);
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'rent_relief_apply',result);
  return result;
end $$;
revoke all on function public.apply_rent_relief_hustle(uuid,uuid) from public,anon,authenticated;
grant execute on function public.apply_rent_relief_hustle(uuid,uuid) to service_role;

create or replace function public.drop_side_hustle(p_user_id uuid,p_hustle_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; hustle public.player_side_hustles%rowtype; result jsonb;
begin
  select id into cid from public.characters where user_id=p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select receipt.result into result from public.economy_request_results receipt where receipt.character_id=cid and receipt.request_id=p_request_id and receipt.operation='rent_relief_drop';
  if found then return result; end if;
  update public.player_side_hustles set status='dropped',dropped_at=now() where id=p_hustle_id and character_id=cid and status='active' returning * into hustle;
  if not found then raise exception 'SIDE_HUSTLE_NOT_ACTIVE'; end if;
  result:=jsonb_build_object('id',hustle.id,'status','dropped');
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'rent_relief_drop',result);
  return result;
end $$;
revoke all on function public.drop_side_hustle(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.drop_side_hustle(uuid,uuid,uuid) to service_role;

create or replace function public.choose_move_in_accessory_budget(p_user_id uuid,p_budget_minor bigint, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; property public.player_properties%rowtype; listing public.game_properties%rowtype;
  house public.house_types%rowtype; wallet public.wallets%rowtype; result jsonb; selected_band text; chosen_items jsonb;
begin
  select id into cid from public.characters where user_id=p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null or p_budget_minor is null or p_budget_minor < 0 then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select receipt.result into result from public.economy_request_results receipt where receipt.character_id=cid and receipt.request_id=p_request_id and receipt.operation='move_in_accessories';
  if found then return result; end if;
  select * into property from public.player_properties where character_id=cid and is_active for update;
  if not found then raise exception 'NO_ACTIVE_HOME'; end if;
  select * into wallet from public.wallets where character_id=cid for update;
  if not found or p_budget_minor>wallet.balance then raise exception 'ACCESSORY_BUDGET_UNAFFORDABLE'; end if;
  select * into listing from public.game_properties where id=property.property_id;
  select * into house from public.house_types where id=listing.house_type_id;
  if not found then raise exception 'HOUSE_LAYOUT_UNAVAILABLE'; end if;
  selected_band:=public._housing_accessory_band(p_budget_minor);
  chosen_items:=coalesce(house.starter_accessories->selected_band, '[]'::jsonb);
  insert into public.player_home_accessory_sets(character_id,player_property_id,budget_minor,band,items)
    values(cid,property.id,p_budget_minor,selected_band,chosen_items)
    on conflict(player_property_id) do update set budget_minor=excluded.budget_minor,band=excluded.band,items=excluded.items;
  insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
    select p_user_id, item.id, 'gift', item.stackable, 1
    from jsonb_array_elements_text(chosen_items) as chosen(item_id)
    join public.content_items item on item.id=chosen.item_id and item.is_active
    on conflict(player_id,item_id) where not is_stackable do nothing;
  result:=jsonb_build_object('band',selected_band,'items',chosen_items,'budgetMinor',p_budget_minor);
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'move_in_accessories',result);
  return result;
end $$;
revoke all on function public.choose_move_in_accessory_budget(uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.choose_move_in_accessory_budget(uuid,bigint,uuid) to service_role;

create or replace function public.complete_rent_relief_shift(p_user_id uuid,p_hustle_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid; hustle public.player_side_hustles%rowtype; wallet public.wallets%rowtype; result jsonb; earned bigint;
begin
  select id into cid from public.characters where user_id=p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  if p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select receipt.result into result from public.economy_request_results receipt where receipt.character_id=cid and receipt.request_id=p_request_id and receipt.operation='rent_relief_shift';
  if found then return result; end if;
  select * into hustle from public.player_side_hustles where id=p_hustle_id and character_id=cid and status='active' for update;
  if not found or hustle.next_shift_at>now() then raise exception 'SIDE_HUSTLE_UNAVAILABLE'; end if;
  select * into wallet from public.wallets where character_id=cid for update;
  earned:=case when hustle.shifts_completed+1=hustle.shifts_total then greatest(1,(select amount_minor from public.property_rent_cycles where id=hustle.rent_cycle_id)-hustle.shift_pay_minor*hustle.shifts_completed) else hustle.shift_pay_minor end;
  update public.wallets set balance=balance+earned,total_income=total_income+earned,updated_at=now() where id=wallet.id returning * into wallet;
  update public.player_side_hustles as side_hustle set shifts_completed=side_hustle.shifts_completed+1,next_shift_at=now()+interval '30 minutes',status=case when side_hustle.shifts_completed+1=side_hustle.shifts_total then 'completed' else 'active' end where side_hustle.id=hustle.id returning side_hustle.* into hustle;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
    select c.user_id,wallet.id,cid,earned,'income','rent_relief_shift','Rent relief side hustle shift' from public.characters c where c.id=cid;
  result:=jsonb_build_object('id',hustle.id,'earnedMinor',earned,'status',hustle.status,'shiftsCompleted',hustle.shifts_completed,'walletBalance',wallet.balance);
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'rent_relief_shift',result);
  return result;
end $$;
revoke all on function public.complete_rent_relief_shift(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.complete_rent_relief_shift(uuid,uuid,uuid) to service_role;

create or replace function public.get_active_side_hustles(p_user_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'shiftPayMinor',shift_pay_minor,
    'shiftsTotal',shifts_total,'shiftsCompleted',shifts_completed,'nextShiftAt',next_shift_at,'status',status)
    order by created_at desc),'[]'::jsonb)
  from public.player_side_hustles where character_id=(select id from public.characters where user_id=p_user_id) and status in ('active','completed');
$$;
revoke all on function public.get_active_side_hustles(uuid) from public,anon,authenticated;
grant execute on function public.get_active_side_hustles(uuid) to service_role;

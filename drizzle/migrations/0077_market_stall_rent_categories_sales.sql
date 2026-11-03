-- Phase 7: rented stalls, validated categories, player stock and atomic sales.
-- Local Drizzle migration only. It must not be applied to a hosted database
-- without a separately approved release.

alter table public.game_properties
  drop constraint if exists game_properties_property_type_check;
alter table public.game_properties
  add constraint game_properties_property_type_check
  check (property_type in ('room', 'apartment', 'house', 'land_plot', 'market_stall'));

insert into public.game_properties (
  slug, name, description, property_type, location_id, purchase_price, rent_price,
  rent_period_days, level_required, is_active, metadata
)
select
  'oja-oba-market-stall',
  'Oja-Oba Market Stall',
  'A reusable player stall rental in the fictional Oja-Oba market.',
  'market_stall',
  location.id,
  null,
  2000,
  7,
  0,
  true,
  '{"world":"fictional","marketStall":true}'::jsonb
from public.locations location
where location.slug = 'oja-oba'
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  property_type = excluded.property_type,
  location_id = excluded.location_id,
  rent_price = excluded.rent_price,
  rent_period_days = excluded.rent_period_days,
  is_active = true,
  metadata = excluded.metadata,
  updated_at = now();

create table public.stall_categories (
  id text primary key check (id in ('fabrics','groceries','phones','hospitality','crafts','general')),
  label text not null unique,
  is_public_filter boolean not null default true,
  sort_order smallint not null unique
);
insert into public.stall_categories(id,label,is_public_filter,sort_order) values
  ('fabrics','Adire & Ankara Fabrics',true,1),
  ('groceries','Fresh Market Produce',true,2),
  ('phones','Phone Care & Accessories',true,3),
  ('hospitality','Street Food & Cold Drinks',true,4),
  ('crafts','Handcrafted Beads & Art',true,5),
  ('general','Other goods',true,6);
alter table public.stall_categories enable row level security;
revoke all on public.stall_categories from public,anon,authenticated;
grant select on public.stall_categories to authenticated;
grant all on public.stall_categories to service_role;
create policy stall_categories_read on public.stall_categories
  for select to authenticated using (true);

alter table public.player_stalls add column stall_category text;
update public.player_stalls
set stall_category = case
  when lower(goods) ~ '(fabric|adire|ankara|textile)' then 'fabrics'
  when lower(goods) ~ '(produce|grocer|fruit|yam|pepper|plantain|foodstuff)' then 'groceries'
  when lower(goods) ~ '(phone|electronic|accessor|repair|charger)' then 'phones'
  when lower(goods) ~ '(food|drink|hospitality|suya|puff|roast)' then 'hospitality'
  when lower(goods) ~ '(craft|art|bead|carv|wood)' then 'crafts'
  else 'general'
end;
alter table public.player_stalls alter column stall_category set not null;
alter table public.player_stalls
  add constraint player_stalls_stall_category_fkey
  foreign key (stall_category) references public.stall_categories(id);
create index player_stalls_category_directory_idx
  on public.player_stalls(stall_category,id) where is_open;
drop policy if exists "phone read player stalls" on public.player_stalls;
drop policy if exists "phone own player stalls" on public.player_stalls;
create policy "phone own player stalls" on public.player_stalls
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert,update,delete on public.player_stalls from anon,authenticated;

-- Existing open stalls keep their earned time through the migration boundary,
-- then close until each owner rents and explicitly opens a stall.
do $$
declare row record;
begin
  for row in
    select state.user_id
    from public.stall_income_state state
    join public.player_stalls stall on stall.id = state.stall_id
    where state.is_open and stall.is_open
    order by state.user_id
  loop
    perform public._settle_stall_income(row.user_id, clock_timestamp());
  end loop;
end
$$;
update public.player_stalls set is_open = false, updated_at = now();

create or replace function public._stall_category_id(p_value text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare value text := lower(btrim(coalesce(p_value,'')));
begin
  if value in ('fabrics','adire & ankara fabrics') then return 'fabrics'; end if;
  if value in ('groceries','fresh market produce') then return 'groceries'; end if;
  if value in ('phones','phone care & accessories') then return 'phones'; end if;
  if value in ('hospitality','street food & cold drinks') then return 'hospitality'; end if;
  if value in ('crafts','handcrafted beads & art') then return 'crafts'; end if;
  raise exception 'Choose a valid stall category';
end
$$;
revoke all on function public._stall_category_id(text) from public,anon,authenticated;

create or replace function public._market_stall_active(p_character_id uuid, p_at timestamptz default statement_timestamp())
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.player_properties tenancy
    join public.game_properties listing on listing.id = tenancy.property_id
    join public.property_rent_cycles cycle on cycle.player_property_id = tenancy.id
    where tenancy.character_id = p_character_id
      and tenancy.is_active
      and tenancy.tenure = 'rented'
      and listing.property_type = 'market_stall'
      and cycle.status = 'current'
      and cycle.due_at > p_at
  )
$$;
revoke all on function public._market_stall_active(uuid,timestamptz) from public,anon,authenticated;

create or replace function public._close_market_stall_for_cycle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare owner_id uuid;
begin
  if old.status = 'current' and new.status in ('due','grace','rescue','repossessed') then
    select tenancy.user_id into owner_id
    from public.player_properties tenancy
    where tenancy.id = new.player_property_id
      and exists (select 1 from public.game_properties listing
        where listing.id=tenancy.property_id and listing.property_type='market_stall');
    if owner_id is not null then
      perform public._settle_stall_income(owner_id,least(clock_timestamp(),old.due_at));
      update public.player_stalls set is_open=false,updated_at=clock_timestamp()
        where user_id=owner_id;
      update public.stall_income_state set is_open=false
        where user_id=owner_id;
    end if;
  end if;
  return new;
end
$$;
revoke all on function public._close_market_stall_for_cycle() from public,anon,authenticated;
drop trigger if exists close_market_stall_on_rent_status on public.property_rent_cycles;
create trigger close_market_stall_on_rent_status
before update of status on public.property_rent_cycles
for each row when (new.status in ('due','grace','rescue','repossessed'))
execute function public._close_market_stall_for_cycle();

create or replace function public.save_player_stall(p_name text,p_goods text,p_is_open boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
$$;
revoke all on function public.save_player_stall(text,text,boolean) from public,anon;
grant execute on function public.save_player_stall(text,text,boolean) to authenticated;

create or replace function public.rent_market_stall(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
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
      and property.is_active and property.tenure='rented'
  ) or exists (
    select 1 from public.player_houses room where room.player_id=uid and room.status in ('active','overdue')
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
$$;
revoke all on function public.rent_market_stall(uuid) from public,anon;
grant execute on function public.rent_market_stall(uuid) to authenticated;

create or replace function public.pay_market_stall_rent(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  cycle public.property_rent_cycles%rowtype;
  tenancy public.player_properties%rowtype;
  wallet public.wallets%rowtype;
  result jsonb;
  operation text;
  next_due timestamptz;
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id=uid and not coalesce(account.is_anonymous,false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  select character.id into cid from public.characters character where character.user_id=uid;
  if cid is null then raise exception 'Create a character first'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cid::text||p_request_id::text,0));
  select receipt.operation,receipt.result into operation,result
    from public.economy_request_results receipt
    where receipt.character_id=cid and receipt.request_id=p_request_id;
  if found then
    if operation <> 'market_stall_rent_payment' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return result || jsonb_build_object('duplicate',true);
  end if;
  perform 1 from public.characters character where character.id=cid and character.user_id=uid for update;
  perform public._advance_property_rent_cycles();
  select rent_cycle.* into cycle
  from public.property_rent_cycles rent_cycle
  join public.player_properties property on property.id=rent_cycle.player_property_id
  join public.game_properties listing on listing.id=property.property_id
  where rent_cycle.character_id=cid and property.is_active and listing.property_type='market_stall'
    and rent_cycle.status in ('due','grace','rescue')
  order by rent_cycle.due_at for update of rent_cycle limit 1;
  if not found then raise exception 'NO_RENT_DUE'; end if;
  select property.* into tenancy from public.player_properties property
    where property.id=cycle.player_property_id for update;
  select w.* into wallet from public.wallets w where w.character_id=cid and w.user_id=uid for update;
  if not found or wallet.balance<cycle.amount_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;
  update public.wallets set balance=balance-cycle.amount_minor,
    total_expenses=total_expenses+cycle.amount_minor,updated_at=now()
    where id=wallet.id returning * into wallet;
  update public.property_rent_cycles set status='paid',paid_at=now() where id=cycle.id;
  next_due:=greatest(cycle.due_at,clock_timestamp())+interval '7 days';
  insert into public.property_rent_cycles(player_property_id,character_id,period_start_at,due_at,
    grace_ends_at,rescue_ends_at,amount_minor,status)
  values(tenancy.id,cid,clock_timestamp(),next_due,next_due+interval '3 days',
    next_due+interval '4 days',cycle.amount_minor,'current');
  update public.player_properties set lease_ends_at=next_due,updated_at=now() where id=tenancy.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,wallet.id,cid,cycle.amount_minor,'expense','market_stall_rent',
    'Weekly rent: Oja-Oba Market Stall','expense','cash','wallet','market_stall',wallet.balance,
    jsonb_build_object('property_id',tenancy.property_id,'request_id',p_request_id));
  result:=jsonb_build_object('propertyId',tenancy.property_id,'playerPropertyId',tenancy.id,
    'weeklyRentMinor',cycle.amount_minor,'dueAt',next_due,'status','current','cash',wallet.balance);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'market_stall_rent_payment',result);
  return result || jsonb_build_object('duplicate',false);
end
$$;
revoke all on function public.pay_market_stall_rent(uuid) from public,anon;
grant execute on function public.pay_market_stall_rent(uuid) to authenticated;

create or replace function public.my_market_stall_rent_status()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare cid uuid := public._my_character_id(); result jsonb;
begin
  if cid is null then raise exception 'Create a character first'; end if;
  perform public._advance_property_rent_cycles();
  select jsonb_build_object(
    'propertyId',tenancy.property_id,'playerPropertyId',tenancy.id,'name',listing.name,
    'weeklyRentMinor',cycle.amount_minor,'status',cycle.status,'dueAt',cycle.due_at,
    'graceEndsAt',cycle.grace_ends_at,'rescueEndsAt',cycle.rescue_ends_at
  ) into result
  from public.player_properties tenancy
  join public.game_properties listing on listing.id=tenancy.property_id
  left join lateral (
    select rent.* from public.property_rent_cycles rent
    where rent.player_property_id=tenancy.id
    order by rent.period_start_at desc limit 1
  ) cycle on true
  where tenancy.character_id=cid and listing.property_type='market_stall'
    and tenancy.is_active
  order by tenancy.acquired_at desc limit 1;
  return coalesce(result,'{}'::jsonb);
end
$$;
revoke all on function public.my_market_stall_rent_status() from public,anon;
grant execute on function public.my_market_stall_rent_status() to authenticated;

create or replace function public._stall_income_preview(p_user uuid,p_stamp timestamptz)
returns table(earning_date date,open_microseconds bigint,paid integer)
language plpgsql stable security definer set search_path='' as $$
declare
  s public.stall_income_state%rowtype;
  policy public.stall_income_policy%rowtype;
  stamp timestamptz;
  target_day date;
  day_start timestamptz;
  day_end timestamptz;
  extra bigint;
  n integer;
  can_earn boolean;
  lease_end timestamptz;
begin
  select * into policy from public.stall_income_policy where version=1;
  if not found then raise exception 'STALL_POLICY_UNAVAILABLE'; end if;
  select * into s from public.stall_income_state where user_id=p_user;
  if not found then return; end if;
  select cycle.due_at into lease_end
  from public.player_properties tenancy
  join public.game_properties listing on listing.id=tenancy.property_id
  join public.property_rent_cycles cycle on cycle.player_property_id=tenancy.id
  where tenancy.user_id=p_user and tenancy.is_active and tenancy.tenure='rented'
    and listing.property_type='market_stall' and cycle.status='current'
  order by cycle.due_at desc limit 1;
  stamp:=least(greatest(p_stamp,s.settled_at,policy.activated_at),coalesce(lease_end,p_stamp));
  can_earn:=lease_end is not null and coalesce(s.is_open,false) and exists(
    select 1 from public.player_stalls stall
    join public.characters character on character.id=stall.character_id and character.user_id=p_user
    where stall.id=s.stall_id and stall.user_id=p_user and stall.is_open
  );
  for n in 0..6 loop
    earning_date:=(stamp at time zone 'Africa/Lagos')::date-n;
    target_day:=earning_date;
    day_start:=earning_date::timestamp at time zone 'Africa/Lagos';
    day_end:=(earning_date+1)::timestamp at time zone 'Africa/Lagos';
    select day.open_microseconds,day.paid into open_microseconds,paid from public.stall_income_days day
      where day.user_id=p_user and day.earning_date=target_day;
    open_microseconds:=coalesce(open_microseconds,0);
    paid:=coalesce(paid,0);
    extra:=0;
    if can_earn then
      extra:=(greatest(0,extract(epoch from (least(stamp,day_end)-greatest(s.settled_at,day_start,policy.activated_at))))*1000000)::bigint;
    end if;
    open_microseconds:=least(policy.daily_cap::bigint*policy.seconds_per_naira*1000000,
      open_microseconds+extra);
    return next;
  end loop;
end
$$;
revoke all on function public._stall_income_preview(uuid,timestamptz) from public,anon,authenticated;

drop function if exists public.get_public_player_stalls(uuid,integer);
create function public.get_public_player_stalls(
  p_after uuid default null,
  p_limit integer default 20,
  p_category text default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  category_id text;
  result jsonb;
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id=uid and not coalesce(account.is_anonymous,false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if not exists (select 1 from public.characters character where character.user_id=uid) then
    raise exception 'CHARACTER_REQUIRED';
  end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'INVALID_PAGE_LIMIT'; end if;
  if p_category is not null then
    if not exists(select 1 from public.stall_categories where id=p_category and is_public_filter) then
      raise exception 'INVALID_STALL_CATEGORY';
    end if;
    category_id:=p_category;
  end if;
  with eligible as (
    select stall.id,character.name as owner_name,stall.name,stall.goods,stall.stall_category
    from public.player_stalls stall
    join public.characters character on character.id=stall.character_id and character.user_id=stall.user_id
    where stall.is_open and stall.user_id<>uid
      and (p_after is null or stall.id>p_after)
      and (category_id is null or stall.stall_category=category_id)
      and public._market_stall_active(stall.character_id,statement_timestamp())
    order by stall.id limit p_limit+1
  ), page as (select * from eligible order by id limit p_limit)
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'ownerName',owner_name,'name',name,'goods',goods,'category',stall_category
    ) order by id) from page),'[]'::jsonb),
    'nextCursor',case when (select count(*) from eligible)>p_limit
      then (select id from page order by id desc limit 1) else null end
  ) into result;
  return result;
end
$$;
revoke all on function public.get_public_player_stalls(uuid,integer,text) from public,anon;
grant execute on function public.get_public_player_stalls(uuid,integer,text) to authenticated;

create table public.stall_items (
  id uuid primary key default gen_random_uuid(),
  stall_id uuid not null references public.player_stalls(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  reference_buy_price bigint not null check (reference_buy_price>0),
  price_minor bigint not null check (price_minor>0),
  quantity integer not null check (quantity between 0 and 999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stall_id,item_id)
);
create index stall_items_available_idx on public.stall_items(stall_id,item_id)
  where quantity>0;
create trigger t_stall_items before update on public.stall_items
  for each row execute function public.touch_updated_at();
alter table public.stall_items enable row level security;
revoke all on public.stall_items from public,anon,authenticated;
grant all on public.stall_items to service_role;

create function public.get_public_stall_stock(p_stall_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); result jsonb;
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id=uid and not coalesce(account.is_anonymous,false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if not exists(select 1 from public.characters character where character.user_id=uid) then
    raise exception 'CHARACTER_REQUIRED';
  end if;
  if not exists(
    select 1 from public.player_stalls stall
    where stall.id=p_stall_id and stall.is_open and stall.user_id<>uid
      and public._market_stall_active(stall.character_id,statement_timestamp())
  ) then raise exception 'STALL_NOT_AVAILABLE'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',stock.id,'itemId',item.id,'name',item.name,'description',item.description,
    'priceMinor',stock.price_minor,'quantity',stock.quantity
  ) order by item.name),'[]'::jsonb)
    into result
  from public.stall_items stock
  join public.inventory_items item on item.id=stock.item_id
  where stock.stall_id=p_stall_id and stock.quantity>0;
  return result;
end
$$;
revoke all on function public.get_public_stall_stock(uuid) from public,anon;
grant execute on function public.get_public_stall_stock(uuid) to authenticated;

create function public.get_my_stall_stock()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid:=auth.uid(); cid uuid; result jsonb;
begin
  select character.id into cid from public.characters character where character.user_id=uid;
  if uid is null or cid is null then raise exception 'CHARACTER_REQUIRED'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',stock.id,'itemId',item.id,'name',item.name,'description',item.description,
    'referenceBuyPrice',stock.reference_buy_price,'priceMinor',stock.price_minor,
    'quantity',stock.quantity
  ) order by item.name),'[]'::jsonb)
    into result
  from public.player_stalls stall
  join public.stall_items stock on stock.stall_id=stall.id
  join public.inventory_items item on item.id=stock.item_id
  where stall.user_id=uid and stall.character_id=cid;
  return result;
end
$$;
revoke all on function public.get_my_stall_stock() from public,anon;
grant execute on function public.get_my_stall_stock() to authenticated;

create function public.manage_my_stall_stock(
  p_action text,p_item_id uuid,p_quantity integer default null,p_price_minor bigint default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid:=auth.uid();
  cid uuid;
  stall public.player_stalls%rowtype;
  item public.inventory_items%rowtype;
  v_stock public.stall_items%rowtype;
  owned public.player_inventory%rowtype;
  current_quantity integer;
  delta integer;
  ref_price bigint;
  target_price bigint;
  listings integer;
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id=uid and not coalesce(account.is_anonymous,false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_action is null or p_action not in ('add','set_price','set_quantity','remove') or p_item_id is null then
    raise exception 'INVALID_STOCK_ACTION';
  end if;
  if p_action in ('add','set_quantity') and (p_quantity is null or p_quantity not between 0 and 999) then
    raise exception 'INVALID_STOCK_QUANTITY';
  end if;
  select character.id into cid from public.characters character where character.user_id=uid for update;
  if cid is null then raise exception 'CHARACTER_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('stall-income:'||uid::text,0));
  select * into stall from public.player_stalls where user_id=uid and character_id=cid for update;
  if not found or not public._market_stall_active(cid,statement_timestamp()) then
    raise exception 'RENT_A_CURRENT_STALL';
  end if;
  if p_action='add' then
    select * into item from public.inventory_items where id=p_item_id for share;
    if not found or not item.sellable or item.buy_price<=0 then raise exception 'ITEM_NOT_SELLABLE'; end if;
    if p_quantity is null or p_quantity<1 or p_quantity>item.max_stack then raise exception 'INVALID_STOCK_QUANTITY'; end if;
    ref_price:=item.buy_price;
    if p_price_minor is null or p_price_minor<ref_price
      or p_price_minor::numeric>ref_price::numeric*5 then
      raise exception 'PRICE_OUT_OF_RANGE';
    end if;
    target_price:=p_price_minor;
    select * into owned from public.player_inventory
      where character_id=cid and item_id=item.id for update;
    if not found or owned.quantity<p_quantity then raise exception 'NOT_ENOUGH_INVENTORY'; end if;
    select item_stock.* into v_stock from public.stall_items item_stock
      where stall_id=stall.id and item_id=item.id for update;
    if found then
      if v_stock.quantity+p_quantity>999 then raise exception 'STALL_STOCK_LIMIT'; end if;
      update public.stall_items set quantity=quantity+p_quantity,
        reference_buy_price=ref_price,price_minor=target_price
        where id=v_stock.id returning * into v_stock;
    else
      select count(*) into listings from public.stall_items where stall_id=stall.id;
      if listings>=20 then raise exception 'STALL_LISTING_LIMIT'; end if;
      insert into public.stall_items(stall_id,item_id,reference_buy_price,price_minor,quantity)
        values(stall.id,item.id,ref_price,target_price,p_quantity) returning * into v_stock;
    end if;
    if owned.quantity=p_quantity then
      delete from public.player_inventory where id=owned.id;
    else
      update public.player_inventory set quantity=quantity-p_quantity where id=owned.id;
    end if;
  else
    select item_stock.* into v_stock from public.stall_items item_stock
      where item_stock.id=p_item_id and item_stock.stall_id=stall.id for update;
    if not found then raise exception 'STALL_ITEM_NOT_FOUND'; end if;
    select * into item from public.inventory_items where id=v_stock.item_id for share;
    if not found then raise exception 'STALL_ITEM_NOT_FOUND'; end if;
    current_quantity:=v_stock.quantity;
    if p_action='set_price' then
      ref_price:=item.buy_price;
      if p_price_minor is null or ref_price<=0 or p_price_minor<ref_price
        or p_price_minor::numeric>ref_price::numeric*5 then
        raise exception 'PRICE_OUT_OF_RANGE';
      end if;
      update public.stall_items set reference_buy_price=ref_price,price_minor=p_price_minor
        where id=v_stock.id returning * into v_stock;
    elsif p_action='set_quantity' then
      delta:=p_quantity-current_quantity;
      if delta>0 then
        select * into owned from public.player_inventory
          where character_id=cid and item_id=item.id for update;
        if not found or owned.quantity<delta then raise exception 'NOT_ENOUGH_INVENTORY'; end if;
        if owned.quantity=delta then delete from public.player_inventory where id=owned.id;
        else update public.player_inventory set quantity=quantity-delta where id=owned.id; end if;
      elsif delta<0 then
        delta:=abs(delta);
        if delta>item.max_stack then raise exception 'INVENTORY_STACK_FULL'; end if;
        select * into owned from public.player_inventory
          where character_id=cid and item_id=item.id for update;
        if found and owned.quantity+delta>item.max_stack then raise exception 'INVENTORY_STACK_FULL'; end if;
        insert into public.player_inventory(user_id,character_id,item_id,quantity)
          values(uid,cid,item.id,delta)
          on conflict(character_id,item_id) do update
            set quantity=public.player_inventory.quantity+excluded.quantity;
      end if;
      update public.stall_items set quantity=p_quantity where id=v_stock.id returning * into v_stock;
    else
      if current_quantity>0 then
        select * into owned from public.player_inventory
          where character_id=cid and item_id=item.id for update;
        if current_quantity>item.max_stack
          or (found and owned.quantity+current_quantity>item.max_stack) then
          raise exception 'INVENTORY_STACK_FULL';
        end if;
        insert into public.player_inventory(user_id,character_id,item_id,quantity)
          values(uid,cid,item.id,current_quantity)
          on conflict(character_id,item_id) do update
            set quantity=public.player_inventory.quantity+excluded.quantity;
      end if;
      delete from public.stall_items where id=v_stock.id;
      return jsonb_build_object('ok',true,'action',p_action,'id',v_stock.id,'quantity',0);
    end if;
  end if;
  return jsonb_build_object('ok',true,'action',p_action,'id',v_stock.id,
    'itemId',v_stock.item_id,'quantity',v_stock.quantity,'priceMinor',v_stock.price_minor);
end
$$;
revoke all on function public.manage_my_stall_stock(text,uuid,integer,bigint) from public,anon;
grant execute on function public.manage_my_stall_stock(text,uuid,integer,bigint) to authenticated;

create function public.purchase_player_stall_item(
  p_request_id uuid,p_stall_item_id uuid,p_quantity integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid:=auth.uid();
  buyer_id uuid;
  seller_id uuid;
  seller_user_id uuid;
  v_stock public.stall_items%rowtype;
  item public.inventory_items%rowtype;
  buyer_wallet public.wallets%rowtype;
  seller_wallet public.wallets%rowtype;
  owned public.player_inventory%rowtype;
  cached jsonb;
  operation text;
  total bigint;
  result jsonb;
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id=uid and not coalesce(account.is_anonymous,false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_request_id is null or p_stall_item_id is null
    or p_quantity is null or p_quantity not between 1 and 20 then raise exception 'INVALID_PURCHASE'; end if;
  select character.id into buyer_id from public.characters character where character.user_id=uid;
  if buyer_id is null then raise exception 'CHARACTER_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(buyer_id::text||p_request_id::text,0));
  select receipt.operation,receipt.result into operation,cached
    from public.economy_request_results receipt
    where receipt.character_id=buyer_id and receipt.request_id=p_request_id;
  if found then
    if operation<>'player_stall_purchase'
      or cached->>'stallItemId'<>p_stall_item_id::text
      or (cached->>'quantity')::integer<>p_quantity then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return cached || jsonb_build_object('duplicate',true);
  end if;
  select stall.character_id,stall.user_id into seller_id,seller_user_id
    from public.stall_items stock
    join public.player_stalls stall on stall.id=stock.stall_id
    where stock.id=p_stall_item_id and stall.is_open
      and public._market_stall_active(stall.character_id,statement_timestamp());
  if not found then raise exception 'STALL_STOCK_UNAVAILABLE'; end if;
  if seller_id=buyer_id or seller_user_id=uid then raise exception 'CANNOT_BUY_OWN_STOCK'; end if;
  perform character.id from public.characters character
    where character.id in (buyer_id,seller_id) order by character.id for update;
  select item_stock.* into v_stock
    from public.stall_items item_stock
    join public.player_stalls stall on stall.id=item_stock.stall_id and stall.is_open
    where item_stock.id=p_stall_item_id and item_stock.quantity>=p_quantity
      and stall.character_id=seller_id and stall.user_id=seller_user_id
      and public._market_stall_active(stall.character_id,statement_timestamp())
    for update of item_stock;
  if not found then raise exception 'STALL_STOCK_UNAVAILABLE'; end if;
  select * into item from public.inventory_items where id=v_stock.item_id;
  if not found then raise exception 'STALL_ITEM_NOT_FOUND'; end if;
  if v_stock.price_minor::numeric*p_quantity::numeric>9223372036854775807 then
    raise exception 'PURCHASE_TOTAL_TOO_LARGE';
  end if;
  total:=(v_stock.price_minor::numeric*p_quantity::numeric)::bigint;
  perform wallet.id from public.wallets wallet
    where wallet.character_id in (buyer_id,seller_id)
    order by wallet.id for update;
  select w.* into buyer_wallet from public.wallets w where w.character_id=buyer_id and w.user_id=uid;
  select w.* into seller_wallet from public.wallets w where w.character_id=seller_id and w.user_id=seller_user_id;
  if buyer_wallet.id is null or buyer_wallet.balance<total then raise exception 'INSUFFICIENT_FUNDS'; end if;
  if seller_wallet.id is null then raise exception 'SELLER_WALLET_UNAVAILABLE'; end if;
  select * into owned from public.player_inventory
    where character_id=buyer_id and item_id=item.id for update;
  if found and owned.quantity+p_quantity>item.max_stack then raise exception 'INVENTORY_STACK_FULL'; end if;
  update public.wallets set balance=balance-total,total_expenses=total_expenses+total,updated_at=now()
    where id=buyer_wallet.id returning * into buyer_wallet;
  update public.wallets set balance=balance+total,total_income=total_income+total,updated_at=now()
    where id=seller_wallet.id returning * into seller_wallet;
  insert into public.player_inventory(user_id,character_id,item_id,quantity)
    values(uid,buyer_id,item.id,p_quantity)
    on conflict(character_id,item_id) do update
      set quantity=public.player_inventory.quantity+excluded.quantity;
  update public.stall_items set quantity=quantity-p_quantity where id=v_stock.id returning * into v_stock;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,buyer_wallet.id,buyer_id,total,'expense','player_stall_purchase',
    'Bought '||item.name||' x'||p_quantity,'purchase','cash','wallet','player_stall',
    buyer_wallet.balance,jsonb_build_object('stall_item_id',v_stock.id,'seller_character_id',seller_id,
      'request_id',p_request_id));
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(seller_user_id,seller_wallet.id,seller_id,total,'income','player_stall_sale',
    'Sold '||item.name||' x'||p_quantity,'income','cash','player_stall','wallet',
    seller_wallet.balance,jsonb_build_object('stall_item_id',v_stock.id,'buyer_character_id',buyer_id,
      'request_id',p_request_id));
  result:=jsonb_build_object('stallItemId',v_stock.id,'itemId',item.id,'itemName',item.name,
    'quantity',p_quantity,'totalMinor',total,'buyerBalance',buyer_wallet.balance,
    'sellerBalance',seller_wallet.balance,'remainingStock',v_stock.quantity);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(buyer_id,p_request_id,'player_stall_purchase',result);
  return result || jsonb_build_object('duplicate',false);
end
$$;
revoke all on function public.purchase_player_stall_item(uuid,uuid,integer) from public,anon;
grant execute on function public.purchase_player_stall_item(uuid,uuid,integer) to authenticated;

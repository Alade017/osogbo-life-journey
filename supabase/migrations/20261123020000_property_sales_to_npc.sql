-- Players can sell an owned home, or their market stall lease, to an NPC buyer.
-- The sale value is a percentage of the property's price, stored as data (not hardcoded).
-- A furnished home sells with its furniture; a stall sells with its stock going back to the seller's bag.

create table if not exists public.property_sale_policy (
  id text primary key default 'default' check (id = 'default'),
  resale_percent integer not null check (resale_percent between 1 and 100),
  updated_at timestamptz not null default now()
);
insert into public.property_sale_policy(id, resale_percent) values ('default', 75)
  on conflict (id) do nothing;
alter table public.property_sale_policy enable row level security;
revoke all on public.property_sale_policy from public, anon, authenticated;

create or replace function public.my_property_sale_quotes()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'playerPropertyId', pp.id,
      'propertyName', gp.name,
      'kind', case when gp.property_type = 'market_stall' then 'stall' else 'home' end,
      'sellable', (pp.tenure = 'owned' and gp.property_type <> 'market_stall')
        or (pp.tenure = 'rented' and gp.property_type = 'market_stall'),
      'amountMinor', floor(
        (case when gp.property_type = 'market_stall' then gp.rent_price else gp.purchase_price end)
        * (select policy.resale_percent from public.property_sale_policy policy where policy.id = 'default')
        / 100.0)::bigint
    ) order by gp.name), '[]'::jsonb)
  from public.player_properties pp
    join public.game_properties gp on gp.id = pp.property_id
  where pp.is_active and pp.character_id = public._my_character_id();
$$;
revoke all on function public.my_property_sale_quotes() from public, anon;
grant execute on function public.my_property_sale_quotes() to authenticated;

create or replace function public.sell_property_to_npc(p_player_property_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  tenancy public.player_properties%rowtype;
  listing public.game_properties%rowtype;
  wallet public.wallets%rowtype;
  house_ids uuid[];
  amount bigint;
  kind text;
  prior_operation text;
  prior jsonb;
  result jsonb;
begin
  if uid is null or not exists (
    select 1 from auth.users account where account.id = uid and not coalesce(account.is_anonymous, false)
  ) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  select character.id into cid from public.characters character where character.user_id = uid;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cid::text || p_request_id::text, 0));
  select receipt.operation, receipt.result into prior_operation, prior
    from public.economy_request_results receipt
    where receipt.character_id = cid and receipt.request_id = p_request_id;
  if found then
    if prior_operation <> 'property_sale_npc' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior || jsonb_build_object('duplicate', true);
  end if;
  perform 1 from public.characters character where character.id = cid for update;

  select * into tenancy from public.player_properties
    where id = p_player_property_id and character_id = cid and is_active for update;
  if not found then raise exception 'NOT_OWNED'; end if;
  select * into listing from public.game_properties where id = tenancy.property_id;

  if listing.property_type = 'market_stall' then
    if tenancy.tenure <> 'rented' then raise exception 'NOT_OWNED'; end if;
    kind := 'stall';
  elsif tenancy.tenure = 'owned' then
    kind := 'home';
  else
    raise exception 'RENTED_HOME_CANNOT_BE_SOLD';
  end if;

  if exists (
    select 1 from public.property_rent_cycles cycle
      where cycle.player_property_id = tenancy.id and cycle.status in ('due', 'grace', 'rescue')
  ) then raise exception 'PAY_OVERDUE_RENT_FIRST'; end if;

  amount := floor(
    (case when kind = 'stall' then listing.rent_price else listing.purchase_price end)
    * (select policy.resale_percent from public.property_sale_policy policy where policy.id = 'default')
    / 100.0)::bigint;
  if amount is null or amount <= 0 then raise exception 'SALE_VALUE_UNAVAILABLE'; end if;

  if kind = 'home' then
    select coalesce(array_agg(house.id), '{}') into house_ids from public.player_houses house
      where house.player_id = uid and house.status in ('active', 'overdue')
        and (house.player_property_id = tenancy.id or house.player_property_id is null)
        and house.house_type_id = listing.house_type_id;
    delete from public.house_placements where player_house_id = any(house_ids);
    update public.player_houses set status = 'ended' where id = any(house_ids);
    delete from public.player_homes where character_id = cid and house_type_id = listing.house_type_id;
  else
    insert into public.player_inventory(user_id, character_id, item_id, quantity)
      select uid, cid, stock.item_id, stock.quantity
        from public.stall_items stock
        join public.player_stalls stall on stall.id = stock.stall_id
        where stall.character_id = cid and stock.quantity > 0
      on conflict (character_id, item_id)
        do update set quantity = public.player_inventory.quantity + excluded.quantity;
    delete from public.stall_items stock using public.player_stalls stall
      where stall.id = stock.stall_id and stall.character_id = cid;
    update public.player_stalls set is_open = false where character_id = cid;
  end if;

  update public.property_rent_cycles set status = 'paid', paid_at = coalesce(paid_at, now())
    where player_property_id = tenancy.id and status = 'current';
  update public.player_properties set is_active = false, is_home = false, updated_at = now()
    where id = tenancy.id;

  select * into wallet from public.wallets where character_id = cid for update;
  if not found then raise exception 'NO_WALLET'; end if;
  update public.wallets set balance = balance + amount, total_income = total_income + amount,
      updated_at = now()
    where id = wallet.id returning * into wallet;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description,
    transaction_type, account, source, destination, balance_after, metadata)
  values (uid, wallet.id, cid, amount, 'income', 'property_sale', 'Sold ' || listing.name || ' to an NPC buyer',
    'income', 'cash', 'property', 'wallet', wallet.balance,
    jsonb_build_object('player_property_id', tenancy.id, 'property_id', listing.id, 'kind', kind,
      'request_id', p_request_id));

  result := jsonb_build_object('ok', true, 'kind', kind, 'propertyName', listing.name,
    'amountMinor', amount, 'balance', wallet.balance, 'duplicate', false);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values (cid, p_request_id, 'property_sale_npc', result);
  return result;
end;
$$;
revoke all on function public.sell_property_to_npc(uuid, uuid) from public, anon;
grant execute on function public.sell_property_to_npc(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';

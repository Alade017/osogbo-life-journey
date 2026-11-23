-- Owners can list an owned home for another player to buy. An NPC can still buy it outright at the
-- resale percentage (see 20261123020000). Stalls are not listed yet: a stall lease carries rent cycles
-- and a stall record, so transferring it needs its own rules.

alter table public.property_sale_policy
  add column if not exists max_asking_percent integer not null default 300
    check (max_asking_percent between 100 and 1000);

create table if not exists public.property_listings (
  id uuid primary key default gen_random_uuid(),
  seller_character_id uuid not null references public.characters(id),
  player_property_id uuid not null references public.player_properties(id),
  asking_minor bigint not null check (asking_minor > 0),
  status text not null default 'open' check (status in ('open', 'sold', 'cancelled')),
  buyer_character_id uuid references public.characters(id),
  created_at timestamptz not null default now(),
  sold_at timestamptz
);
create unique index if not exists property_listings_one_open_per_property
  on public.property_listings(player_property_id) where status = 'open';
alter table public.property_listings enable row level security;
revoke all on public.property_listings from public, anon, authenticated;

create or replace function public.list_property_for_sale(p_player_property_id uuid, p_asking_minor bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
  tenancy public.player_properties%rowtype;
  listing public.game_properties%rowtype;
  created public.property_listings%rowtype;
begin
  select character.id into cid from public.characters character where character.user_id = auth.uid();
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  select * into tenancy from public.player_properties
    where id = p_player_property_id and character_id = cid and is_active for update;
  if not found then raise exception 'NOT_OWNED'; end if;
  select * into listing from public.game_properties where id = tenancy.property_id;
  if listing.property_type = 'market_stall' or tenancy.tenure <> 'owned' then
    raise exception 'ONLY_OWNED_HOMES_CAN_BE_LISTED';
  end if;
  if exists (
    select 1 from public.property_rent_cycles cycle
      where cycle.player_property_id = tenancy.id and cycle.status in ('due', 'grace', 'rescue')
  ) then raise exception 'PAY_OVERDUE_RENT_FIRST'; end if;
  if p_asking_minor is null or p_asking_minor <= 0 then raise exception 'INVALID_PRICE'; end if;
  if p_asking_minor > listing.purchase_price
      * (select policy.max_asking_percent from public.property_sale_policy policy where policy.id = 'default')
      / 100 then raise exception 'PRICE_OUT_OF_RANGE'; end if;

  begin
    insert into public.property_listings(seller_character_id, player_property_id, asking_minor)
      values (cid, tenancy.id, p_asking_minor) returning * into created;
  exception when unique_violation then
    raise exception 'ALREADY_LISTED';
  end;
  return jsonb_build_object('ok', true, 'listingId', created.id, 'askingMinor', created.asking_minor);
end;
$$;
revoke all on function public.list_property_for_sale(uuid, bigint) from public, anon;
grant execute on function public.list_property_for_sale(uuid, bigint) to authenticated;

create or replace function public.cancel_property_listing(p_listing_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  cid uuid;
  cancelled public.property_listings%rowtype;
begin
  select character.id into cid from public.characters character where character.user_id = auth.uid();
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  update public.property_listings set status = 'cancelled'
    where id = p_listing_id and seller_character_id = cid and status = 'open'
    returning * into cancelled;
  if not found then raise exception 'LISTING_NOT_OPEN'; end if;
  return jsonb_build_object('ok', true, 'listingId', cancelled.id);
end;
$$;
revoke all on function public.cancel_property_listing(uuid) from public, anon;
grant execute on function public.cancel_property_listing(uuid) to authenticated;

create or replace function public.property_market_listings()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'listingId', listing.id,
      'playerPropertyId', listing.player_property_id,
      'propertyName', gp.name,
      'askingMinor', listing.asking_minor,
      'sellerName', seller.name,
      'isMine', listing.seller_character_id = public._my_character_id()
    ) order by listing.asking_minor), '[]'::jsonb)
  from public.property_listings listing
    join public.player_properties pp on pp.id = listing.player_property_id
    join public.game_properties gp on gp.id = pp.property_id
    join public.characters seller on seller.id = listing.seller_character_id
  where listing.status = 'open' and pp.is_active;
$$;
revoke all on function public.property_market_listings() from public, anon;
grant execute on function public.property_market_listings() to authenticated;

create or replace function public.buy_property_listing(p_listing_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  buyer uuid;
  seller uuid;
  seller_user uuid;
  listing_row public.property_listings%rowtype;
  tenancy public.player_properties%rowtype;
  listing public.game_properties%rowtype;
  buyer_wallet public.wallets%rowtype;
  seller_wallet public.wallets%rowtype;
  house_ids uuid[];
  prior_operation text;
  prior jsonb;
  result jsonb;
begin
  if uid is null then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_request_id is null then raise exception 'REQUEST_ID_REQUIRED'; end if;
  select character.id into buyer from public.characters character where character.user_id = uid;
  if buyer is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(buyer::text || p_request_id::text, 0));
  select receipt.operation, receipt.result into prior_operation, prior
    from public.economy_request_results receipt
    where receipt.character_id = buyer and receipt.request_id = p_request_id;
  if found then
    if prior_operation <> 'property_buy_listing' then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return prior || jsonb_build_object('duplicate', true);
  end if;

  select * into listing_row from public.property_listings where id = p_listing_id for update;
  if not found or listing_row.status <> 'open' then raise exception 'LISTING_NOT_OPEN'; end if;
  if listing_row.seller_character_id = buyer then raise exception 'CANNOT_BUY_OWN_LISTING'; end if;
  perform 1 from public.characters character where character.id = buyer for update;

  select * into tenancy from public.player_properties where id = listing_row.player_property_id for update;
  if not found or not tenancy.is_active or tenancy.tenure <> 'owned' then raise exception 'NOT_FOR_SALE'; end if;
  select * into listing from public.game_properties where id = tenancy.property_id;
  if listing.property_type = 'market_stall' then raise exception 'NOT_FOR_SALE'; end if;
  if exists (
    select 1 from public.property_rent_cycles cycle
      where cycle.player_property_id = tenancy.id and cycle.status in ('due', 'grace', 'rescue')
  ) then raise exception 'PAY_OVERDUE_RENT_FIRST'; end if;

  if exists (
    select 1 from public.player_properties owned join public.game_properties kind on kind.id = owned.property_id
      where owned.character_id = buyer and owned.is_active and kind.property_type <> 'market_stall'
  ) or exists (
    select 1 from public.player_houses house where house.player_id = uid and house.status in ('active', 'overdue')
  ) or exists (
    select 1 from public.player_homes home where home.character_id = buyer
  ) then raise exception 'ALREADY_HAS_HOME'; end if;

  select * into buyer_wallet from public.wallets where character_id = buyer for update;
  if not found then raise exception 'NO_WALLET'; end if;
  if buyer_wallet.balance < listing_row.asking_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;
  select character.id, character.user_id into seller, seller_user
    from public.characters character where character.id = listing_row.seller_character_id;
  select * into seller_wallet from public.wallets where character_id = seller for update;
  if not found then raise exception 'NO_WALLET'; end if;

  -- The home, its furniture and its legacy home rows move to the buyer together.
  select coalesce(array_agg(house.id), '{}') into house_ids from public.player_houses house
    where house.player_id = seller_user and house.status in ('active', 'overdue')
      and (house.player_property_id = tenancy.id or house.player_property_id is null)
      and house.house_type_id = listing.house_type_id;
  update public.player_houses set player_id = uid, player_property_id = tenancy.id
    where id = any(house_ids);
  update public.player_homes set character_id = buyer, user_id = uid
    where character_id = seller and house_type_id = listing.house_type_id;
  update public.property_rent_cycles set character_id = buyer where player_property_id = tenancy.id;
  update public.player_properties set character_id = buyer, user_id = uid, is_home = false, updated_at = now()
    where id = tenancy.id;

  update public.wallets set balance = balance - listing_row.asking_minor,
      total_expenses = total_expenses + listing_row.asking_minor, updated_at = now()
    where id = buyer_wallet.id returning * into buyer_wallet;
  update public.wallets set balance = balance + listing_row.asking_minor,
      total_income = total_income + listing_row.asking_minor, updated_at = now()
    where id = seller_wallet.id returning * into seller_wallet;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description,
    transaction_type, account, source, destination, balance_after, metadata)
  values (uid, buyer_wallet.id, buyer, listing_row.asking_minor, 'expense', 'property_purchase',
    'Bought ' || listing.name || ' from a player', 'purchase', 'cash', 'wallet', 'property',
    buyer_wallet.balance, jsonb_build_object('listing_id', listing_row.id, 'request_id', p_request_id));
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description,
    transaction_type, account, source, destination, balance_after, metadata)
  values (seller_user, seller_wallet.id, seller, listing_row.asking_minor, 'income', 'property_sale',
    'Sold ' || listing.name || ' to a player', 'income', 'cash', 'property', 'wallet',
    seller_wallet.balance, jsonb_build_object('listing_id', listing_row.id, 'request_id', p_request_id));

  update public.property_listings set status = 'sold', buyer_character_id = buyer, sold_at = now()
    where id = listing_row.id;
  result := jsonb_build_object('ok', true, 'propertyName', listing.name,
    'amountMinor', listing_row.asking_minor, 'balance', buyer_wallet.balance, 'duplicate', false);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values (buyer, p_request_id, 'property_buy_listing', result);
  return result;
end;
$$;
revoke all on function public.buy_property_listing(uuid, uuid) from public, anon;
grant execute on function public.buy_property_listing(uuid, uuid) to authenticated;
notify pgrst, 'reload schema';

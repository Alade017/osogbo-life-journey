-- Milestone 4.1: extend the existing wallet, transaction, and shared item catalog.
-- No player/account/inventory replacement tables are introduced.

alter table public.wallets
  add column if not exists bank_balance bigint not null default 0;
alter table public.wallets drop constraint if exists wallets_bank_balance_nonnegative;
alter table public.wallets add constraint wallets_bank_balance_nonnegative check (bank_balance >= 0);

alter table public.transactions
  add column if not exists transaction_type text,
  add column if not exists account text not null default 'cash',
  add column if not exists source text,
  add column if not exists destination text,
  add column if not exists balance_after bigint,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.transactions
set transaction_type = case
  when category = 'deposit' then 'deposit'
  when category = 'withdrawal' then 'withdrawal'
  when category = 'purchase' then 'purchase'
  when category = 'sale' then 'sale'
  when kind = 'income' then 'income'
  else 'expense'
end
where transaction_type is null;
-- Keep the type nullable at INSERT time so the BEFORE trigger can derive income
-- versus expense for older RPCs that do not yet send the new field.
alter table public.transactions alter column transaction_type drop default;
alter table public.transactions alter column transaction_type set not null;
alter table public.transactions drop constraint if exists transactions_account_valid;
alter table public.transactions add constraint transactions_account_valid check (account in ('cash','bank'));
alter table public.transactions drop constraint if exists transactions_balance_after_nonnegative;
alter table public.transactions add constraint transactions_balance_after_nonnegative
  check (balance_after is null or balance_after >= 0);
create index if not exists transactions_character_created_idx
  on public.transactions(character_id, created_at desc);
create index if not exists transactions_wallet_account_created_idx
  on public.transactions(wallet_id, account, created_at desc);

-- Old economic RPCs continue writing the existing transactions table. This trigger
-- enriches their rows without requiring each Milestone 1-3 function to be replaced.
create or replace function public._enrich_transaction()
returns trigger language plpgsql security invoker set search_path = public as $$
declare cash_after bigint; bank_after bigint;
begin
  if new.transaction_type is null then
    new.transaction_type := case
      when new.category = 'deposit' then 'deposit'
      when new.category = 'withdrawal' then 'withdrawal'
      when new.category = 'purchase' then 'purchase'
      when new.category = 'sale' then 'sale'
      when new.kind = 'income' then 'income'
      else 'expense'
    end;
  end if;
  select balance, bank_balance into cash_after, bank_after
  from public.wallets where id = new.wallet_id;
  if new.balance_after is null then
    new.balance_after := case when new.account = 'bank' then bank_after else cash_after end;
  end if;
  if new.source is null then
    new.source := case when new.kind = 'income' then 'game' else new.category end;
  end if;
  if new.destination is null then
    new.destination := case when new.kind = 'income' then 'cash' else 'game' end;
  end if;
  return new;
end $$;
drop trigger if exists t_transactions_economy_fields on public.transactions;
create trigger t_transactions_economy_fields before insert on public.transactions
  for each row execute function public._enrich_transaction();
revoke execute on function public._enrich_transaction() from public, anon, authenticated;

alter table public.inventory_items
  add column if not exists buy_price bigint not null default 0,
  add column if not exists sell_price bigint not null default 0,
  add column if not exists sellable boolean not null default false;
alter table public.inventory_items drop constraint if exists inventory_items_prices_nonnegative;
alter table public.inventory_items add constraint inventory_items_prices_nonnegative
  check (buy_price >= 0 and sell_price >= 0 and (sellable = false or sell_price > 0));

update public.inventory_items set buy_price = 500, sell_price = 300, sellable = true
where slug = 'water_bottle';
update public.inventory_items set buy_price = 3000, sell_price = 1500, sellable = true
where slug = 'basic_outfit';
update public.inventory_items set buy_price = 5000, sell_price = 2500, sellable = true
where slug = 'backpack';
update public.inventory_items set buy_price = 25000, sell_price = 12500, sellable = true
where slug = 'phone';

insert into public.inventory_items
  (slug, name, description, category, icon, value, stackable, max_stack, usable, equippable,
   equipment_slot, effects, buy_price, sell_price, sellable)
values
  ('meat_pie', 'Meat Pie', 'A warm bakery snack from a local Osogbo vendor.', 'food', 'sandwich', 1200,
   true, 20, true, false, null, '{"stat_changes":{"hunger":-25},"time_minutes":3}'::jsonb, 1200, 600, true),
  ('jollof_rice', 'Jollof Rice', 'A filling plate of peppered rice for a busy day in town.', 'food', 'bowl-food', 2500,
   false, 1, true, false, null, '{"stat_changes":{"hunger":-45},"time_minutes":5}'::jsonb, 2500, 1250, true)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, category = excluded.category,
  icon = excluded.icon, value = excluded.value, stackable = excluded.stackable,
  max_stack = excluded.max_stack, usable = excluded.usable, equippable = excluded.equippable,
  equipment_slot = excluded.equipment_slot, effects = excluded.effects,
  buy_price = excluded.buy_price, sell_price = excluded.sell_price, sellable = excluded.sellable;

create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  location_id uuid not null references public.locations(id) on delete restrict,
  game_place_id uuid unique references public.game_places(id) on delete restrict,
  category text not null,
  opening_hour smallint not null default 8 check (opening_hour between 0 and 23),
  closing_hour smallint not null default 20 check (closing_hour between 0 and 23),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opening_hour <> closing_hour)
);
create index if not exists shops_location_active_idx on public.shops(location_id) where is_open;
create trigger t_shops before update on public.shops for each row execute function public.touch_updated_at();
alter table public.shops enable row level security;
grant select on public.shops to authenticated;
grant all on public.shops to service_role;
drop policy if exists "active shops readable" on public.shops;
create policy "active shops readable" on public.shops for select to authenticated using (is_open);

create table if not exists public.shop_items (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  buy_price bigint check (buy_price is null or buy_price > 0),
  sell_price bigint check (sell_price is null or sell_price > 0),
  stock integer check (stock is null or stock >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, item_id)
);
create index if not exists shop_items_shop_available_idx on public.shop_items(shop_id, item_id)
  where is_available;
create trigger t_shop_items before update on public.shop_items
  for each row execute function public.touch_updated_at();
alter table public.shop_items enable row level security;
grant select on public.shop_items to authenticated;
grant all on public.shop_items to service_role;
drop policy if exists "available shop items readable" on public.shop_items;
create policy "available shop items readable" on public.shop_items
  for select to authenticated using (is_available);

-- Build stores from the existing venue catalog, keeping item definitions shared.
insert into public.shops(slug, name, location_id, game_place_id, category)
select gp.slug, gp.name, gp.location_id, gp.id, gp.category
from public.game_places gp
where gp.category in ('market','supermarket','food-market','electronics','phone-store','clothing')
on conflict (slug) do update set
  name = excluded.name, location_id = excluded.location_id,
  game_place_id = excluded.game_place_id, category = excluded.category;

insert into public.shop_items(shop_id, item_id)
select s.id, i.id
from public.shops s
join public.inventory_items i on
  (s.category in ('market','supermarket','food-market') and i.slug in ('water_bottle','meat_pie','jollof_rice'))
  or (s.category = 'electronics' and i.slug = 'phone')
  or (s.category = 'phone-store' and i.slug = 'phone')
  or (s.category = 'clothing' and i.slug = 'basic_outfit')
on conflict (shop_id, item_id) do nothing;

create or replace function public._economy_shop_is_open(p_shop public.shops, p_hour integer)
returns boolean language sql immutable security invoker set search_path = public as $$
  select p_shop.is_open and case
    when p_shop.opening_hour < p_shop.closing_hour
      then p_hour >= p_shop.opening_hour and p_hour < p_shop.closing_hour
    else p_hour >= p_shop.opening_hour or p_hour < p_shop.closing_hour
  end
$$;

create or replace function public._require_bank_location(p_char uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.characters c join public.game_places p on p.location_id = c.current_location_id
    where c.id = p_char and p.category in ('bank','atm')
  ) then raise exception 'Visit Osun Unity Bank before using bank services'; end if;
end $$;

create or replace function public.deposit_cash(p_amount bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); c public.characters%rowtype;
  w public.wallets%rowtype; cash_after bigint; bank_after bigint; clock jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  select * into c from public.characters where id = cid and user_id = uid for update;
  if not found then raise exception 'Character not found'; end if;
  perform public._require_bank_location(cid);
  select * into w from public.wallets where character_id = cid and user_id = uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if w.balance < p_amount then raise exception 'Insufficient cash'; end if;
  cash_after := w.balance - p_amount; bank_after := w.bank_balance + p_amount;
  update public.wallets set balance = cash_after, bank_balance = bank_after where id = w.id;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category,
    description, transaction_type, account, source, destination, balance_after, metadata)
  values (uid, w.id, cid, p_amount, 'expense', 'deposit', 'Deposit to Osogbo City Bank',
    'deposit', 'cash', 'cash', 'bank', cash_after, jsonb_build_object('bank_balance_after', bank_after));
  clock := public._advance_character_game_time(cid, 3);
  return jsonb_build_object('cash', cash_after, 'bank', bank_after, 'amount', p_amount, 'game_time', clock);
end $$;

create or replace function public.withdraw_cash(p_amount bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); c public.characters%rowtype;
  w public.wallets%rowtype; cash_after bigint; bank_after bigint; clock jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Enter an amount greater than zero'; end if;
  select * into c from public.characters where id = cid and user_id = uid for update;
  if not found then raise exception 'Character not found'; end if;
  perform public._require_bank_location(cid);
  select * into w from public.wallets where character_id = cid and user_id = uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if w.bank_balance < p_amount then raise exception 'Insufficient bank balance'; end if;
  cash_after := w.balance + p_amount; bank_after := w.bank_balance - p_amount;
  update public.wallets set balance = cash_after, bank_balance = bank_after where id = w.id;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category,
    description, transaction_type, account, source, destination, balance_after, metadata)
  values (uid, w.id, cid, p_amount, 'income', 'withdrawal', 'Withdrawal from Osogbo City Bank',
    'withdrawal', 'cash', 'bank', 'cash', cash_after, jsonb_build_object('bank_balance_after', bank_after));
  clock := public._advance_character_game_time(cid, 3);
  return jsonb_build_object('cash', cash_after, 'bank', bank_after, 'amount', p_amount, 'game_time', clock);
end $$;

create or replace function public.purchase_shop_item(p_shop_item_id uuid, p_quantity integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); c public.characters%rowtype;
  w public.wallets%rowtype; offer public.shop_items%rowtype; shop public.shops%rowtype;
  item public.inventory_items%rowtype; owned public.player_inventory%rowtype;
  price bigint; total bigint; cash_after bigint; new_stock integer; clock jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then raise exception 'Choose a quantity from 1 to 99'; end if;
  select * into c from public.characters where id = cid and user_id = uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into offer from public.shop_items where id = p_shop_item_id and is_available for update;
  if not found then raise exception 'This item is no longer available'; end if;
  select * into shop from public.shops where id = offer.shop_id;
  if not found or not public._economy_shop_is_open(shop, c.game_time_hour) then raise exception 'This shop is closed'; end if;
  if c.current_location_id is distinct from shop.location_id then raise exception 'Travel to this shop before purchasing'; end if;
  select * into item from public.inventory_items where id = offer.item_id;
  if not found then raise exception 'Item not found'; end if;
  price := coalesce(offer.buy_price, item.buy_price);
  if price <= 0 then raise exception 'This item is not for sale'; end if;
  if not item.stackable and p_quantity <> 1 then raise exception 'This item can only be purchased one at a time'; end if;
  if p_quantity > item.max_stack then raise exception 'That quantity exceeds the item stack limit'; end if;
  if offer.stock is not null and offer.stock < p_quantity then raise exception 'Not enough stock'; end if;
  total := price * p_quantity;
  select * into w from public.wallets where character_id = cid and user_id = uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  if w.balance < total then raise exception 'Insufficient cash'; end if;
  select * into owned from public.player_inventory where character_id = cid and item_id = item.id for update;
  if found and owned.quantity + p_quantity > item.max_stack then raise exception 'Your inventory stack is full'; end if;
  cash_after := w.balance - total;
  update public.wallets set balance = cash_after, total_expenses = total_expenses + total where id = w.id;
  insert into public.player_inventory(user_id, character_id, item_id, quantity)
    values (uid, cid, item.id, p_quantity)
    on conflict (character_id, item_id) do update
      set quantity = public.player_inventory.quantity + excluded.quantity;
  if offer.stock is not null then
    update public.shop_items set stock = stock - p_quantity where id = offer.id returning stock into new_stock;
  end if;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category,
    description, transaction_type, account, source, destination, balance_after, metadata)
  values (uid, w.id, cid, total, 'expense', 'purchase', 'Bought ' || item.name || ' x' || p_quantity,
    'purchase', 'cash', shop.name, 'inventory', cash_after,
    jsonb_build_object('shop_id', shop.id, 'shop_item_id', offer.id, 'item_id', item.id,
      'quantity', p_quantity, 'unit_price', price));
  clock := public._advance_character_game_time(cid, greatest(2, p_quantity * 2));
  return jsonb_build_object('item', item.name, 'quantity', p_quantity, 'unit_price', price,
    'total', total, 'cash', cash_after, 'game_time', clock);
end $$;

create or replace function public.sell_inventory_item(p_shop_id uuid, p_inventory_id uuid, p_quantity integer)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); c public.characters%rowtype;
  w public.wallets%rowtype; shop public.shops%rowtype; offer public.shop_items%rowtype;
  owned public.player_inventory%rowtype; item public.inventory_items%rowtype;
  price bigint; total bigint; cash_after bigint; clock jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 99 then raise exception 'Choose a quantity from 1 to 99'; end if;
  select * into c from public.characters where id = cid and user_id = uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into shop from public.shops where id = p_shop_id and is_open for share;
  if not found or not public._economy_shop_is_open(shop, c.game_time_hour) then raise exception 'This shop is closed'; end if;
  if c.current_location_id is distinct from shop.location_id then raise exception 'Travel to this shop before selling'; end if;
  select * into owned from public.player_inventory where id = p_inventory_id and character_id = cid and user_id = uid for update;
  if not found or owned.quantity < p_quantity then raise exception 'You do not own that quantity'; end if;
  select * into item from public.inventory_items where id = owned.item_id;
  if not found or not item.sellable then raise exception 'This item cannot be sold'; end if;
  if exists (select 1 from public.player_equipment where character_id = cid and item_id = item.id) then
    raise exception 'Unequip this item before selling it';
  end if;
  select * into offer from public.shop_items where shop_id = shop.id and item_id = item.id and is_available for update;
  if not found then raise exception 'This shop does not buy that item'; end if;
  price := coalesce(offer.sell_price, item.sell_price);
  if price <= 0 then raise exception 'This item has no sale price'; end if;
  total := price * p_quantity;
  select * into w from public.wallets where character_id = cid and user_id = uid for update;
  if not found then raise exception 'Wallet not found'; end if;
  cash_after := w.balance + total;
  update public.wallets set balance = cash_after, total_income = total_income + total where id = w.id;
  if owned.quantity = p_quantity then delete from public.player_inventory where id = owned.id;
  else update public.player_inventory set quantity = quantity - p_quantity where id = owned.id; end if;
  if offer.stock is not null then update public.shop_items set stock = stock + p_quantity where id = offer.id; end if;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category,
    description, transaction_type, account, source, destination, balance_after, metadata)
  values (uid, w.id, cid, total, 'income', 'sale', 'Sold ' || item.name || ' x' || p_quantity,
    'sale', 'cash', 'inventory', shop.name, cash_after,
    jsonb_build_object('shop_id', shop.id, 'shop_item_id', offer.id, 'item_id', item.id,
      'quantity', p_quantity, 'unit_price', price));
  clock := public._advance_character_game_time(cid, greatest(2, p_quantity * 2));
  return jsonb_build_object('item', item.name, 'quantity', p_quantity, 'unit_price', price,
    'total', total, 'cash', cash_after, 'game_time', clock);
end $$;

revoke execute on function public._economy_shop_is_open(public.shops, integer) from public, anon, authenticated;
revoke execute on function public._require_bank_location(uuid) from public, anon, authenticated;
revoke execute on function public.deposit_cash(bigint) from public, anon;
revoke execute on function public.withdraw_cash(bigint) from public, anon;
revoke execute on function public.purchase_shop_item(uuid, integer) from public, anon;
revoke execute on function public.sell_inventory_item(uuid, uuid, integer) from public, anon;
grant execute on function public.deposit_cash(bigint) to authenticated;
grant execute on function public.withdraw_cash(bigint) to authenticated;
grant execute on function public.purchase_shop_item(uuid, integer) to authenticated;
grant execute on function public.sell_inventory_item(uuid, uuid, integer) to authenticated;

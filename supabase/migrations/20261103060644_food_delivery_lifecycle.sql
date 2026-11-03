-- Food/ride tables are introduced by Drizzle 0060. Keep this additive migration
-- explicit about that cross-history prerequisite rather than recreating the schema.
do $$
begin
  if to_regclass('public.food_orders') is null
    or to_regclass('public.food_order_items') is null
    or to_regclass('public.food_vendors') is null
    or to_regclass('public.food_menu_items') is null
    or to_regclass('public.okada_ride_requests') is null
    or to_regclass('public.wallets') is null
    or to_regclass('public.transactions') is null
    or to_regclass('public.economy_request_results') is null
    or to_regclass('public.town_service_prices') is null
    or to_regclass('public.characters') is null
    or to_regclass('public.player_properties') is null
    or to_regclass('public.game_properties') is null
    or to_regclass('public.player_houses') is null
    or to_regprocedure('public._my_character_id()') is null then
    raise exception 'Apply Drizzle migration 0060_phone_community_apps.sql and its base prerequisites before food delivery lifecycle';
  end if;
end
$$;

alter table public.food_orders
  add column if not exists delivery_state text not null default 'pending'
    check (delivery_state in ('pending', 'awaiting_response', 'approaching', 'package_waiting', 'collected', 'cancelled')),
  add column if not exists delivery_choice text
    check (delivery_choice is null or delivery_choice in ('inside', 'outside')),
  add column if not exists delivery_eta_at timestamptz not null default now() + interval '30 seconds',
  add column if not exists delivery_arrived_at timestamptz,
  add column if not exists handoff_due_at timestamptz,
  add column if not exists handoff_completed_at timestamptz,
  add column if not exists package_collected_at timestamptz;

create index if not exists food_orders_due_delivery_idx
  on public.food_orders(character_id, delivery_eta_at)
  where status = 'preparing' and delivery_state = 'pending';
create index if not exists food_orders_open_delivery_idx
  on public.food_orders(character_id, created_at)
  where delivery_state in ('awaiting_response', 'approaching', 'package_waiting');

-- Existing requests were already charged once. Approve them without touching wallets.
update public.food_orders
set status = 'preparing',
    delivery_state = 'pending',
    delivery_eta_at = now()
where status = 'requested';

update public.food_orders
set delivery_eta_at = now()
where status = 'preparing' and delivery_state = 'pending';

update public.food_orders
set delivery_state = 'collected',
    package_collected_at = coalesce(package_collected_at, created_at)
where status = 'delivered';

update public.food_orders
set delivery_state = 'cancelled'
where status = 'cancelled';

update public.okada_ride_requests
set status = 'assigned'
where status = 'requested';

create or replace function public.request_food_delivery(
  p_vendor_id uuid,
  p_items jsonb,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  vendor public.food_vendors%rowtype;
  wallet public.wallets%rowtype;
  line record;
  item public.food_menu_items%rowtype;
  total bigint := 0;
  order_id uuid;
  cash_after bigint;
  result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null or p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Choose menu items and include a request ID';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'Choose menu items and include a request ID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select er.result into result
  from public.economy_request_results er
  where er.character_id = cid and er.request_id = p_request_id and er.operation = 'food_delivery';
  if found then
    return jsonb_set(
      result,
      '{status}',
      to_jsonb(coalesce(
        (select o.status from public.food_orders o
         where o.id = (result ->> 'orderId')::uuid and o.user_id = uid),
        result ->> 'status'
      ))
    );
  end if;

  select * into vendor from public.food_vendors where id = p_vendor_id and active for update;
  if not found then raise exception 'Vendor is unavailable'; end if;
  for line in
    select * from jsonb_to_recordset(p_items) as x(menu_item_id uuid, quantity integer)
  loop
    if line.quantity is null or line.quantity not between 1 and 20 then
      raise exception 'Each food quantity must be from 1 to 20';
    end if;
    select * into item from public.food_menu_items
    where id = line.menu_item_id and vendor_id = vendor.id and active;
    if not found then raise exception 'Menu item is unavailable'; end if;
    total := total + item.price_minor * line.quantity;
  end loop;

  select * into wallet
  from public.wallets
  where character_id = cid and user_id = uid
  for update;
  if not found or wallet.balance < total then raise exception 'Insufficient cash'; end if;
  cash_after := wallet.balance - total;
  update public.wallets
  set balance = cash_after, total_expenses = total_expenses + total
  where id = wallet.id;

  insert into public.food_orders(user_id, character_id, vendor_id, total_minor, status)
  values (uid, cid, vendor.id, total, 'preparing')
  returning id into order_id;

  for line in
    select * from jsonb_to_recordset(p_items) as x(menu_item_id uuid, quantity integer)
  loop
    select * into item from public.food_menu_items where id = line.menu_item_id;
    insert into public.food_order_items(order_id, menu_item_id, quantity, unit_price_minor)
    values (order_id, item.id, line.quantity, item.price_minor);
  end loop;

  insert into public.transactions(
    user_id, wallet_id, character_id, amount, kind, category, description,
    transaction_type, account, source, destination, balance_after, metadata
  )
  values (
    uid, wallet.id, cid, total, 'expense', 'food_delivery',
    'Food delivery from ' || vendor.name, 'purchase', 'cash', vendor.name,
    'food_delivery', cash_after,
    jsonb_build_object('order_id', order_id, 'request_id', p_request_id)
  );
  result := jsonb_build_object(
    'orderId', order_id, 'total', total, 'cash', cash_after, 'status', 'preparing'
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
  values (cid, p_request_id, 'food_delivery', result);
  return result;
end
$$;

create or replace function public.request_okada_ride(p_destination text, p_request_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
  values (uid, cid, destination_text, fare, 'assigned')
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
    'rideId', ride_id, 'fare', fare, 'cash', cash_after, 'status', 'assigned'
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
  values (cid, p_request_id, 'okada_ride', result);
  return result;
end
$$;

create or replace function public.process_home_food_deliveries()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  home_id uuid;
  deliveries jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;

  select c.inside_home_property_id into home_id
  from public.characters c
  where c.id = cid and c.user_id = uid
  for update;

  if home_id is null or not exists (
    select 1
    from public.player_properties tenancy
    join public.game_properties listing on listing.id = tenancy.property_id
    join public.player_houses room on room.player_property_id = tenancy.id
    join public.characters c on c.id = tenancy.character_id
    where tenancy.id = home_id
      and tenancy.character_id = cid
      and tenancy.user_id = uid
      and tenancy.is_active
      and tenancy.is_home
      and listing.house_type_id is not null
      and listing.location_id = c.current_location_id
      and room.player_id = uid
      and room.status in ('active', 'overdue')
  ) then
    return '[]'::jsonb;
  end if;

  update public.food_orders o
  set status = 'delivered',
      delivery_state = 'package_waiting',
      handoff_completed_at = now()
  where o.user_id = uid
    and o.character_id = cid
    and o.delivery_state = 'approaching'
    and o.handoff_due_at <= now();

  if not exists (
    select 1
    from public.food_orders o
    where o.user_id = uid
      and o.character_id = cid
      and o.delivery_state in ('awaiting_response', 'approaching')
  ) then
    update public.food_orders o
    set delivery_state = 'awaiting_response',
        delivery_arrived_at = now()
    where o.id = (
      select next_order.id
      from public.food_orders next_order
      where next_order.user_id = uid
        and next_order.character_id = cid
        and next_order.status = 'preparing'
        and next_order.delivery_state = 'pending'
        and next_order.delivery_eta_at <= now()
      order by next_order.created_at
      limit 1
      for update
    );
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'status', o.status,
        'deliveryState', o.delivery_state,
        'deliveryChoice', o.delivery_choice,
        'totalMinor', o.total_minor,
        'createdAt', o.created_at,
        'vendorName', v.name,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object('name', m.name, 'quantity', i.quantity)
            order by m.name
          )
          from public.food_order_items i
          join public.food_menu_items m on m.id = i.menu_item_id
          where i.order_id = o.id
        ), '[]'::jsonb)
      )
      order by o.created_at
    ),
    '[]'::jsonb
  )
  into deliveries
  from public.food_orders o
  join public.food_vendors v on v.id = o.vendor_id
  where o.user_id = uid
    and o.character_id = cid
    and o.delivery_state in ('awaiting_response', 'approaching', 'package_waiting');

  return deliveries;
end
$$;

create or replace function public.respond_to_home_food_delivery(p_order_id uuid, p_choice text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  home_id uuid;
  current_state text;
  current_choice text;
  due_at timestamptz;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_order_id is null or p_choice is null or p_choice not in ('inside', 'outside') then
    raise exception 'Choose whether to invite the courier inside or receive the order outside';
  end if;

  select c.inside_home_property_id into home_id
  from public.characters c
  where c.id = cid and c.user_id = uid
  for update;
  if home_id is null or not exists (
    select 1
    from public.player_properties tenancy
    join public.game_properties listing on listing.id = tenancy.property_id
    join public.player_houses room on room.player_property_id = tenancy.id
    join public.characters c on c.id = tenancy.character_id
    where tenancy.id = home_id
      and tenancy.character_id = cid
      and tenancy.user_id = uid
      and tenancy.is_active
      and tenancy.is_home
      and listing.house_type_id is not null
      and listing.location_id = c.current_location_id
      and room.player_id = uid
      and room.status in ('active', 'overdue')
  ) then
    raise exception 'Enter your home before answering the courier';
  end if;

  update public.food_orders o
  set delivery_state = 'approaching',
      delivery_choice = p_choice,
      handoff_due_at = now() + interval '3 seconds'
  where o.id = p_order_id
    and o.user_id = uid
    and o.character_id = cid
    and o.delivery_state = 'awaiting_response'
  returning o.delivery_state, o.delivery_choice, o.handoff_due_at
  into current_state, current_choice, due_at;

  if not found then
    select o.delivery_state, o.delivery_choice, o.handoff_due_at
    into current_state, current_choice, due_at
    from public.food_orders o
    where o.id = p_order_id and o.user_id = uid and o.character_id = cid;
    if not found or current_state <> 'approaching' or current_choice <> p_choice then
      raise exception 'This food delivery is no longer waiting for a response';
    end if;
  end if;

  return jsonb_build_object(
    'orderId', p_order_id,
    'deliveryState', current_state,
    'deliveryChoice', current_choice,
    'handoffDueAt', due_at
  );
end
$$;

create or replace function public.collect_home_food_delivery(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  home_id uuid;
  collected_at timestamptz;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_order_id is null then raise exception 'Choose a food package to collect'; end if;

  select c.inside_home_property_id into home_id
  from public.characters c
  where c.id = cid and c.user_id = uid
  for update;
  if home_id is null or not exists (
    select 1
    from public.player_properties tenancy
    join public.game_properties listing on listing.id = tenancy.property_id
    join public.player_houses room on room.player_property_id = tenancy.id
    join public.characters c on c.id = tenancy.character_id
    where tenancy.id = home_id
      and tenancy.character_id = cid
      and tenancy.user_id = uid
      and tenancy.is_active
      and tenancy.is_home
      and listing.house_type_id is not null
      and listing.location_id = c.current_location_id
      and room.player_id = uid
      and room.status in ('active', 'overdue')
  ) then
    raise exception 'Enter your home before collecting the food package';
  end if;

  update public.food_orders o
  set delivery_state = 'collected',
      package_collected_at = now()
  where o.id = p_order_id
    and o.user_id = uid
    and o.character_id = cid
    and o.status = 'delivered'
    and o.delivery_state = 'package_waiting'
  returning o.package_collected_at into collected_at;

  if not found then
    select o.package_collected_at into collected_at
    from public.food_orders o
    where o.id = p_order_id
      and o.user_id = uid
      and o.character_id = cid
      and o.delivery_state = 'collected';
    if not found then raise exception 'This food package is no longer available'; end if;
  end if;

  return jsonb_build_object(
    'orderId', p_order_id,
    'deliveryState', 'collected',
    'collectedAt', collected_at
  );
end
$$;

create or replace function public.get_food_delivery_history()
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  history jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'totalMinor', o.total_minor,
        'status', o.status,
        'deliveryState', o.delivery_state,
        'createdAt', o.created_at,
        'vendorName', v.name,
        'items', coalesce((
          select jsonb_agg(
            jsonb_build_object('name', m.name, 'quantity', i.quantity)
            order by m.name
          )
          from public.food_order_items i
          join public.food_menu_items m on m.id = i.menu_item_id
          where i.order_id = o.id
        ), '[]'::jsonb)
      )
      order by o.created_at desc
    ),
    '[]'::jsonb
  )
  into history
  from (
    select *
    from public.food_orders
    where user_id = uid and character_id = cid
    order by created_at desc
    limit 20
  ) o
  join public.food_vendors v on v.id = o.vendor_id;

  return history;
end
$$;

revoke all on function public.request_food_delivery(uuid, jsonb, uuid),
  public.request_okada_ride(text, uuid),
  public.process_home_food_deliveries(),
  public.respond_to_home_food_delivery(uuid, text),
  public.collect_home_food_delivery(uuid),
  public.get_food_delivery_history()
from public, anon;
grant execute on function public.request_food_delivery(uuid, jsonb, uuid),
  public.request_okada_ride(text, uuid),
  public.process_home_food_deliveries(),
  public.respond_to_home_food_delivery(uuid, text),
  public.collect_home_food_delivery(uuid),
  public.get_food_delivery_history()
to authenticated;

notify pgrst, 'reload schema';
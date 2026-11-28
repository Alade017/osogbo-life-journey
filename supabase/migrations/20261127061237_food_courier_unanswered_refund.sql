-- Courier leaves after 60 seconds without an answer; the order is refunded.
-- A courier who is not answered within 60 seconds leaves. The order is cancelled and the paid
-- total is refunded to the same character's cash, with a matching income transaction.
create or replace function public._expire_unanswered_food_couriers(uid uuid, cid uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  expired record;
  refund_wallet public.wallets%rowtype;
begin
  for expired in
    select o.id, o.total_minor, o.vendor_id
    from public.food_orders o
    where o.user_id = uid
      and o.character_id = cid
      and o.delivery_state = 'awaiting_response'
      and o.delivery_arrived_at <= now() - interval '60 seconds'
    for update skip locked
  loop
    update public.food_orders
    set status = 'cancelled', delivery_state = 'cancelled'
    where id = expired.id;

    select * into refund_wallet
    from public.wallets
    where character_id = cid and user_id = uid
    for update;
    if found then
      update public.wallets
      set balance = balance + expired.total_minor,
          total_expenses = greatest(0, total_expenses - expired.total_minor)
      where id = refund_wallet.id;

      insert into public.transactions(
        user_id, wallet_id, character_id, amount, kind, category, description,
        transaction_type, account, source, destination, balance_after, metadata
      )
      values (
        uid, refund_wallet.id, cid, expired.total_minor, 'income', 'food_delivery_refund',
        'Refund: courier left without an answer', 'refund', 'cash', 'food_delivery', 'cash',
        refund_wallet.balance + expired.total_minor,
        jsonb_build_object('order_id', expired.id)
      );
    end if;
  end loop;
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

  perform public._expire_unanswered_food_couriers(uid, cid);

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

notify pgrst, 'reload schema';

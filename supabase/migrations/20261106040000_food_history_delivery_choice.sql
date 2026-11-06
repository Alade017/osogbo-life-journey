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
        'deliveryChoice', o.delivery_choice,
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

notify pgrst, 'reload schema';
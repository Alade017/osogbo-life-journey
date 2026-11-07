-- Player drawers: wearable clothes, caps and footwear kept out of the inventory.
-- A drawer holds whole inventory rows (same ids and fields), so moving an item in or out
-- never creates or destroys ownership. Capacity counts stored rows, not units.

create table if not exists public.player_drawer (
  id uuid primary key,
  player_id uuid not null references public.profiles(id) on delete cascade,
  item_id text not null references public.content_items(id) on delete restrict,
  acquired_at timestamptz not null,
  source text not null check (source in ('purchase','reward','gift')),
  is_stackable boolean not null default false,
  quantity integer not null default 1 check (quantity > 0),
  stored_at timestamptz not null default now(),
  constraint player_drawer_stack_quantity_valid check (is_stackable or quantity = 1)
);
create index if not exists player_drawer_owner_idx on public.player_drawer(player_id);
alter table public.player_drawer enable row level security;
drop policy if exists player_drawer_read_own on public.player_drawer;
create policy player_drawer_read_own on public.player_drawer for select to authenticated using (player_id = auth.uid());
revoke all on public.player_drawer from public, anon;
revoke insert, update, delete on public.player_drawer from authenticated;
grant select on public.player_drawer to authenticated;
grant all on public.player_drawer to service_role;

-- The one place the drawer size is defined. The client reads it from get_drawer_state.
create or replace function public.drawer_capacity()
returns integer language sql immutable set search_path = '' as $$
  select 24
$$;

-- A non-stackable item can be owned once. While it sits in a drawer it still counts as owned,
-- so no purchase or grant can add a second copy to the inventory.
create or replace function public._guard_drawer_duplicate()
returns trigger language plpgsql set search_path = public as $$
begin
  if not new.is_stackable and exists (
    select 1 from public.player_drawer d where d.player_id = new.player_id and d.item_id = new.item_id
  ) then
    raise exception 'ALREADY_OWNED';
  end if;
  return new;
end;
$$;
drop trigger if exists player_items_guard_drawer on public.player_items;
create trigger player_items_guard_drawer before insert on public.player_items
  for each row execute function public._guard_drawer_duplicate();

create or replace function public.get_drawer_state(p_player_id uuid)
returns jsonb language sql security definer set search_path = public as $$
  select jsonb_build_object(
    'capacity', public.drawer_capacity(),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', d.id, 'item_id', d.item_id, 'quantity', d.quantity, 'stored_at', d.stored_at,
        'category', ci.category, 'slot_type', ci.slot_type, 'art_key', ci.art_key
      ) order by d.stored_at, d.item_id)
      from public.player_drawer d join public.content_items ci on ci.id = d.item_id
      where d.player_id = p_player_id
    ), '[]'::jsonb)
  )
$$;
revoke all on function public.get_drawer_state(uuid) from public, anon, authenticated;
grant execute on function public.get_drawer_state(uuid) to service_role;

-- Take a wearable from the inventory and put it in the drawer. Worn items must be unequipped first.
create or replace function public.drawer_store(p_player_id uuid, p_inventory_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare row_item public.player_items%rowtype; ci public.content_items%rowtype;
  outfit jsonb; stored_count integer;
begin
  begin
    select * into row_item from public.player_items
      where id = p_inventory_id and player_id = p_player_id for update;
    if not found then raise exception 'NOT_OWNED'; end if;
    select * into ci from public.content_items where id = row_item.item_id;
    if ci.category not in ('outfit','accessory')
      or ci.slot_type not in ('head','top','bottom','shoes','accessory') then
      raise exception 'NOT_WEARABLE';
    end if;
    select slots into outfit from public.player_outfit where player_id = p_player_id;
    if outfit is not null and exists (
      select 1 from jsonb_each_text(outfit) worn where worn.value = row_item.item_id
    ) then
      raise exception 'ITEM_WORN';
    end if;
    select count(*) into stored_count from public.player_drawer where player_id = p_player_id;
    if stored_count >= public.drawer_capacity() then raise exception 'DRAWER_FULL'; end if;
    insert into public.player_drawer(id, player_id, item_id, acquired_at, source, is_stackable, quantity)
      values (row_item.id, p_player_id, row_item.item_id, row_item.acquired_at, row_item.source,
              row_item.is_stackable, row_item.quantity);
    delete from public.player_items where id = row_item.id;
    perform public._audit_house_action(p_player_id, 'drawer.store', row_item.item_id, 'success');
    return jsonb_build_object('ok', true, 'state', public.get_house_state(p_player_id),
      'drawer', public.get_drawer_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id, 'drawer.store', p_inventory_id::text, 'rejected', sqlerrm);
    return public._house_error(sqlerrm);
  end;
end;
$$;

-- Take an item out of the drawer back into the inventory.
create or replace function public.drawer_retrieve(p_player_id uuid, p_drawer_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.player_drawer%rowtype;
begin
  begin
    select * into d from public.player_drawer
      where id = p_drawer_id and player_id = p_player_id for update;
    if not found then raise exception 'NOT_IN_DRAWER'; end if;
    delete from public.player_drawer where id = d.id;
    insert into public.player_items(id, player_id, item_id, acquired_at, source, is_stackable, quantity)
      values (d.id, p_player_id, d.item_id, d.acquired_at, d.source, d.is_stackable, d.quantity);
    perform public._audit_house_action(p_player_id, 'drawer.retrieve', d.item_id, 'success');
    return jsonb_build_object('ok', true, 'state', public.get_house_state(p_player_id),
      'drawer', public.get_drawer_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id, 'drawer.retrieve', p_drawer_id::text, 'rejected', sqlerrm);
    return public._house_error(sqlerrm);
  end;
end;
$$;

-- Wear a wearable straight from the drawer. Takes it out and equips it in one transaction,
-- so a failed equip leaves the drawer untouched.
create or replace function public.drawer_equip(p_player_id uuid, p_drawer_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare d public.player_drawer%rowtype; equipped jsonb;
begin
  begin
    select * into d from public.player_drawer
      where id = p_drawer_id and player_id = p_player_id for update;
    if not found then raise exception 'NOT_IN_DRAWER'; end if;
    delete from public.player_drawer where id = d.id;
    insert into public.player_items(id, player_id, item_id, acquired_at, source, is_stackable, quantity)
      values (d.id, p_player_id, d.item_id, d.acquired_at, d.source, d.is_stackable, d.quantity);
    equipped := public.outfit_equip(p_player_id, d.item_id);
    if coalesce((equipped->>'ok')::boolean, false) is not true then
      raise exception '%', coalesce(equipped->>'code', 'NOT_EQUIPPABLE');
    end if;
    perform public._audit_house_action(p_player_id, 'drawer.equip', d.item_id, 'success');
    return jsonb_build_object('ok', true, 'state', public.get_house_state(p_player_id),
      'drawer', public.get_drawer_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id, 'drawer.equip', p_drawer_id::text, 'rejected', sqlerrm);
    return public._house_error(sqlerrm);
  end;
end;
$$;

revoke all on function public.drawer_store(uuid, uuid) from public, anon, authenticated;
revoke all on function public.drawer_retrieve(uuid, uuid) from public, anon, authenticated;
revoke all on function public.drawer_equip(uuid, uuid) from public, anon, authenticated;
grant execute on function public.drawer_store(uuid, uuid) to service_role;
grant execute on function public.drawer_retrieve(uuid, uuid) to service_role;
grant execute on function public.drawer_equip(uuid, uuid) to service_role;

-- The drawer furniture itself, bought and placed like the other house furniture.
insert into public.content_items(id, category, slot_type, art_key, price_minor, verify, stackable)
values ('drawer-chest', 'furniture', 'storage', 'drawer', 1200, true, false)
on conflict (id) do nothing;

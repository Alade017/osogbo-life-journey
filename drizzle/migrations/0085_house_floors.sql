-- Two-storey homes. Each placement has a floor: 0 is the ground floor (every existing item),
-- 1 is upstairs. Only a duplex has an upstairs. Collision checks look only at the same floor.
alter table public.house_placements add column if not exists floor smallint not null default 0;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'house_placements_floor_valid') then
    alter table public.house_placements add constraint house_placements_floor_valid check (floor in (0, 1));
  end if;
end $$;

-- Cell check for one floor. The old four-argument version is replaced by this one.
drop function if exists public._house_grid_cell_taken(uuid, numeric, numeric, uuid);
create or replace function public._house_grid_cell_taken(
  p_house_id uuid, p_x numeric, p_y numeric, p_except_placement_id uuid, p_floor smallint
) returns boolean language plpgsql stable set search_path = public as $$
begin
  return exists (
    select 1 from public.house_placements placement
    where placement.player_house_id = p_house_id
      and placement.floor = p_floor
      and placement.x is not null and placement.y is not null
      and (p_except_placement_id is null or placement.id <> p_except_placement_id)
      and public._house_grid_index(placement.x) = public._house_grid_index(p_x)
      and public._house_grid_index(placement.y) = public._house_grid_index(p_y)
  );
end;
$$;
revoke all on function public._house_grid_cell_taken(uuid, numeric, numeric, uuid, smallint) from public, anon, authenticated;

-- Place an owned furniture item at a free grid position on a floor. Floor defaults to ground.
drop function if exists public.house_place_free(uuid, text, numeric, numeric);
create or replace function public.house_place_free(
  p_player_id uuid, p_item_id text, p_x numeric, p_y numeric, p_floor smallint default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  house_row public.player_houses%rowtype;
  item public.content_items%rowtype;
  v_character_id uuid;
  existing_count integer;
  owned_count integer;
  new_slot text;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses
      where player_id = p_player_id and status = 'active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    if p_x is null or p_y is null or p_x not between 4 and 96 or p_y not between 4 and 96 then
      raise exception 'INVALID_POSITION';
    end if;
    if p_floor is null or p_floor not in (0, 1) then raise exception 'INVALID_FLOOR'; end if;
    if p_floor = 1 and house_row.house_type_id <> 'duplex' then raise exception 'NO_UPSTAIRS'; end if;
    select * into item from public.content_items where id = p_item_id and is_active;
    if not found or item.category <> 'furniture' then raise exception 'UNKNOWN_ITEM'; end if;
    select coalesce(sum(quantity), 0) into owned_count from public.player_items
      where player_id = p_player_id and item_id = p_item_id;
    select count(*) into existing_count from public.house_placements
      where player_house_id = house_row.id and item_id = p_item_id;
    if owned_count <= existing_count then raise exception 'NOT_OWNED'; end if;
    if public._house_grid_cell_taken(house_row.id, p_x, p_y, null, p_floor) then
      raise exception 'CELL_OCCUPIED';
    end if;

    new_slot := 'free:' || gen_random_uuid()::text;
    insert into public.house_placements(player_house_id, item_id, slot, x, y, floor)
      values (house_row.id, p_item_id, new_slot, p_x, p_y, p_floor);
    select id into v_character_id from public.characters where user_id = p_player_id;
    if v_character_id is not null then
      insert into public.home_items(user_id, character_id, item_id, slot_type, slot_id, x, y, placed)
        values (p_player_id, v_character_id, p_item_id, item.slot_type, new_slot, p_x, p_y, true)
        on conflict (character_id, item_id) do update set slot_type = excluded.slot_type,
          slot_id = excluded.slot_id, x = excluded.x, y = excluded.y, placed = true, updated_at = now();
    end if;
    perform public._audit_house_action(p_player_id, 'house.place', p_item_id, 'success', null, null,
      jsonb_build_object('to_position', jsonb_build_array(p_x, p_y), 'floor', p_floor));
    return jsonb_build_object('ok', true, 'state', public.get_house_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id, 'house.place', p_item_id, 'rejected', sqlerrm, null,
      jsonb_build_object('to_position', jsonb_build_array(p_x, p_y), 'floor', p_floor));
    return public._house_error(sqlerrm);
  end;
end;
$$;
revoke all on function public.house_place_free(uuid, text, numeric, numeric, smallint) from public, anon, authenticated;
grant execute on function public.house_place_free(uuid, text, numeric, numeric, smallint) to service_role;

-- Move keeps the item's floor and refuses a cell another item on that floor holds.
create or replace function public.house_move_to_position(
  p_player_id uuid, p_from_slot text, p_x numeric, p_y numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  house_id uuid;
  self_id uuid;
  self_floor smallint;
begin
  select id into house_id from public.player_houses
    where player_id = p_player_id and status = 'active' for update;
  if house_id is not null and p_x between 4 and 96 and p_y between 4 and 96 then
    select id, floor into self_id, self_floor from public.house_placements
      where player_house_id = house_id and slot = p_from_slot;
    if public._house_grid_cell_taken(house_id, p_x, p_y, self_id, coalesce(self_floor, 0)::smallint) then
      return public._house_error('CELL_OCCUPIED');
    end if;
  end if;
  return public._house_move_to_position_original(p_player_id, p_from_slot, p_x, p_y);
end;
$$;
revoke all on function public.house_move_to_position(uuid, text, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.house_move_to_position(uuid, text, numeric, numeric) to service_role;

-- The house state now says which floor each placement is on.
create or replace function public.get_house_state(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare house_row public.player_houses%rowtype; outfit_slots jsonb; result jsonb;
begin
  perform public._process_player_house_status(p_player_id);
  select * into house_row from public.player_houses
    where player_id=p_player_id and status in ('active','overdue') limit 1;
  select slots into outfit_slots from public.player_outfit where player_id=p_player_id;
  select jsonb_build_object(
    'house',case when house_row.id is null then null else (
      select jsonb_build_object('id',house_row.id,'house_type_id',house_row.house_type_id,
        'rented_at',house_row.rented_at,'next_rent_due_at',house_row.next_rent_due_at,'status',house_row.status,
        'house_type',jsonb_build_object('id',ht.id,'label',ht.label,'bedrooms',ht.bedrooms,
          'asset_key',ht.asset_key,'slots',ht.slots,'weekly_rent_minor',ht.weekly_rent_minor))
      from public.house_types ht where ht.id=house_row.house_type_id
    ) end,
    'placements',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'item_id',p.item_id,
      'slot',p.slot,'x',p.x,'y',p.y,'rotation_deg',p.rotation_deg,'floor',p.floor,'placed_at',p.placed_at,
      'art_key',ci.art_key,'category',ci.category,'slot_type',ci.slot_type)
      order by p.slot) from public.house_placements p join public.content_items ci on ci.id=p.item_id
      where p.player_house_id=house_row.id),'[]'::jsonb),
    'outfit',coalesce(outfit_slots,'{"head":null,"top":null,"bottom":null,"shoes":null,"accessory":null}'::jsonb),
    'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',pi.id,'item_id',pi.item_id,
      'quantity',pi.quantity,'source',pi.source,'acquired_at',pi.acquired_at,'category',ci.category,
      'slot_type',ci.slot_type,'art_key',ci.art_key,'price_minor',ci.price_minor,'verify',ci.verify)
      order by pi.acquired_at,pi.item_id) from public.player_items pi
      join public.content_items ci on ci.id=pi.item_id where pi.player_id=p_player_id),'[]'::jsonb)
  ) into result;
  perform public._audit_house_action(p_player_id,'house.state',null,'success');
  return result;
end;
$$;
revoke all on function public.get_house_state(uuid) from public,anon,authenticated;
grant execute on function public.get_house_state(uuid) to service_role;

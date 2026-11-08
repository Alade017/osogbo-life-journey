-- Wall art: a framed print, a canvas and a mirror. Each one hangs on the back wall only.
-- The back wall is the last grid row (y from 84.5 to 96). Prices already include the 20% increase.

insert into public.content_items(id,category,slot_type,art_key,price_minor,verify,stackable)
values
  ('wall-art-frame','furniture','decor','wall-art',420,true,false),
  ('wall-art-canvas','furniture','decor','wall-art-canvas',960,true,false),
  ('wall-art-mirror','furniture','decor','wall-art-mirror',1440,true,false)
on conflict(id) do nothing;

-- Free placement: wall art must go on the back wall. Other furniture is unchanged.
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
    if item.art_key like 'wall-art%' and not (p_y between 84.5 and 96) then
      raise exception 'WALL_ONLY';
    end if;
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

-- Slot placement (the old room-slot path): wall art is never placed there.
create or replace function public.house_place(p_player_id uuid,p_item_id text,p_slot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  house_row public.player_houses%rowtype;
  item public.content_items%rowtype;
  selected_slot jsonb;
  v_character_id uuid;
  existing_count integer;
  owned_count integer;
  position_x numeric;
  position_y numeric;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses
      where player_id=p_player_id and status='active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    select * into item from public.content_items where id=p_item_id and is_active;
    if not found or item.category<>'furniture' then raise exception 'UNKNOWN_ITEM'; end if;
    if item.art_key like 'wall-art%' then raise exception 'WALL_ONLY'; end if;
    select entries.slot into selected_slot
      from public.house_types house, jsonb_array_elements(house.slots) as entries(slot)
      where house.id=house_row.house_type_id and entries.slot->>'id'=p_slot
        and entries.slot->>'slot_type'=item.slot_type;
    if selected_slot is null then raise exception 'SLOT_MISMATCH'; end if;
    position_x := coalesce((selected_slot->>'x')::numeric, 50);
    position_y := coalesce((selected_slot->>'y')::numeric, 50);
    perform 1 from public.player_items where player_id=p_player_id and item_id=p_item_id for update;
    select coalesce(sum(quantity),0) into owned_count from public.player_items
      where player_id=p_player_id and item_id=p_item_id;
    select count(*) into existing_count from public.house_placements
      where player_house_id=house_row.id and item_id=p_item_id;
    if owned_count<=existing_count then raise exception 'NOT_OWNED'; end if;
    insert into public.house_placements(player_house_id,item_id,slot,x,y)
      values(house_row.id,p_item_id,p_slot,position_x,position_y);
    select id into v_character_id from public.characters where user_id=p_player_id;
    if v_character_id is not null then
      insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,x,y,placed)
        values(p_player_id,v_character_id,p_item_id,item.slot_type,p_slot,position_x,position_y,true)
        on conflict(character_id,item_id) do update set slot_type=excluded.slot_type,
          slot_id=excluded.slot_id,x=excluded.x,y=excluded.y,placed=true,updated_at=now();
    end if;
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'success',null,null,
      jsonb_build_object('slot',p_slot));
    return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
  exception when unique_violation then
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'rejected','SLOT_OCCUPIED',null,
      jsonb_build_object('slot',p_slot));
    return public._house_error('SLOT_OCCUPIED');
  when others then
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'rejected',sqlerrm,null,
      jsonb_build_object('slot',p_slot));
    return public._house_error(sqlerrm);
  end;
end;
$$;
revoke all on function public.house_place(uuid,text,text) from public, anon, authenticated;
grant execute on function public.house_place(uuid,text,text) to service_role;

-- Move: wall art may only slide along the back wall. Other checks are unchanged.
create or replace function public.house_move_to_position(
  p_player_id uuid, p_from_slot text, p_x numeric, p_y numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  house_id uuid;
  self_id uuid;
  self_floor smallint;
  self_art text;
begin
  select id into house_id from public.player_houses
    where player_id = p_player_id and status = 'active' for update;
  if house_id is not null then
    select placement.id, placement.floor, item.art_key into self_id, self_floor, self_art
      from public.house_placements placement
      join public.content_items item on item.id = placement.item_id
      where placement.player_house_id = house_id and placement.slot = p_from_slot;
    if self_art like 'wall-art%' and not (p_y between 84.5 and 96) then
      return public._house_error('WALL_ONLY');
    end if;
  end if;
  if house_id is not null and p_x between 4 and 96 and p_y between 4 and 96 then
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

notify pgrst, 'reload schema';

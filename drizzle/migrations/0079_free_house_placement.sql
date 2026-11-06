-- Free furniture placement: items sit on an 8 x 8 grid over the floor, one item per
-- cell, with no fixed room slot. The grid matches the client (4..96 percent, 11.5 per cell).

-- Column of a room percentage on the 8 x 8 grid, clamped to 0..7.
create or replace function public._house_grid_index(p_value numeric)
returns integer language sql immutable set search_path = '' as $$
  select least(7, greatest(0, floor((p_value - 4) / 11.5)))::integer
$$;
revoke all on function public._house_grid_index(numeric) from public, anon, authenticated;

-- True when another placement in the house already occupies the cell at (x, y).
-- Written in plpgsql so the x and y columns are only resolved when it runs: a fresh replay
-- creates it before the supabase chain adds those columns.
create or replace function public._house_grid_cell_taken(
  p_house_id uuid, p_x numeric, p_y numeric, p_except_placement_id uuid
) returns boolean language plpgsql stable set search_path = public as $$
begin
  return exists (
    select 1 from public.house_placements placement
    where placement.player_house_id = p_house_id
      and placement.x is not null and placement.y is not null
      and (p_except_placement_id is null or placement.id <> p_except_placement_id)
      and public._house_grid_index(placement.x) = public._house_grid_index(p_x)
      and public._house_grid_index(placement.y) = public._house_grid_index(p_y)
  );
end;
$$;
revoke all on function public._house_grid_cell_taken(uuid, numeric, numeric, uuid) from public, anon, authenticated;

-- Place an owned furniture item at a free grid position. Takes no slot.
create or replace function public.house_place_free(p_player_id uuid, p_item_id text, p_x numeric, p_y numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
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
    -- Lock the house first: every placement and move for this house queues behind it,
    -- so two requests cannot both take the same cell.
    select * into house_row from public.player_houses
      where player_id = p_player_id and status = 'active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    if p_x is null or p_y is null or p_x not between 4 and 96 or p_y not between 4 and 96 then
      raise exception 'INVALID_POSITION';
    end if;
    select * into item from public.content_items where id = p_item_id and is_active;
    if not found or item.category <> 'furniture' then raise exception 'UNKNOWN_ITEM'; end if;
    select coalesce(sum(quantity), 0) into owned_count from public.player_items
      where player_id = p_player_id and item_id = p_item_id;
    select count(*) into existing_count from public.house_placements
      where player_house_id = house_row.id and item_id = p_item_id;
    if owned_count <= existing_count then raise exception 'NOT_OWNED'; end if;
    if public._house_grid_cell_taken(house_row.id, p_x, p_y, null) then
      raise exception 'CELL_OCCUPIED';
    end if;

    new_slot := 'free:' || gen_random_uuid()::text;
    insert into public.house_placements(player_house_id, item_id, slot, x, y)
      values (house_row.id, p_item_id, new_slot, p_x, p_y);
    select id into v_character_id from public.characters where user_id = p_player_id;
    if v_character_id is not null then
      insert into public.home_items(user_id, character_id, item_id, slot_type, slot_id, x, y, placed)
        values (p_player_id, v_character_id, p_item_id, item.slot_type, new_slot, p_x, p_y, true)
        on conflict (character_id, item_id) do update set slot_type = excluded.slot_type,
          slot_id = excluded.slot_id, x = excluded.x, y = excluded.y, placed = true, updated_at = now();
    end if;
    perform public._audit_house_action(p_player_id, 'house.place', p_item_id, 'success', null, null,
      jsonb_build_object('to_position', jsonb_build_array(p_x, p_y)));
    return jsonb_build_object('ok', true, 'state', public.get_house_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id, 'house.place', p_item_id, 'rejected', sqlerrm, null,
      jsonb_build_object('to_position', jsonb_build_array(p_x, p_y)));
    return public._house_error(sqlerrm);
  end;
end;
$$;
revoke all on function public.house_place_free(uuid, text, numeric, numeric) from public, anon, authenticated;
grant execute on function public.house_place_free(uuid, text, numeric, numeric) to service_role;

-- Move: keep the original move, and refuse a cell another placement already holds.
-- The original move lives in the supabase chain. On a database where it exists, keep it
-- under the _original name; on a fresh replay where it is not yet defined, skip the rename.
do $$
begin
  if to_regprocedure('public._house_move_to_position_original(uuid,text,numeric,numeric)') is null
    and to_regprocedure('public.house_move_to_position(uuid,text,numeric,numeric)') is not null then
    alter function public.house_move_to_position(uuid, text, numeric, numeric)
      rename to _house_move_to_position_original;
    revoke all on function public._house_move_to_position_original(uuid, text, numeric, numeric)
      from public, anon, authenticated;
  end if;
end $$;

create or replace function public.house_move_to_position(
  p_player_id uuid, p_from_slot text, p_x numeric, p_y numeric
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  house_id uuid;
  self_id uuid;
begin
  -- Lock the house before checking the cell, so the check and the move cannot interleave.
  select id into house_id from public.player_houses
    where player_id = p_player_id and status = 'active' for update;
  if house_id is not null and p_x between 4 and 96 and p_y between 4 and 96 then
    select id into self_id from public.house_placements
      where player_house_id = house_id and slot = p_from_slot;
    if public._house_grid_cell_taken(house_id, p_x, p_y, self_id) then
      return public._house_error('CELL_OCCUPIED');
    end if;
  end if;
  return public._house_move_to_position_original(p_player_id, p_from_slot, p_x, p_y);
end;
$$;
revoke all on function public.house_move_to_position(uuid, text, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.house_move_to_position(uuid, text, numeric, numeric) to service_role;

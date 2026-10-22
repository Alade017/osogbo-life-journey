-- Moving furniture changes its saved slot without changing inventory or balances.
create or replace function public.house_move(p_player_id uuid, p_from_slot text, p_to_slot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  house_row public.player_houses%rowtype;
  placement public.house_placements%rowtype;
  item public.content_items%rowtype;
  v_character_id uuid;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses
      where player_id=p_player_id and status='active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    if p_from_slot is null or p_to_slot is null or p_from_slot=p_to_slot then
      raise exception 'INVALID_SLOT';
    end if;
    select * into placement from public.house_placements
      where player_house_id=house_row.id and slot=p_from_slot for update;
    if not found then raise exception 'EMPTY_SLOT'; end if;
    select * into item from public.content_items where id=placement.item_id and is_active;
    if not found or item.category<>'furniture' then raise exception 'UNKNOWN_ITEM'; end if;
    if not exists (
      select 1 from public.house_types ht, jsonb_array_elements(ht.slots) s
      where ht.id=house_row.house_type_id and s->>'id'=p_to_slot
        and s->>'slot_type'=item.slot_type
    ) then raise exception 'SLOT_MISMATCH'; end if;
    if not exists (
      select 1 from public.player_items
      where player_id=p_player_id and item_id=placement.item_id and quantity>0
    ) then raise exception 'NOT_OWNED'; end if;
    if exists (
      select 1 from public.house_placements
      where player_house_id=house_row.id and slot=p_to_slot
    ) then raise exception 'SLOT_OCCUPIED'; end if;

    update public.house_placements set slot=p_to_slot where id=placement.id;
    select id into v_character_id from public.characters where user_id=p_player_id;
    if v_character_id is not null then
      update public.home_items set slot_id=p_to_slot,updated_at=now()
        where character_id=v_character_id and item_id=placement.item_id
          and slot_id=p_from_slot and placed;
    end if;
    perform public._audit_house_action(p_player_id,'house.move',placement.item_id,'success',null,null,
      jsonb_build_object('from_slot',p_from_slot,'to_slot',p_to_slot));
    return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
  exception when unique_violation then
    perform public._audit_house_action(p_player_id,'house.move',placement.item_id,'rejected','SLOT_OCCUPIED',null,
      jsonb_build_object('from_slot',p_from_slot,'to_slot',p_to_slot));
    return public._house_error('SLOT_OCCUPIED');
  when others then
    perform public._audit_house_action(p_player_id,'house.move',placement.item_id,'rejected',sqlerrm,null,
      jsonb_build_object('from_slot',p_from_slot,'to_slot',p_to_slot));
    return public._house_error(sqlerrm);
  end;
end;
$$;

revoke all on function public.house_move(uuid,text,text) from public,anon,authenticated;
grant execute on function public.house_move(uuid,text,text) to service_role;
notify pgrst, 'reload schema';

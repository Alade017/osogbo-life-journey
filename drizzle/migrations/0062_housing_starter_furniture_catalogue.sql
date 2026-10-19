-- Canonical move-in grants refer to these legacy starter ids. Register them
-- before future rentals and restore grants for already-active rentals.
insert into public.content_items(id, category, slot_type, art_key, price_minor, verify, stackable)
values
  ('starter-bed', 'furniture', 'bed', 'bed', 0, true, false),
  ('starter-light', 'furniture', 'light', 'light', 0, true, false),
  ('starter-seat', 'furniture', 'seat', 'seat', 0, true, false)
on conflict (id) do nothing;

insert into public.player_items(player_id, item_id, source, is_stackable, quantity)
select tenancy.user_id, item.id, 'gift', item.stackable, 1
from public.player_home_accessory_sets accessories
join public.player_properties tenancy on tenancy.id = accessories.player_property_id
cross join lateral jsonb_array_elements_text(accessories.items) chosen(item_id)
join public.content_items item on item.id = chosen.item_id and item.is_active
where tenancy.is_active
on conflict(player_id, item_id) where not is_stackable do nothing;

-- The existing placement RPC has a PL/pgSQL variable named character_id,
-- which conflicts with the home_items column in ON CONFLICT. Keep its server
-- validation and response unchanged while removing that ambiguity.
create or replace function public.house_place(p_player_id uuid,p_item_id text,p_slot text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare house_row public.player_houses%rowtype; item public.content_items%rowtype;
  v_character_id uuid; existing_count integer; owned_count integer;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses
      where player_id=p_player_id and status='active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    select * into item from public.content_items where id=p_item_id and is_active;
    if not found or item.category<>'furniture' then raise exception 'UNKNOWN_ITEM'; end if;
    if not exists(select 1 from public.house_types ht,jsonb_array_elements(ht.slots) s
      where ht.id=house_row.house_type_id and s->>'id'=p_slot and s->>'slot_type'=item.slot_type)
      then raise exception 'SLOT_MISMATCH'; end if;
    perform 1 from public.player_items where player_id=p_player_id and item_id=p_item_id for update;
    select coalesce(sum(quantity),0) into owned_count from public.player_items
      where player_id=p_player_id and item_id=p_item_id;
    select count(*) into existing_count from public.house_placements
      where player_house_id=house_row.id and item_id=p_item_id;
    if owned_count<=existing_count then raise exception 'NOT_OWNED'; end if;
    insert into public.house_placements(player_house_id,item_id,slot) values(house_row.id,p_item_id,p_slot);
    select id into v_character_id from public.characters where user_id=p_player_id;
    if v_character_id is not null then
      insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,placed)
        values(p_player_id,v_character_id,p_item_id,item.slot_type,p_slot,true)
        on conflict(character_id,item_id) do update set slot_type=excluded.slot_type,
          slot_id=excluded.slot_id,placed=true,updated_at=now();
    end if;
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'success',null,null,jsonb_build_object('slot',p_slot));
    return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
  exception when unique_violation then
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'rejected','SLOT_OCCUPIED',null,jsonb_build_object('slot',p_slot));
    return public._house_error('SLOT_OCCUPIED');
  when others then
    perform public._audit_house_action(p_player_id,'house.place',p_item_id,'rejected',sqlerrm,null,jsonb_build_object('slot',p_slot));
    return public._house_error(sqlerrm);
  end;
end;
$$;

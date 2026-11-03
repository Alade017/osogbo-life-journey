alter table public.house_placements
  add column x numeric not null default 50 check (x between 0 and 100),
  add column y numeric not null default 50 check (y between 0 and 100);

update public.house_placements placement
set x = coalesce(
      (select (slot->>'x')::numeric
       from public.player_houses house, jsonb_array_elements(
         (select types.slots from public.house_types types where types.id = house.house_type_id)
       ) as entries(slot)
       where house.id = placement.player_house_id and entries.slot->>'id' = placement.slot
       limit 1),
      (select item.x
       from public.player_houses house
       join public.characters character on character.user_id = house.player_id
       join public.home_items item on item.character_id = character.id
       where house.id = placement.player_house_id and item.item_id = placement.item_id
       limit 1),
      50
    ),
    y = coalesce(
      (select (slot->>'y')::numeric
       from public.player_houses house, jsonb_array_elements(
         (select types.slots from public.house_types types where types.id = house.house_type_id)
       ) as entries(slot)
       where house.id = placement.player_house_id and entries.slot->>'id' = placement.slot
       limit 1),
      (select item.y
       from public.player_houses house
       join public.characters character on character.user_id = house.player_id
       join public.home_items item on item.character_id = character.id
       where house.id = placement.player_house_id and item.item_id = placement.item_id
       limit 1),
      50
    );

update public.home_items home_item
set slot_id = placement.slot, x = placement.x, y = placement.y, updated_at = now()
from public.characters character, public.player_houses house, public.house_placements placement
where home_item.character_id = character.id
  and house.player_id = character.user_id
  and house.status in ('active', 'overdue')
  and placement.player_house_id = house.id
  and placement.item_id = home_item.item_id
  and home_item.placed;

update public.house_types house
set slots = (
  select jsonb_agg(
    case slot->>'id'
      when 'seat' then jsonb_set(jsonb_set(slot, '{x}', '76'::jsonb), '{y}', '68'::jsonb)
      when 'light' then jsonb_set(jsonb_set(slot, '{x}', '52'::jsonb), '{y}', '24'::jsonb)
      else slot
    end
    order by ordinal
  )
  from jsonb_array_elements(house.slots) with ordinality as entries(slot, ordinal)
)
where house.id = 'single-room';

create or replace function public._set_house_placement_default_position()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.x = 50 and new.y = 50 then
    select (slot->>'x')::numeric, (slot->>'y')::numeric
      into new.x, new.y
      from public.house_types house, jsonb_array_elements(house.slots) as entries(slot)
      where house.id = (
        select player_house.house_type_id
        from public.player_houses player_house
        where player_house.id = new.player_house_id
      )
      and entries.slot->>'id' = new.slot
      limit 1;
    new.x := coalesce(new.x, 50);
    new.y := coalesce(new.y, 50);
  end if;
  return new;
end;
$$;
revoke all on function public._set_house_placement_default_position() from public, anon, authenticated;
drop trigger if exists set_house_placement_default_position on public.house_placements;
create trigger set_house_placement_default_position
before insert on public.house_placements
for each row execute function public._set_house_placement_default_position();

create or replace function public._sync_legacy_home_item()
returns trigger language plpgsql security definer set search_path=public as $$
declare house_row public.player_houses%rowtype; v_category text; v_slot text;
begin
  if tg_op='DELETE' then
    delete from public.house_placements p using public.player_houses h
      where p.player_house_id=h.id and h.player_id=old.user_id and p.item_id=old.item_id;
    if old.equipped then
      v_slot:=case old.slot_type when 'hat' then 'head' else old.slot_type end;
      update public.player_outfit set slots=jsonb_set(slots,array[v_slot],'null'::jsonb,true),updated_at=now()
        where player_id=old.user_id and slots->>v_slot=old.item_id;
    end if;
    return old;
  end if;
  v_category:=case when new.equipped and new.slot_type='accessory' then 'accessory'
    when new.equipped then 'outfit' else 'furniture' end;
  v_slot:=case when new.slot_type='hat' then 'head' else new.slot_type end;
  insert into public.content_items(id,category,slot_type,art_key,price_minor,verify)
    values(new.item_id,v_category,v_slot,new.item_id,0,true) on conflict(id) do nothing;
  insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
    values(new.user_id,new.item_id,'reward',false,1)
    on conflict(player_id,item_id) where not is_stackable do nothing;
  select * into house_row from public.player_houses
    where player_id=new.user_id and status='active' limit 1;
  if house_row.id is not null then
    if new.placed then
      insert into public.house_placements(player_house_id,item_id,slot,x,y)
        values(house_row.id,new.item_id,coalesce(nullif(new.slot_id,''),new.item_id),new.x,new.y)
        on conflict(player_house_id,slot) do update
          set item_id=excluded.item_id,x=excluded.x,y=excluded.y,placed_at=now();
    else
      delete from public.house_placements where player_house_id=house_row.id and item_id=new.item_id;
    end if;
  end if;
  if new.equipped and v_slot in ('head','top','bottom','shoes','accessory') then
    insert into public.player_outfit(player_id) values(new.user_id) on conflict(player_id) do nothing;
    update public.player_outfit set slots=jsonb_set(slots,array[v_slot],to_jsonb(new.item_id),true),updated_at=now()
      where player_id=new.user_id;
  elsif tg_op='UPDATE' and old.equipped and v_slot in ('head','top','bottom','shoes','accessory') then
    update public.player_outfit set slots=jsonb_set(slots,array[v_slot],'null'::jsonb,true),updated_at=now()
      where player_id=new.user_id and slots->>v_slot=old.item_id;
  end if;
  return new;
end;
$$;
revoke all on function public._sync_legacy_home_item() from public, anon, authenticated;

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
      'slot',p.slot,'x',p.x,'y',p.y,'placed_at',p.placed_at,'art_key',ci.art_key,
      'category',ci.category,'slot_type',ci.slot_type)
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
revoke all on function public.get_house_state(uuid) from public, anon, authenticated;
grant execute on function public.get_house_state(uuid) to service_role;

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

create or replace function public.house_move_to_position(
  p_player_id uuid, p_from_slot text, p_x numeric, p_y numeric
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  house_row public.player_houses%rowtype;
  placement public.house_placements%rowtype;
  item public.content_items%rowtype;
  v_character_id uuid;
  next_slot text;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses
      where player_id=p_player_id and status='active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    if p_from_slot is null or p_x is null or p_y is null
      or p_x not between 4 and 96 or p_y not between 4 and 96 then
      raise exception 'INVALID_POSITION';
    end if;
    select * into placement from public.house_placements
      where player_house_id=house_row.id and slot=p_from_slot for update;
    if not found then raise exception 'EMPTY_SLOT'; end if;
    select * into item from public.content_items where id=placement.item_id and is_active;
    if not found or item.category<>'furniture' then raise exception 'UNKNOWN_ITEM'; end if;
    if not exists (
      select 1 from public.player_items
      where player_id=p_player_id and item_id=placement.item_id and quantity>0
    ) then raise exception 'NOT_OWNED'; end if;

    next_slot := 'free:' || placement.id::text;
    update public.house_placements set slot=next_slot,x=p_x,y=p_y where id=placement.id;
    select id into v_character_id from public.characters where user_id=p_player_id;
    if v_character_id is not null then
      update public.home_items set slot_id=next_slot,x=p_x,y=p_y,updated_at=now()
        where home_items.character_id=v_character_id and item_id=placement.item_id and placed;
    end if;
    perform public._audit_house_action(p_player_id,'house.move',placement.item_id,'success',null,null,
      jsonb_build_object('from_slot',p_from_slot,'to_position',jsonb_build_array(p_x,p_y)));
    return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
  exception when unique_violation then
    perform public._audit_house_action(p_player_id,'house.move',placement.item_id,'rejected',
      'SLOT_OCCUPIED',null,jsonb_build_object('from_slot',p_from_slot));
    return public._house_error('SLOT_OCCUPIED');
  when others then
    perform public._audit_house_action(p_player_id,'house.move',placement.item_id,'rejected',
      sqlerrm,null,jsonb_build_object('from_slot',p_from_slot));
    return public._house_error(sqlerrm);
  end;
end;
$$;
revoke all on function public.house_move_to_position(uuid,text,numeric,numeric) from public, anon, authenticated;
grant execute on function public.house_move_to_position(uuid,text,numeric,numeric) to service_role;

notify pgrst, 'reload schema';
alter table public.house_placements
  add column if not exists rotation_deg numeric(6,2) not null default 0;

alter table public.house_placements
  drop constraint if exists house_placements_rotation_range;
alter table public.house_placements
  add constraint house_placements_rotation_range check (rotation_deg >= 0 and rotation_deg < 360);

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
      'slot',p.slot,'x',p.x,'y',p.y,'rotation_deg',p.rotation_deg,'placed_at',p.placed_at,'art_key',ci.art_key,
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

create or replace function public.house_rotate_placement(
  p_player_id uuid, p_from_slot text, p_rotation numeric
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  house_row public.player_houses%rowtype;
  placement public.house_placements%rowtype;
  item public.content_items%rowtype;
begin
  perform public._process_player_house_status(p_player_id);
  begin
    select * into house_row from public.player_houses
      where player_id=p_player_id and status='active' for update;
    if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
    if p_from_slot is null or p_rotation is null or p_rotation < 0 or p_rotation >= 360 then
      raise exception 'INVALID_ROTATION';
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

    update public.house_placements set rotation_deg=round(p_rotation,2) where id=placement.id;
    perform public._audit_house_action(p_player_id,'house.rotate',placement.item_id,'success',null,null,
      jsonb_build_object('from_slot',p_from_slot,'rotation_deg',round(p_rotation,2)));
    return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
  exception when others then
    perform public._audit_house_action(p_player_id,'house.rotate',null,'rejected',sqlerrm,null,
      jsonb_build_object('from_slot',p_from_slot));
    return public._house_error(sqlerrm);
  end;
end;
$$;
revoke all on function public.house_rotate_placement(uuid,text,numeric) from public, anon, authenticated;
grant execute on function public.house_rotate_placement(uuid,text,numeric) to service_role;

notify pgrst, 'reload schema';
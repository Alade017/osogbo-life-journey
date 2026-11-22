-- Records three functions whose live definitions were changed outside migrations.
-- These are cosmetic changes (error messages and an added placement field). The bodies below are the
-- live definitions, so applying this migration does not change the live database.
-- Recorded from the live database on 2026-11-22.

CREATE OR REPLACE FUNCTION public.create_player_status(p_body text, p_theme text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); clean text:=btrim(coalesce(p_body,'')); row_id uuid;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if length(clean) not between 1 and 280 then raise exception 'Status must be 1 to 280 characters'; end if;
  if p_theme not in ('porcelain','leaf','ink','sunset') then raise exception 'Choose a supported status theme'; end if;
  insert into public.player_status_posts(owner_user_id,owner_character_id,body,theme)
    values(uid,cid,clean,p_theme) returning id into row_id;
  return jsonb_build_object('ok',true,'id',row_id);
end $function$;

CREATE OR REPLACE FUNCTION public.delete_player_status(p_status_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  delete from public.player_status_posts where id=p_status_id and owner_user_id=auth.uid();
  if not found then raise exception 'Status not found'; end if;
  return jsonb_build_object('ok',true);
end $function$;

CREATE OR REPLACE FUNCTION public.get_house_state(p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

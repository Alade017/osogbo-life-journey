-- Atomic owner-scoped rearrangement. The trusted API plans clearance against the house blueprint.
-- Compare the entire placement snapshot to prevent overwriting another tab's edits.
create or replace function public.house_rearrange_owned_items(
  p_player_id uuid, p_house_id uuid, p_expected jsonb, p_moves jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  h public.player_houses%rowtype;
  snapshot jsonb;
  n integer;
begin
  perform public._process_player_house_status(p_player_id);
  select * into h from public.player_houses where id=p_house_id and player_id=p_player_id and status='active' for update;
  if not found then raise exception 'NO_ACTIVE_HOUSE'; end if;
  perform 1 from public.house_placements where player_house_id=h.id for update;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'slot',slot,'x',x,'y',y,'floor',floor,'rotation_deg',rotation_deg) order by id), '[]'::jsonb)
    into snapshot from public.house_placements where player_house_id=h.id;
  if snapshot is distinct from p_expected then raise exception 'LAYOUT_CHANGED'; end if;
  if jsonb_typeof(p_moves) is distinct from 'array' then raise exception 'INVALID_POSITION'; end if;
  n := jsonb_array_length(snapshot);
  if n > 128 or jsonb_array_length(p_moves) <> n then raise exception 'INVALID_POSITION'; end if;
  if exists (
    select 1 from jsonb_to_recordset(p_moves) as m(id uuid,x numeric,y numeric,floor smallint,rotation_deg numeric)
    left join public.house_placements p on p.id=m.id and p.player_house_id=h.id
    where p.id is null or m.x is null or m.y is null or m.floor is null or m.rotation_deg is null
      or m.x not between 4 and 96 or m.y not between 4 and 96
      or m.floor not in (0,1) or (m.floor=1 and h.house_type_id <> 'duplex')
      or m.rotation_deg not in (0,90,180,270)
      or m.x <> 9.75 + 11.5 * public._house_grid_index(m.x)
      or m.y <> 9.75 + 11.5 * public._house_grid_index(m.y)
  ) or (select count(distinct id) from jsonb_to_recordset(p_moves) as m(id uuid)) <> n
  or exists (select 1 from jsonb_to_recordset(p_moves) as m(x numeric,y numeric,floor smallint)
    group by x,y,floor having count(*)>1) then raise exception 'INVALID_POSITION'; end if;
  -- Keep each row's identity and slot key; swapping cells does not create or consume items.
  update public.house_placements p set x=m.x,y=m.y,floor=m.floor,rotation_deg=m.rotation_deg
    from jsonb_to_recordset(p_moves) as m(id uuid,x numeric,y numeric,floor smallint,rotation_deg numeric)
    where p.id=m.id and p.player_house_id=h.id;
  -- Mirror coordinates only to the exact legacy item row. Slot IDs are not unique
  -- across a character's legacy inventory, so never join on user_id + slot_id alone.
  update public.home_items i
    set x=p.x,y=p.y,updated_at=now()
    from public.house_placements p
    join public.characters c on c.user_id=p_player_id
    where p.player_house_id=h.id
      and i.user_id=p_player_id
      and i.character_id=c.id
      and i.item_id=p.item_id
      and i.slot_id=p.slot
      and i.placed;
  perform public._audit_house_action(p_player_id,'house.rearrange',null,'success',null,null,jsonb_build_object('count',n));
  return jsonb_build_object('ok',true,'state',public.get_house_state(p_player_id));
end $$;
revoke all on function public.house_rearrange_owned_items(uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.house_rearrange_owned_items(uuid,uuid,jsonb,jsonb) to service_role;

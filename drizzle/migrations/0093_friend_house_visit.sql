-- Friends see a friend's current house, read-only, in the 3D room. The visit rules are the same as
-- get_friend_home_for_visit: friendship, no block in either direction, and the owner's visit switch on.
create or replace function public.get_friend_house_for_visit(p_target_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public._my_character_id();
  owner public.characters%rowtype;
  house_row public.player_houses%rowtype;
begin
  if me is null then raise exception 'Sign in before visiting a home'; end if;
  if p_target_character_id is null or p_target_character_id = me then
    raise exception 'Choose a friend home to visit';
  end if;
  if not exists (
    select 1 from public.player_friendships f
    where (f.first_character_id = me and f.second_character_id = p_target_character_id)
       or (f.first_character_id = p_target_character_id and f.second_character_id = me)
  ) then raise exception 'This home is not open to you'; end if;
  if exists (
    select 1 from public.player_blocks b
    where (b.blocker_character_id = me and b.blocked_character_id = p_target_character_id)
       or (b.blocker_character_id = p_target_character_id and b.blocked_character_id = me)
  ) then raise exception 'This home is not open to you'; end if;

  select * into owner from public.characters where id = p_target_character_id;
  if owner.id is null or not exists (
    select 1 from public.character_home_saves s
    where s.character_id = p_target_character_id and s.allow_friend_visits
  ) then raise exception 'This home is not open to you'; end if;

  select * into house_row from public.player_houses
    where player_id = owner.user_id and status in ('active', 'overdue') limit 1;
  if house_row.id is null then raise exception 'This home is not open to you'; end if;

  return jsonb_build_object(
    'owner_name', owner.name,
    'house', jsonb_build_object(
      'id', house_row.id,
      'house_type_id', house_row.house_type_id,
      'walls_closed', house_row.walls_closed,
      'house_type', (
        select jsonb_build_object('id', ht.id, 'label', ht.label, 'bedrooms', ht.bedrooms,
          'asset_key', ht.asset_key, 'slots', ht.slots)
        from public.house_types ht where ht.id = house_row.house_type_id
      )
    ),
    'placements', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'item_id', p.item_id, 'slot', p.slot,
        'x', p.x, 'y', p.y, 'rotation_deg', p.rotation_deg, 'floor', p.floor,
        'art_key', ci.art_key, 'category', ci.category, 'slot_type', ci.slot_type)
        order by p.slot)
      from public.house_placements p join public.content_items ci on ci.id = p.item_id
      where p.player_house_id = house_row.id
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_friend_house_for_visit(uuid) from public, anon;
grant execute on function public.get_friend_house_for_visit(uuid) to authenticated;
notify pgrst, 'reload schema';

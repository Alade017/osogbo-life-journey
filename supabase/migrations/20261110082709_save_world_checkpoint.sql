-- Remember where the character stands in the neighbourhood, so the next sign-in starts there.
-- Unlike save_player_world_position, this costs no energy or game time: it only records the spot.
-- Positions are not saved while the character is inside a house, since the house is the saved place.
create or replace function public.save_my_world_checkpoint(p_world_x double precision, p_world_y double precision)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
begin
  if auth.uid() is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_world_x is null or p_world_y is null
    or p_world_x not between 0 and 14 or p_world_y not between 0 and 12 then
    raise exception 'Position is outside the fictional city';
  end if;
  select * into player from public.characters where id = cid and user_id = auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  if player.inside_home_property_id is not null then
    return jsonb_build_object('saved', false);
  end if;
  update public.characters set world_x = p_world_x, world_y = p_world_y where id = cid;
  return jsonb_build_object('saved', true, 'world_x', p_world_x, 'world_y', p_world_y);
end $$;
revoke all on function public.save_my_world_checkpoint(double precision, double precision) from public, anon;
grant execute on function public.save_my_world_checkpoint(double precision, double precision) to authenticated;

notify pgrst, 'reload schema';

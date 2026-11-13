-- Neighbourhood checkpoints are written only by the multiplayer server, through the service role.
-- The browser may no longer save coordinates, so the old RPC is revoked from every client role.
-- The old migration (20261110082709_save_world_checkpoint.sql) is left as it was applied.

revoke all on function public.save_my_world_checkpoint(double precision, double precision)
  from public, anon, authenticated;

create or replace function public.save_neighborhood_world_checkpoint(
  p_character_id uuid,
  p_user_id uuid,
  p_location_id uuid,
  p_world_x double precision,
  p_world_y double precision
)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_character_id is null or p_user_id is null or p_location_id is null
    or p_world_x is null or p_world_y is null then
    raise exception 'Checkpoint is incomplete';
  end if;
  if p_world_x not between 0 and 24 or p_world_y not between 0 and 20 then
    raise exception 'Position is outside the fictional city';
  end if;

  -- A checkpoint is not a world-map travel, so world_position_revision is deliberately untouched.
  update public.characters
     set world_x = p_world_x, world_y = p_world_y
   where id = p_character_id
     and user_id = p_user_id
     and current_location_id = p_location_id
     and inside_home_property_id is null;

  if not found then
    return jsonb_build_object('saved', false);
  end if;
  return jsonb_build_object('saved', true, 'world_x', p_world_x, 'world_y', p_world_y);
end $$;

revoke all on function public.save_neighborhood_world_checkpoint(uuid, uuid, uuid, double precision, double precision)
  from public, anon, authenticated;
grant execute on function public.save_neighborhood_world_checkpoint(uuid, uuid, uuid, double precision, double precision)
  to service_role;

notify pgrst, 'reload schema';

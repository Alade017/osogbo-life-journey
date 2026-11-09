-- Bind the legacy virtual-map position saver to the character that owns the movement.
-- Reuse the same profile-row lock as all other character-bound movement RPCs.
create or replace function public.save_player_map_position_for_character(
  p_latitude double precision,
  p_longitude double precision,
  p_movement_state text,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_active_character(p_expected_character_id);
  return public.save_player_map_position(
    p_latitude,
    p_longitude,
    p_movement_state
  );
end
$$;

revoke all on function public.save_player_map_position(double precision,double precision,text)
  from public, anon, authenticated;
revoke all on function public.save_player_map_position_for_character(double precision,double precision,text,uuid)
  from public, anon;
grant execute on function public.save_player_map_position_for_character(double precision,double precision,text,uuid)
  to authenticated;

notify pgrst, 'reload schema';

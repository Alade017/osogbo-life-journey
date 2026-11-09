-- Close the remaining fictional-city movement RPCs over the active character.
-- The account profile lock serializes these calls against character creation.
create or replace function public.save_player_world_position_for_character(
  p_world_x double precision,
  p_world_y double precision,
  p_building_slug text,
  p_expected_revision bigint,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_active_character(p_expected_character_id);
  return public.save_player_world_position(
    p_world_x,
    p_world_y,
    p_building_slug,
    p_expected_revision,
    p_request_id
  );
end
$$;

create or replace function public.travel_to_city_location_for_character(
  p_location_id uuid,
  p_mode text,
  p_world_x double precision,
  p_world_y double precision,
  p_expected_revision bigint,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_active_character(p_expected_character_id);
  return public.travel_to_city_location(
    p_location_id,
    p_mode,
    p_world_x,
    p_world_y,
    p_expected_revision,
    p_request_id
  );
end
$$;

revoke all on function public.save_player_world_position(double precision,double precision,text,bigint,uuid) from public, anon, authenticated;
revoke all on function public.travel_to_city_location(uuid,text,double precision,double precision,bigint,uuid) from public, anon, authenticated;

revoke all on function public.save_player_world_position_for_character(double precision,double precision,text,bigint,uuid,uuid) from public, anon;
revoke all on function public.travel_to_city_location_for_character(uuid,text,double precision,double precision,bigint,uuid,uuid) from public, anon;

grant execute on function public.save_player_world_position_for_character(double precision,double precision,text,bigint,uuid,uuid) to authenticated;
grant execute on function public.travel_to_city_location_for_character(uuid,text,double precision,double precision,bigint,uuid,uuid) to authenticated;

notify pgrst, 'reload schema';

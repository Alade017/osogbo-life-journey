-- Bind local city travel to the exact character that initiated the request.
-- Locking profiles serializes this mutation against a concurrent character insert.
create or replace function public._assert_active_character(p_expected_character_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_character_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHORIZED';
  end if;

  perform 1 from public.profiles where id = v_user_id for update;
  if not found then
    raise exception 'NO_CHARACTER';
  end if;

  select id into v_character_id
  from public.characters
  where user_id = v_user_id
  order by created_at desc, id desc
  limit 1;

  if p_expected_character_id is null
     or v_character_id is distinct from p_expected_character_id then
    raise exception 'CHARACTER_CHANGED';
  end if;

  return v_character_id;
end
$$;

revoke all on function public._assert_active_character(uuid) from public, anon, authenticated;

create or replace function public.travel_to_location_for_character(
  p_location_id uuid,
  p_mode text,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_active_character(p_expected_character_id);
  return public.travel_to_location(p_location_id, p_mode);
end
$$;

-- Authenticated clients must use the character-bound entry point. The wrapper
-- invokes the existing authoritative travel implementation in this transaction.
revoke all on function public.travel_to_location(uuid, text) from public, anon, authenticated;
revoke all on function public.travel_to_location_for_character(uuid, text, uuid) from public, anon;
grant execute on function public.travel_to_location_for_character(uuid, text, uuid) to authenticated;

notify pgrst, 'reload schema';

-- Bind every party mutation to the character selected by the initiating UI.
-- The helper locks the auth.users row. Character inserts reference auth.users via
-- their user_id FK, so a concurrent character creation must finish before this
-- check or wait until the party operation commits. The legacy RPC then executes
-- in this same transaction and retains its existing validation/idempotency logic.

create or replace function public._assert_party_action_character(p_expected_character_id uuid)
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
    raise exception 'Sign in and create a character first';
  end if;

  perform 1 from auth.users where id = v_user_id for update;
  if not found then
    raise exception 'Sign in and create a character first';
  end if;

  select id into v_character_id
  from public.characters
  where user_id = v_user_id
  order by created_at desc
  limit 1;

  if p_expected_character_id is null
     or v_character_id is distinct from p_expected_character_id then
    raise exception 'CHARACTER_CHANGED';
  end if;

  return v_character_id;
end
$$;

revoke all on function public._assert_party_action_character(uuid) from public, anon, authenticated;

create or replace function public.enter_club_for_character(
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.enter_club(p_request_id);
end
$$;

create or replace function public.leave_club_for_character(
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.leave_club(p_request_id);
end
$$;

create or replace function public.join_club_activity_for_character(
  p_activity_slug text,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.join_club_activity(p_activity_slug, p_request_id);
end
$$;

create or replace function public.buy_drink_for_character(
  p_drink_slug text,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.buy_drink(p_drink_slug, p_request_id);
end
$$;

create or replace function public.dance_with_player_for_character(
  p_target_character_id uuid,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.dance_with_player(p_target_character_id, p_request_id);
end
$$;

create or replace function public.host_party_event_for_character(
  p_location_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_requirements jsonb,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.host_party_event(p_location_id, p_title, p_starts_at, p_requirements, p_request_id);
end
$$;

create or replace function public.respond_to_event_for_character(
  p_requirement_id uuid,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.respond_to_event(p_requirement_id, p_request_id);
end
$$;

revoke all on function public.enter_club_for_character(uuid, uuid) from public, anon;
revoke all on function public.leave_club_for_character(uuid, uuid) from public, anon;
revoke all on function public.join_club_activity_for_character(text, uuid, uuid) from public, anon;
revoke all on function public.buy_drink_for_character(text, uuid, uuid) from public, anon;
revoke all on function public.dance_with_player_for_character(uuid, uuid, uuid) from public, anon;
revoke all on function public.host_party_event_for_character(uuid, text, timestamptz, jsonb, uuid, uuid) from public, anon;
revoke all on function public.respond_to_event_for_character(uuid, uuid, uuid) from public, anon;

grant execute on function public.enter_club_for_character(uuid, uuid) to authenticated;
grant execute on function public.leave_club_for_character(uuid, uuid) to authenticated;
grant execute on function public.join_club_activity_for_character(text, uuid, uuid) to authenticated;
grant execute on function public.buy_drink_for_character(text, uuid, uuid) to authenticated;
grant execute on function public.dance_with_player_for_character(uuid, uuid, uuid) to authenticated;
grant execute on function public.host_party_event_for_character(uuid, text, timestamptz, jsonb, uuid, uuid) to authenticated;
grant execute on function public.respond_to_event_for_character(uuid, uuid, uuid) to authenticated;

-- Apply the same account-level serialization to NPC dancing. The existing
-- character-bound implementation remains the source of dance/cooldown logic.
create or replace function public.dance_with_npc_for_character_locked(
  p_npc_slug text,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public._assert_party_action_character(p_expected_character_id);
  return public.dance_with_npc_for_character(
    p_npc_slug,
    p_request_id,
    p_expected_character_id
  );
end
$$;

revoke all on function public.dance_with_npc_for_character_locked(text, uuid, uuid) from public, anon;
grant execute on function public.dance_with_npc_for_character_locked(text, uuid, uuid) to authenticated;

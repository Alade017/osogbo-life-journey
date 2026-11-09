-- Bind an in-flight party dance to the character that initiated it.
-- Keep the original two-argument RPC intact for existing callers; the game client
-- uses this explicit-character variant to prevent character-switch races.
create or replace function public.dance_with_npc_for_character(
  p_npc_slug text,
  p_request_id uuid,
  p_expected_character_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cid uuid;
  c public.characters%rowtype;
  v public.club_visits%rowtype;
  last_at timestamptz;
  mood integer;
  result jsonb;
begin
  if uid is null then
    raise exception 'Sign in and create a character first';
  end if;
  select id into cid
    from public.characters
    where user_id = uid
    order by created_at desc
    limit 1;
  if cid is null then
    raise exception 'Sign in and create a character first';
  end if;
  if p_expected_character_id is null or cid is distinct from p_expected_character_id then
    raise exception 'CHARACTER_CHANGED';
  end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  if p_npc_slug is null or p_npc_slug !~ '^[a-z0-9-]{1,40}$' then raise exception 'Choose a dancer'; end if;

  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));
  select er.result into result from public.economy_request_results er
    where er.character_id = cid and er.request_id = p_request_id and er.operation = 'party_dance_npc';
  if found then return result; end if;

  select * into c from public.characters where id = cid and user_id = uid for update;
  if not found then raise exception 'Character not found'; end if;
  v := public._party_active_visit(cid);
  if v.id is null or v.location_id is distinct from c.current_location_id then
    raise exception 'Join the club to dance';
  end if;

  select last_dance_at into last_at from public.party_dance_cooldowns where character_id = cid;
  if found and last_at > now() - interval '60 seconds' then
    raise exception 'Rest a moment before dancing again';
  end if;

  insert into public.party_dance_cooldowns(character_id, last_dance_at)
    values (cid, now())
    on conflict (character_id) do update set last_dance_at = excluded.last_dance_at;
  mood := public.apply_party_mood(cid, uid, 3);
  result := jsonb_build_object('partner', 'npc', 'npc', p_npc_slug, 'mood', mood);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values (cid, p_request_id, 'party_dance_npc', result);
  return result;
end $$;

revoke all on function public.dance_with_npc_for_character(text, uuid, uuid) from public, anon;
grant execute on function public.dance_with_npc_for_character(text, uuid, uuid) to authenticated;

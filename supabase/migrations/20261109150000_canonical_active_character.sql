-- The app, Colyseus room and account-scoped RPCs must agree on one active
-- character. Multiple characters are supported; the newest row is canonical.
-- The UUID tie-breaker makes selection deterministic if timestamps are equal.
create or replace function public._my_character_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.characters
  where user_id = auth.uid()
  order by created_at desc, id desc
  limit 1
$$;

-- Preserve the helper's internal-only execution contract.
revoke execute on function public._my_character_id() from public, anon, authenticated;

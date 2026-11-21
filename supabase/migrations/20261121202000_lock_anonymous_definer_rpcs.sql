-- Anonymous visitors have no use for the player RPCs. Each one checks the caller's character first, so an
-- anonymous call only ever failed, but there is no reason to leave execute open. Remove anon (and PUBLIC) execute
-- from every SECURITY DEFINER function in public, then grant it back to signed-in players and the service role.
-- Kept as they are: the RLS helpers (_my_character_id, _my_social_character_id, _social_blocked), the signup
-- trigger (handle_new_user) and is_advertisement_admin.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f' and p.prosecdef
      and p.proname not in ('_my_character_id', '_my_social_character_id', '_social_blocked', 'handle_new_user', 'is_advertisement_admin')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;

notify pgrst, 'reload schema';

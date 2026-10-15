-- Reconcile personal game time with elapsed real time when the player returns.
-- Paused simulations remain paused; normal ticks still ignore long disconnects.
do $$
declare
  definition text;
  old_condition text := $old$if p_command<>'open' and not s.paused and s.active_action is null
    and now()-s.heartbeat_at<=interval '15 seconds' then$old$;
  new_condition text := $new$if not s.paused and s.active_action is null
    and (p_command='open' or now()-s.heartbeat_at<=interval '15 seconds') then$new$;
begin
  select pg_get_functiondef(
    'public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb)'::regprocedure
  ) into definition;

  if position(old_condition in definition) = 0 then
    raise exception 'Could not locate the expected active-session clock condition';
  end if;

  definition := replace(definition, old_condition, new_condition);
  execute definition;
end
$$;

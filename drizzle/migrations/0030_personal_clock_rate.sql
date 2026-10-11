-- Set personal simulation time to a literal 1:1 rate: one game minute per
-- real minute at 1x. World schedules remain tied to the separate Osogbo clock.
do $$
declare
  definition text;
  old_rate text := 'elapsed*s.speed/6';
begin
  select pg_get_functiondef(
    'public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb)'::regprocedure
  ) into definition;

  if position(old_rate in definition) = 0 then
    raise exception 'Could not locate the expected personal simulation clock rate';
  end if;

  definition := replace(definition, old_rate, 'elapsed*s.speed/60');
  execute definition;
end
$$;

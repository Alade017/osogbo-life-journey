-- Milestone 5.6: apply configured job duration and needs costs through the existing game systems.

create or replace function public.perform_job() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  cj public.character_jobs%rowtype;
  j public.jobs%rowtype;
  player public.characters%rowtype;
  e integer;
  lvl integer;
  ready_at timestamptz;
  game_time jsonb;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid and user_id = auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;

  select * into cj from public.character_jobs
    where character_id = cid and is_current for update;
  if not found then raise exception 'Select a job first'; end if;

  select * into j from public.jobs where id = cj.job_id and is_available;
  if not found then raise exception 'This job is no longer available'; end if;
  if j.location_id is not null and player.current_location_id is distinct from j.location_id then
    raise exception 'Travel back to % before your next shift',
      (select name from public.locations where id = j.location_id);
  end if;
  if not public._course_completed(cid, j.required_course_slug) then
    raise exception 'Complete the required course before working this job';
  end if;

  ready_at := cj.last_performed_at + make_interval(mins => j.cooldown_minutes);
  if cj.last_performed_at is not null and now() < ready_at then
    raise exception 'Still on cooldown';
  end if;

  e := public._refresh_energy(cid);
  if e < j.energy_cost then raise exception 'Not enough energy (need %)', j.energy_cost; end if;

  update public.characters set
    energy = e - j.energy_cost,
    hunger = least(100, hunger + j.hunger_cost),
    thirst = least(100, thirst + j.thirst_cost),
    stress = least(100, stress + 6),
    happiness = greatest(0, happiness - 1),
    career = least(100, career + 1),
    intelligence = case when j.stat_bonus = 'intelligence' then least(100, intelligence + 1) else intelligence end,
    social = case when j.stat_bonus = 'social' then least(100, social + 1) else social end,
    reputation = case when j.stat_bonus = 'reputation' then least(100, reputation + 1) else reputation end,
    health = case when j.energy_cost >= 30 then greatest(0, health - 1) else health end
  where id = cid;

  -- Clock, needs, employment count, and rewards commit or roll back together.
  game_time := public._advance_character_game_time(cid, j.duration_minutes);
  update public.character_jobs set
    times_performed = times_performed + 1,
    last_performed_at = now()
  where id = cj.id;

  perform public._credit(
    cid,
    j.salary,
    'job',
    'Completed ' || j.name || ' at ' || coalesce(
      (select name from public.game_places where id = j.place_id),
      'your workplace'
    )
  );
  lvl := public._grant_xp(cid, j.xp_reward);
  perform public._recalc_missions(cid);

  return jsonb_build_object(
    'earned', j.salary,
    'xp', j.xp_reward,
    'energy_spent', j.energy_cost,
    'hunger_gained', j.hunger_cost,
    'thirst_gained', j.thirst_cost,
    'duration_minutes', j.duration_minutes,
    'game_time', game_time,
    'level', lvl
  );
end $$;

revoke execute on function public.perform_job() from public, anon;
grant execute on function public.perform_job() to authenticated;

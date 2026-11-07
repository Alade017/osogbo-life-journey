-- Catalogue activities are completed atomically through the active personal simulation.
-- Requires the current Drizzle baseline (through 0079) and the Supabase migrations through 20261106120200.
-- Do not mirror this dated Supabase migration in the Drizzle journal.

create table public.activity_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  activity_id uuid not null references public.activities(id) on delete restrict,
  activity_slug text not null,
  activity_name text not null,
  category text not null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  cooldown_minutes integer not null check (cooldown_minutes >= 0),
  xp_reward integer not null check (xp_reward >= 0),
  energy_delta integer not null,
  hunger_delta integer not null,
  thirst_delta integer not null,
  configured_rewards jsonb not null default '{}'::jsonb
    check (jsonb_typeof(configured_rewards) = 'object'),
  request_id uuid not null,
  completed_at timestamptz not null default clock_timestamp(),
  unique (character_id, request_id)
);

create index activity_completions_character_recent_idx
  on public.activity_completions(character_id, completed_at desc);
create index activity_completions_cooldown_idx
  on public.activity_completions(character_id, activity_id, completed_at desc);

alter table public.activity_completions enable row level security;
revoke all on public.activity_completions from public, anon, authenticated;
grant select on public.activity_completions to authenticated;
grant all on public.activity_completions to service_role;
create policy "Read own activity completions" on public.activity_completions
  for select to authenticated using (user_id = (select auth.uid()));

-- The browser may preview eligibility, but only this server-side validator decides.
create function public._activity_requirement_errors(
  p_character_id uuid,
  p_activity_id uuid,
  p_game_hour integer
) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  requirements jsonb;
  entry jsonb;
  v_skill_slug text;
  item_slug text;
  minimum_level integer;
  minimum_experience integer;
  minimum_reputation integer;
  player_level integer;
  player_reputation integer;
  skill_level integer;
  skill_experience integer;
  current_location_slug text;
  start_hour integer;
  end_hour integer;
begin
  select a.requirements into requirements
  from public.activities a where a.id = p_activity_id;

  if jsonb_typeof(requirements) is distinct from 'object' then
    return array['This activity has invalid requirement data.'];
  end if;

  if requirements - array[
    'type', 'level', 'skills', 'items', 'minimum_reputation',
    'location_slug', 'available_hours'
  ] <> '{}'::jsonb then
    return array['This activity contains unsupported requirement settings.'];
  end if;

  if requirements ? 'type' and requirements->>'type' is distinct from 'none' then
    return array['This activity contains an unsupported requirement type.'];
  end if;

  select c.level, c.reputation, l.slug
    into player_level, player_reputation, current_location_slug
  from public.characters c
  left join public.locations l on l.id = c.current_location_id
  where c.id = p_character_id;

  if requirements ? 'level' then
    if jsonb_typeof(requirements->'level') <> 'number'
       or (requirements->>'level')::numeric <> trunc((requirements->>'level')::numeric)
       or (requirements->>'level')::numeric not between 0 and 100 then
      return array['This activity has an invalid level requirement.'];
    end if;
    if player_level < (requirements->>'level')::integer then
      return array[format('Requires Level %s.', (requirements->>'level')::integer)];
    end if;
  end if;

  if requirements ? 'minimum_reputation' then
    if jsonb_typeof(requirements->'minimum_reputation') <> 'number'
       or (requirements->>'minimum_reputation')::numeric <> trunc((requirements->>'minimum_reputation')::numeric)
       or (requirements->>'minimum_reputation')::numeric not between 0 and 1000000 then
      return array['This activity has an invalid reputation requirement.'];
    end if;
    minimum_reputation := (requirements->>'minimum_reputation')::integer;
    if player_reputation < minimum_reputation then
      return array[format('Requires %s reputation.', minimum_reputation)];
    end if;
  end if;

  if requirements ? 'location_slug' then
    if jsonb_typeof(requirements->'location_slug') <> 'string'
       or length(trim(requirements->>'location_slug')) = 0 then
      return array['This activity has an invalid location requirement.'];
    end if;
    if current_location_slug is distinct from trim(requirements->>'location_slug') then
      return array[format('Travel to %s to do this activity.', replace(requirements->>'location_slug', '-', ' '))];
    end if;
  end if;

  if requirements ? 'skills' then
    if jsonb_typeof(requirements->'skills') <> 'array' then
      return array['This activity has invalid skill requirements.'];
    end if;
    for entry in select value from jsonb_array_elements(requirements->'skills') as rows(value) loop
      if jsonb_typeof(entry) <> 'object'
         or entry - array['slug', 'minimum_level', 'minimum_experience'] <> '{}'::jsonb
         or jsonb_typeof(entry->'slug') <> 'string'
         or coalesce(entry->>'slug', '') !~ '^[a-z0-9]+([_-][a-z0-9]+)*$' then
        return array['This activity has an invalid skill requirement.'];
      end if;
      v_skill_slug := entry->>'slug';
      minimum_level := 0;
      minimum_experience := 0;
      if entry ? 'minimum_level' then
        if jsonb_typeof(entry->'minimum_level') <> 'number'
           or (entry->>'minimum_level')::numeric <> trunc((entry->>'minimum_level')::numeric)
           or (entry->>'minimum_level')::numeric not between 0 and 100 then
          return array['This activity has an invalid skill-level requirement.'];
        end if;
        minimum_level := (entry->>'minimum_level')::integer;
      end if;
      if entry ? 'minimum_experience' then
        if jsonb_typeof(entry->'minimum_experience') <> 'number'
           or (entry->>'minimum_experience')::numeric <> trunc((entry->>'minimum_experience')::numeric)
           or (entry->>'minimum_experience')::numeric not between 0 and 100000000 then
          return array['This activity has an invalid skill-experience requirement.'];
        end if;
        minimum_experience := (entry->>'minimum_experience')::integer;
      end if;
      select ps.level, ps.experience into skill_level, skill_experience
      from public.player_skills ps
      where ps.character_id = p_character_id and ps.skill_slug = v_skill_slug;
      if coalesce(skill_level, 0) < minimum_level
         or coalesce(skill_experience, 0) < minimum_experience then
        return array[format('Requires %s skill level %s and %s experience.',
          replace(v_skill_slug, '_', ' '), minimum_level, minimum_experience)];
      end if;
    end loop;
  end if;

  if requirements ? 'items' then
    if jsonb_typeof(requirements->'items') <> 'array' then
      return array['This activity has invalid item requirements.'];
    end if;
    for entry in select value from jsonb_array_elements(requirements->'items') as rows(value) loop
      if jsonb_typeof(entry) <> 'string'
         or coalesce(entry#>>'{}', '') !~ '^[a-z0-9]+([_-][a-z0-9]+)*$' then
        return array['This activity has an invalid item requirement.'];
      end if;
      item_slug := entry#>>'{}';
      if not exists (
        select 1
        from public.player_inventory pi
        join public.inventory_items ii on ii.id = pi.item_id
        where pi.character_id = p_character_id and pi.quantity > 0 and ii.slug = item_slug
      ) then
        return array[format('Requires %s in your inventory.', replace(item_slug, '_', ' '))];
      end if;
    end loop;
  end if;

  if requirements ? 'available_hours' then
    if jsonb_typeof(requirements->'available_hours') <> 'object'
       or requirements->'available_hours' - array['start', 'end'] <> '{}'::jsonb
       or jsonb_typeof(requirements->'available_hours'->'start') is distinct from 'number'
       or jsonb_typeof(requirements->'available_hours'->'end') is distinct from 'number' then
      return array['This activity has invalid availability hours.'];
    end if;
    if (requirements->'available_hours'->>'start')::numeric <> trunc((requirements->'available_hours'->>'start')::numeric)
       or (requirements->'available_hours'->>'end')::numeric <> trunc((requirements->'available_hours'->>'end')::numeric)
       or (requirements->'available_hours'->>'start')::numeric not between 0 and 23
       or (requirements->'available_hours'->>'end')::numeric not between 0 and 23 then
      return array['This activity has invalid availability hours.'];
    end if;
    start_hour := (requirements->'available_hours'->>'start')::integer;
    end_hour := (requirements->'available_hours'->>'end')::integer;
    if start_hour = end_hour then
      return array['This activity has invalid availability hours.'];
    end if;
    if (start_hour < end_hour and (p_game_hour < start_hour or p_game_hour >= end_hour))
       or (start_hour > end_hour and p_game_hour < start_hour and p_game_hour >= end_hour) then
      return array[format('Available between %s:00 and %s:00 game time.', start_hour, end_hour)];
    end if;
  end if;

  return array[]::text[];
end;
$$;
revoke all on function public._activity_requirement_errors(uuid, uuid, integer) from public, anon, authenticated;

create function public.perform_catalog_activity(
  p_session uuid,
  p_revision bigint,
  p_activity_slug text,
  p_request_id uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  c public.characters%rowtype;
  s public.character_simulations%rowtype;
  a public.activities%rowtype;
  prior public.activity_completions%rowtype;
  completion public.activity_completions%rowtype;
  source jsonb;
  source_time jsonb;
  next_needs jsonb;
  next_time jsonb;
  requirement_errors text[];
  next_energy integer;
  next_hunger integer;
  next_thirst integer;
  total_minutes integer;
  elapsed_minutes integer;
  last_completed_at timestamptz;
  remaining_seconds integer;
  prior_cooldown integer;
  elapsed numeric := 0;
  server_minutes integer := 0;
  next_remainder numeric := 0;
  activity_elapsed_minutes integer := 0;
  reward_social integer := 0;
  reward_skill_slug text;
  reward_skill_xp integer := 0;
  current_skill_xp integer;
  next_skill_xp integer;
  elapsed_hunger_rate numeric := 0.035;
  elapsed_energy_rate numeric := 0.025;
  elapsed_hygiene_rate numeric := 0.018;
  elapsed_bladder_rate numeric := 0.03;
  elapsed_fun_rate numeric := 0.02;
  elapsed_social_rate numeric := 0.012;
begin
  if uid is null or cid is null or p_session is null then
    raise exception 'Sign in and create a character first';
  end if;
  if p_request_id is null or p_activity_slug is null
     or length(p_activity_slug) not between 1 and 120 then
    raise exception 'Invalid activity request';
  end if;

  -- Match the simulation engine's lock order: character, then simulation.
  select * into c from public.characters
  where id = cid and user_id = uid for update;
  if not found then raise exception 'Character not found'; end if;

  select * into prior from public.activity_completions
  where character_id = cid and request_id = p_request_id;
  if found then
    if prior.activity_slug <> p_activity_slug then
      raise exception 'Request ID belongs to a different activity';
    end if;
    select * into s from public.character_simulations
    where character_id = cid for update;
    if not found or s.session_id is distinct from p_session then
      raise exception 'Reconnect your personal simulation before retrying this activity';
    end if;
    return jsonb_build_object(
      'snapshot', jsonb_build_object(
        'revision', s.revision, 'needs', s.needs, 'game_time', s.personal_time,
        'paused', s.paused, 'speed', s.speed, 'action', s.active_action, 'request_id', s.active_request,
        'sleep_elapsed_seconds', s.sleep_elapsed_seconds,
        'home_action_elapsed_seconds', s.home_action_elapsed_seconds,
        'home_action_duration_seconds', s.home_action_duration_seconds,
        'skills', s.skills, 'queued_actions', s.queued_actions
      ),
      'activity', jsonb_build_object(
        'id', prior.id, 'slug', prior.activity_slug, 'name', prior.activity_name,
        'category', prior.category, 'duration_minutes', prior.duration_minutes,
        'cooldown_minutes', prior.cooldown_minutes, 'xp_reward', prior.xp_reward,
        'energy_delta', prior.energy_delta, 'hunger_delta', prior.hunger_delta,
        'thirst_delta', prior.thirst_delta, 'configured_rewards', prior.configured_rewards,
        'completed_at', prior.completed_at,
        'cooldown_ends_at', case when prior.cooldown_minutes > 0
          then prior.completed_at + make_interval(mins => prior.cooldown_minutes) else null end
      ),
      'duplicate', true
    );
  end if;

  source := jsonb_build_object(
    'energy', c.energy, 'hunger', 100 - c.hunger, 'fun', c.happiness, 'social', c.social
  );
  source_time := jsonb_build_object(
    'minute', c.game_time_minute, 'hour', c.game_time_hour,
    'day', c.game_day, 'weekday', c.game_weekday
  );
  insert into public.character_simulations(
    character_id, user_id, personal_time, needs, character_snapshot, character_time
  )
  values (
    cid, uid, source_time, source || '{"hygiene":80,"bladder":72}'::jsonb, source, source_time
  ) on conflict (character_id) do nothing;

  select * into s from public.character_simulations
  where character_id = cid for update;

  if s.session_id is distinct from p_session or s.revision is distinct from p_revision then
    raise exception 'Simulation changed on another device. Reconnect before continuing.';
  end if;
  if s.paused then raise exception 'Resume your personal simulation first'; end if;
  if s.active_action is not null then
    raise exception 'Finish or interrupt your current activity first';
  end if;
  if s.heartbeat_at < clock_timestamp() - interval '15 seconds' then
    raise exception 'Your simulation needs to reconnect before starting an activity';
  end if;

  select * into a from public.activities
  where slug = p_activity_slug and is_available
    and coalesce(metadata->>'server_action', '') <> 'map_place_action'
  for share;
  if not found then raise exception 'This activity is no longer available'; end if;

  if a.location_id is not null and c.current_location_id is distinct from a.location_id then
    raise exception 'Travel to the activity location first';
  end if;

  requirement_errors := public._activity_requirement_errors(
    cid, a.id, (s.personal_time->>'hour')::integer
  );
  if cardinality(requirement_errors) > 0 then
    raise exception '%', requirement_errors[1];
  end if;

  if a.cooldown_minutes > 0 then
    select completed_at, cooldown_minutes into last_completed_at, prior_cooldown
    from public.activity_completions
    where character_id = cid and activity_id = a.id
    order by completed_at desc limit 1;
    if last_completed_at is not null and prior_cooldown > 0
       and last_completed_at + make_interval(mins => prior_cooldown) > clock_timestamp() then
      remaining_seconds := ceil(extract(epoch from (
        last_completed_at + make_interval(mins => prior_cooldown) - clock_timestamp()
      )))::integer;
      raise exception 'This activity is cooling down. Try again in % seconds.', remaining_seconds;
    end if;
  end if;

  if c.personality = 'easygoing' then elapsed_fun_rate := 0.016; end if;
  if c.personality = 'social' then elapsed_social_rate := 0.0108; end if;
  if c.personality = 'studious' and exists (
    select 1 from public.locations where id = c.current_location_id and type in ('residential', 'home')
  ) then elapsed_hygiene_rate := 0.0162; end if;

  elapsed := greatest(0, extract(epoch from clock_timestamp() - s.heartbeat_at)) * s.speed / 60 + s.minute_remainder;
  server_minutes := floor(elapsed)::integer;
  next_remainder := elapsed - server_minutes;
  activity_elapsed_minutes := a.duration_minutes + server_minutes;
  next_energy := greatest(0, least(100, round(c.energy - elapsed_energy_rate * activity_elapsed_minutes + a.energy_delta)::integer));
  next_hunger := greatest(0, least(100, round(c.hunger - elapsed_hunger_rate * activity_elapsed_minutes + a.hunger_delta)::integer));
  next_thirst := greatest(0, least(100, c.thirst + a.thirst_delta));
  next_needs := s.needs;
  if jsonb_typeof(next_needs) is distinct from 'object'
     or not (next_needs ? 'energy') or not (next_needs ? 'hunger') then
    raise exception 'Personal simulation needs are not ready. Reconnect and retry.';
  end if;
  next_needs := jsonb_set(next_needs, '{energy}', to_jsonb(next_energy), true);
  next_needs := jsonb_set(next_needs, '{hunger}', to_jsonb(100 - next_hunger), true);
  next_needs := jsonb_set(next_needs, '{hygiene}', to_jsonb(greatest(0, least(100,
    (next_needs->>'hygiene')::numeric - elapsed_hygiene_rate * activity_elapsed_minutes))), true);
  next_needs := jsonb_set(next_needs, '{bladder}', to_jsonb(greatest(0, least(100,
    (next_needs->>'bladder')::numeric - elapsed_bladder_rate * activity_elapsed_minutes))), true);
  next_needs := jsonb_set(next_needs, '{fun}', to_jsonb(greatest(0, least(100,
    (next_needs->>'fun')::numeric - elapsed_fun_rate * activity_elapsed_minutes))), true);
  next_needs := jsonb_set(next_needs, '{social}', to_jsonb(greatest(0, least(100,
    (next_needs->>'social')::numeric - elapsed_social_rate * activity_elapsed_minutes))), true);

  if a.rewards ? 'social' then
    if jsonb_typeof(a.rewards->'social') is distinct from 'number'
       or (a.rewards->>'social')::numeric <> trunc((a.rewards->>'social')::numeric)
       or (a.rewards->>'social')::numeric not between -100 and 100 then
      raise exception 'This activity has invalid social reward configuration';
    end if;
    reward_social := (a.rewards->>'social')::integer;
    next_needs := jsonb_set(next_needs, '{social}', to_jsonb(greatest(0, least(100,
      (next_needs->>'social')::numeric + reward_social))), true);
  end if;

  -- Skill XP is data-driven: only an explicit {slug, xp} object is executable.
  -- Legacy string values such as "study" do not define an XP amount and are not paid.
  if a.rewards ? 'skillXp' and jsonb_typeof(a.rewards->'skillXp') = 'object' then
    if a.rewards->'skillXp' - array['slug', 'xp'] <> '{}'::jsonb
       or jsonb_typeof(a.rewards->'skillXp'->'slug') is distinct from 'string'
       or coalesce(a.rewards->'skillXp'->>'slug', '') !~ '^[a-z0-9]+([_-][a-z0-9]+)*
    + (s.personal_time->>'minute')::integer + activity_elapsed_minutes;
  elapsed_minutes := total_minutes / 1440;
  next_time := jsonb_build_object(
    'minute', mod(total_minutes, 60),
    'hour', mod(total_minutes / 60, 24),
    'day', (s.personal_time->>'day')::integer + elapsed_minutes,
    'weekday', mod((s.personal_time->>'weekday')::integer + elapsed_minutes, 7)
  );

  update public.characters set
    energy = next_energy,
    hunger = next_hunger,
    thirst = next_thirst,
    happiness = round((next_needs->>'fun')::numeric),
    social = round((next_needs->>'social')::numeric)
  where id = cid;

  update public.character_simulations set
    revision = revision + 1,
    heartbeat_at = clock_timestamp(),
    minute_remainder = next_remainder,
    personal_time = next_time,
    needs = next_needs,
    character_snapshot = jsonb_build_object(
      'energy', next_energy, 'hunger', 100 - next_hunger,
      'fun', (next_needs->>'fun')::numeric,
      'social', (next_needs->>'social')::numeric
    )
  where character_id = cid
  returning * into s;

  if a.xp_reward > 0 then
    perform public._grant_xp(cid, a.xp_reward);
    perform public._recalc_missions(cid);
  end if;

  insert into public.activity_completions(
    user_id, character_id, activity_id, activity_slug, activity_name, category,
    duration_minutes, cooldown_minutes, xp_reward, energy_delta, hunger_delta,
    thirst_delta, configured_rewards, request_id
  ) values (
    uid, cid, a.id, a.slug, a.name, a.category, a.duration_minutes, a.cooldown_minutes,
    a.xp_reward, a.energy_delta, a.hunger_delta, a.thirst_delta, a.rewards, p_request_id
  ) returning * into completion;

  return jsonb_build_object(
    'snapshot', jsonb_build_object(
      'revision', s.revision, 'needs', s.needs, 'game_time', s.personal_time,
      'paused', s.paused, 'speed', s.speed, 'action', null, 'request_id', null,
      'sleep_elapsed_seconds', s.sleep_elapsed_seconds,
      'home_action_elapsed_seconds', s.home_action_elapsed_seconds,
      'home_action_duration_seconds', s.home_action_duration_seconds,
      'skills', s.skills, 'queued_actions', s.queued_actions
    ),
    'activity', jsonb_build_object(
      'id', completion.id, 'slug', completion.activity_slug, 'name', completion.activity_name,
      'category', completion.category, 'duration_minutes', completion.duration_minutes,
      'cooldown_minutes', completion.cooldown_minutes, 'xp_reward', completion.xp_reward,
      'energy_delta', completion.energy_delta, 'hunger_delta', completion.hunger_delta,
      'thirst_delta', completion.thirst_delta, 'configured_rewards', completion.configured_rewards,
      'completed_at', completion.completed_at,
      'cooldown_ends_at', case when completion.cooldown_minutes > 0
        then completion.completed_at + make_interval(mins => completion.cooldown_minutes) else null end
    ),
    'duplicate', false
  );
end;
$$;

revoke all on function public.perform_catalog_activity(uuid, bigint, text, uuid) from public, anon;
grant execute on function public.perform_catalog_activity(uuid, bigint, text, uuid) to authenticated;
notify pgrst, 'reload schema';

       or jsonb_typeof(a.rewards->'skillXp'->'xp') is distinct from 'number'
       or (a.rewards->'skillXp'->>'xp')::numeric <> trunc((a.rewards->'skillXp'->>'xp')::numeric)
       or (a.rewards->'skillXp'->>'xp')::numeric not between 0 and 10000 then
      raise exception 'This activity has invalid skill reward configuration';
    end if;
    reward_skill_slug := a.rewards->'skillXp'->>'slug';
    reward_skill_xp := (a.rewards->'skillXp'->>'xp')::integer;
    if reward_skill_xp > 0 then
      select experience into current_skill_xp
      from public.player_skills
      where character_id = cid and skill_slug = reward_skill_slug
      for update;
      next_skill_xp := least(100000000, coalesce(current_skill_xp, 0) + reward_skill_xp);
      insert into public.player_skills(user_id, character_id, skill_slug, level, experience)
      values(uid, cid, reward_skill_slug, least(100, next_skill_xp / 100), next_skill_xp)
      on conflict (character_id, skill_slug) do update
        set experience = excluded.experience, level = excluded.level;
    end if;
  end if;

  total_minutes := (s.personal_time->>'hour')::integer * 60
    + (s.personal_time->>'minute')::integer + activity_elapsed_minutes;
  elapsed_minutes := total_minutes / 1440;
  next_time := jsonb_build_object(
    'minute', mod(total_minutes, 60),
    'hour', mod(total_minutes / 60, 24),
    'day', (s.personal_time->>'day')::integer + elapsed_minutes,
    'weekday', mod((s.personal_time->>'weekday')::integer + elapsed_minutes, 7)
  );

  update public.characters set
    energy = next_energy,
    hunger = next_hunger,
    thirst = next_thirst,
    happiness = round((next_needs->>'fun')::numeric),
    social = round((next_needs->>'social')::numeric)
  where id = cid;

  update public.character_simulations set
    revision = revision + 1,
    heartbeat_at = clock_timestamp(),
    minute_remainder = next_remainder,
    personal_time = next_time,
    needs = next_needs,
    character_snapshot = jsonb_build_object(
      'energy', next_energy, 'hunger', 100 - next_hunger,
      'fun', (next_needs->>'fun')::numeric,
      'social', (next_needs->>'social')::numeric
    )
  where character_id = cid
  returning * into s;

  if a.xp_reward > 0 then
    perform public._grant_xp(cid, a.xp_reward);
    perform public._recalc_missions(cid);
  end if;

  insert into public.activity_completions(
    user_id, character_id, activity_id, activity_slug, activity_name, category,
    duration_minutes, cooldown_minutes, xp_reward, energy_delta, hunger_delta,
    thirst_delta, configured_rewards, request_id
  ) values (
    uid, cid, a.id, a.slug, a.name, a.category, a.duration_minutes, a.cooldown_minutes,
    a.xp_reward, a.energy_delta, a.hunger_delta, a.thirst_delta, a.rewards, p_request_id
  ) returning * into completion;

  return jsonb_build_object(
    'snapshot', jsonb_build_object(
      'revision', s.revision, 'needs', s.needs, 'game_time', s.personal_time,
      'paused', s.paused, 'speed', s.speed, 'action', null, 'request_id', null,
      'sleep_elapsed_seconds', s.sleep_elapsed_seconds,
      'home_action_elapsed_seconds', s.home_action_elapsed_seconds,
      'home_action_duration_seconds', s.home_action_duration_seconds,
      'skills', s.skills, 'queued_actions', s.queued_actions
    ),
    'activity', jsonb_build_object(
      'id', completion.id, 'slug', completion.activity_slug, 'name', completion.activity_name,
      'category', completion.category, 'duration_minutes', completion.duration_minutes,
      'cooldown_minutes', completion.cooldown_minutes, 'xp_reward', completion.xp_reward,
      'energy_delta', completion.energy_delta, 'hunger_delta', completion.hunger_delta,
      'thirst_delta', completion.thirst_delta, 'configured_rewards', completion.configured_rewards,
      'completed_at', completion.completed_at,
      'cooldown_ends_at', case when completion.cooldown_minutes > 0
        then completion.completed_at + make_interval(mins => completion.cooldown_minutes) else null end
    ),
    'duplicate', false
  );
end;
$$;

revoke all on function public.perform_catalog_activity(uuid, bigint, text, uuid) from public, anon;
grant execute on function public.perform_catalog_activity(uuid, bigint, text, uuid) to authenticated;
notify pgrst, 'reload schema';

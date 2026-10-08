-- Milestone 5.3: expose level/skill requirements and enforce them on job selection and work.

create table if not exists public.player_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  skill_slug text not null check (skill_slug ~ '^[a-z0-9]+([_-][a-z0-9]+)*$'),
  level integer not null default 0 check (level between 0 and 100),
  experience integer not null default 0 check (experience between 0 and 100000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, skill_slug)
);
create index if not exists player_skills_owner_idx on public.player_skills(user_id, character_id);
create trigger t_player_skills before update on public.player_skills
  for each row execute function public.touch_updated_at();
alter table public.player_skills enable row level security;
revoke all on public.player_skills from public, anon, authenticated;
grant select on public.player_skills to authenticated;
grant all on public.player_skills to service_role;
drop policy if exists "own player skills" on public.player_skills;
create policy "own player skills" on public.player_skills
  for select to authenticated using (user_id = auth.uid());

create or replace function public._job_requirement_errors(p_character_id uuid, p_job_id uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare
  player_level integer;
  job_row public.jobs%rowtype;
  requirements jsonb;
  required_level integer;
  configured_level numeric;
  skill_requirement jsonb;
  v_skill_slug text;
  skill_label text;
  minimum_skill_level integer;
  minimum_experience integer;
  configured_value numeric;
  current_skill_level integer;
  current_experience integer;
  completed_course boolean;
  course_name text;
  errors text[] := array[]::text[];
begin
  select * into job_row from public.jobs where id = p_job_id;
  if not found or not job_row.is_available then
    return array['This job is no longer available.'];
  end if;

  select level into player_level from public.characters where id = p_character_id;
  if not found then return array['Create a character before applying.']; end if;

  requirements := coalesce(job_row.requirements, '{}'::jsonb);
  required_level := job_row.required_level;
  if requirements ? 'level' then
    if jsonb_typeof(requirements -> 'level') <> 'number' then
      errors := array_append(errors, 'This job has an invalid level requirement.');
    else
      configured_level := (requirements ->> 'level')::numeric;
      if configured_level < 1 or configured_level > 100 or configured_level <> trunc(configured_level) then
        errors := array_append(errors, 'This job has an invalid level requirement.');
      else
        required_level := greatest(required_level, configured_level::integer);
      end if;
    end if;
  end if;
  if player_level < required_level then
    errors := array_append(errors, format('Requires Level %s (you are Level %s).', required_level, player_level));
  end if;

  if job_row.required_course_slug is not null
     and not public._course_completed(p_character_id, job_row.required_course_slug) then
    select name into course_name from public.education_courses where slug = job_row.required_course_slug;
    errors := array_append(errors, format('Complete %s to qualify for this job.', coalesce(course_name, job_row.required_course_slug)));
  end if;

  if requirements ? 'skills' and jsonb_typeof(requirements -> 'skills') <> 'array' then
    errors := array_append(errors, 'This job has misconfigured skill requirements.');
  elsif jsonb_typeof(requirements -> 'skills') = 'array' then
    for skill_requirement in select value from jsonb_array_elements(requirements -> 'skills') as entries(value) loop
      if jsonb_typeof(skill_requirement) <> 'object'
         or jsonb_typeof(skill_requirement -> 'slug') <> 'string'
         or nullif(btrim(skill_requirement ->> 'slug'), '') is null then
        errors := array_append(errors, 'This job has misconfigured skill requirements.');
        continue;
      end if;

      v_skill_slug := btrim(skill_requirement ->> 'slug');
      skill_label := initcap(replace(replace(v_skill_slug, '_', ' '), '-', ' '));
      minimum_skill_level := null;
      minimum_experience := null;

      if skill_requirement ? 'minimum_level' then
        if jsonb_typeof(skill_requirement -> 'minimum_level') <> 'number' then
          errors := array_append(errors, 'This job has misconfigured skill requirements.');
          continue;
        end if;
        configured_value := (skill_requirement ->> 'minimum_level')::numeric;
        if configured_value < 0 or configured_value > 100 or configured_value <> trunc(configured_value) then
          errors := array_append(errors, 'This job has misconfigured skill requirements.');
          continue;
        end if;
        minimum_skill_level := configured_value::integer;
      end if;

      if skill_requirement ? 'minimum_experience' then
        if jsonb_typeof(skill_requirement -> 'minimum_experience') <> 'number' then
          errors := array_append(errors, 'This job has misconfigured skill requirements.');
          continue;
        end if;
        configured_value := (skill_requirement ->> 'minimum_experience')::numeric;
        if configured_value < 0 or configured_value > 100000000 or configured_value <> trunc(configured_value) then
          errors := array_append(errors, 'This job has misconfigured skill requirements.');
          continue;
        end if;
        minimum_experience := configured_value::integer;
      end if;

      if minimum_skill_level is null and minimum_experience is null then
        errors := array_append(errors, 'This job has misconfigured skill requirements.');
        continue;
      end if;

      select coalesce((select ps.level from public.player_skills ps
        where ps.character_id = p_character_id and ps.skill_slug = v_skill_slug), 0),
        coalesce((select ps.experience from public.player_skills ps
        where ps.character_id = p_character_id and ps.skill_slug = v_skill_slug), 0)
        into current_skill_level, current_experience;

      if minimum_skill_level is not null and current_skill_level < minimum_skill_level then
        errors := array_append(errors, format('%s skill: Level %s/%s.', skill_label, current_skill_level, minimum_skill_level));
      end if;
      if minimum_experience is not null and current_experience < minimum_experience then
        errors := array_append(errors, format('%s skill: %s/%s XP.', skill_label, current_experience, minimum_experience));
      end if;
    end loop;
  end if;

  return errors;
end $$;

create or replace function public.select_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  job_row public.jobs%rowtype;
  player public.characters%rowtype;
  requirement_errors text[];
begin
  if cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid and user_id = auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  select * into job_row from public.jobs where id = p_job_id and is_available;
  if not found then raise exception 'Job is unavailable'; end if;

  if job_row.location_id is not null and player.current_location_id is distinct from job_row.location_id then
    raise exception 'Travel to % to apply for this job',
      (select name from public.locations where id = job_row.location_id);
  end if;
  requirement_errors := public._job_requirement_errors(cid, job_row.id);
  if cardinality(requirement_errors) > 0 then raise exception '%', requirement_errors[1]; end if;

  update public.character_jobs set is_current = false
    where character_id = cid and is_current and job_id <> p_job_id;
  insert into public.character_jobs(user_id, character_id, job_id, is_current)
    values (auth.uid(), cid, p_job_id, true)
    on conflict (character_id, job_id) do update set is_current = true;
  perform public._notify(cid, 'You are now a ' || job_row.name,
    'Perform shifts at ' || coalesce((select name from public.game_places where id = job_row.place_id), 'your job location') || '.', 'job');
  perform public._recalc_missions(cid);
end $$;

create or replace function public._validate_job_shift_requirements()
returns trigger language plpgsql security definer set search_path = public as $$
declare requirement_errors text[];
begin
  if new.times_performed > old.times_performed then
    requirement_errors := public._job_requirement_errors(new.character_id, new.job_id);
    if cardinality(requirement_errors) > 0 then raise exception '%', requirement_errors[1]; end if;
  end if;
  return new;
end $$;
create trigger t_validate_job_shift_requirements
  before update of times_performed on public.character_jobs
  for each row execute function public._validate_job_shift_requirements();

revoke execute on function public._job_requirement_errors(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._validate_job_shift_requirements() from public, anon, authenticated;
revoke execute on function public.select_job(uuid) from public, anon;
grant execute on function public.select_job(uuid) to authenticated;

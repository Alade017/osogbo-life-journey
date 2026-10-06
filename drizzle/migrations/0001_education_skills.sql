create table public.education_courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  provider text not null,
  description text not null,
  tuition integer not null check (tuition > 0),
  energy_cost integer not null check (energy_cost between 1 and 100),
  intelligence_gain integer not null check (intelligence_gain >= 0),
  career_gain integer not null check (career_gain >= 0),
  sort_order integer not null default 0
);
grant select on public.education_courses to authenticated;
grant all on public.education_courses to service_role;
alter table public.education_courses enable row level security;
create policy "education courses readable" on public.education_courses
  for select to authenticated using (true);

create table public.player_courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  course_id uuid not null references public.education_courses(id),
  tuition_paid integer not null check (tuition_paid > 0),
  completed_at timestamptz not null default now(),
  unique (character_id, course_id)
);
create index on public.player_courses(character_id, course_id);
grant select on public.player_courses to authenticated;
grant all on public.player_courses to service_role;
alter table public.player_courses enable row level security;
create policy "own player courses" on public.player_courses
  for select to authenticated using (user_id = auth.uid());

alter table public.jobs
  add column required_course_slug text references public.education_courses(slug);

insert into public.education_courses
  (slug, name, provider, description, tuition, energy_cost, intelligence_gain, career_gain, sort_order)
values
  ('coding-bootcamp', 'Coding Bootcamp', 'Osun Tech Hub', 'Build practical web skills, from your first page to a working app.', 3500, 25, 8, 5, 1),
  ('graphic-design', 'Graphic Design Studio', 'Osun Tech Hub', 'Learn layout, colour and client-ready design for local businesses.', 2800, 20, 6, 5, 2),
  ('bookkeeping', 'Bookkeeping Basics', 'State Polytechnic', 'Practice records, invoices and the numbers behind a small business.', 2200, 18, 4, 6, 3),
  ('driving-lessons', 'Driving Lessons', 'State Polytechnic', 'Build road awareness and professional driving fundamentals.', 3000, 22, 2, 7, 4);

update public.jobs set required_course_slug = 'coding-bootcamp' where slug = 'web_developer';
update public.jobs set required_course_slug = 'graphic-design' where slug = 'graphic_designer';
insert into public.jobs
  (slug, name, description, salary, energy_cost, required_level, cooldown_minutes, xp_reward, stat_bonus, icon, sort_order, required_course_slug)
values
  ('bookkeeper', 'Bookkeeper', 'Keep clean financial records for shops and growing local businesses.', 12000, 30, 3, 35, 50, 'career', 'calculator', 9, 'bookkeeping'),
  ('professional_driver', 'Professional Driver', 'Take scheduled passenger and business trips around Osogbo.', 11000, 32, 3, 35, 45, 'reputation', 'car', 10, 'driving-lessons');

create or replace function public._course_completed(p_character_id uuid, p_course_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_course_slug is null or exists (
    select 1 from public.player_courses pc
    join public.education_courses ec on ec.id = pc.course_id
    where pc.character_id = p_character_id and ec.slug = p_course_slug
  )
$$;

create or replace function public.select_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); j record; lvl int;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into j from public.jobs where id = p_job_id;
  if not found then raise exception 'Job not found'; end if;
  select level into lvl from public.characters where id = cid;
  if lvl < j.required_level then raise exception 'Requires level %', j.required_level; end if;
  if not public._course_completed(cid, j.required_course_slug) then
    raise exception 'Complete % to qualify for this job', (select name from public.education_courses where slug = j.required_course_slug);
  end if;
  update public.character_jobs set is_current = false where character_id = cid and is_current and job_id <> p_job_id;
  insert into public.character_jobs(user_id, character_id, job_id, is_current)
    values (auth.uid(), cid, p_job_id, true)
    on conflict (character_id, job_id) do update set is_current = true;
  perform public._notify(cid, 'You are now a ' || j.name, 'Perform shifts from the Jobs board to earn Naira.', 'job');
  perform public._recalc_missions(cid);
end $$;

create or replace function public.perform_job() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); cj record; j record; e int; lvl int; ready_at timestamptz;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into cj from public.character_jobs where character_id = cid and is_current for update;
  if not found then raise exception 'Select a job first'; end if;
  select * into j from public.jobs where id = cj.job_id;
  if not public._course_completed(cid, j.required_course_slug) then
    raise exception 'Complete % to qualify for this job', (select name from public.education_courses where slug = j.required_course_slug);
  end if;
  ready_at := cj.last_performed_at + make_interval(mins => j.cooldown_minutes);
  if cj.last_performed_at is not null and now() < ready_at then raise exception 'Still on cooldown'; end if;
  e := public._refresh_energy(cid);
  if e < j.energy_cost then raise exception 'Not enough energy (need %)', j.energy_cost; end if;

  update public.characters set
    energy = energy - j.energy_cost,
    career = least(100, career + 1),
    intelligence = case when j.stat_bonus = 'intelligence' then least(100, intelligence + 1) else intelligence end,
    social = case when j.stat_bonus = 'social' then least(100, social + 1) else social end,
    reputation = case when j.stat_bonus = 'reputation' then least(100, reputation + 1) else reputation end,
    health = case when j.energy_cost >= 30 then greatest(0, health - 1) else health end
  where id = cid;
  update public.character_jobs set times_performed = times_performed + 1, last_performed_at = now() where id = cj.id;
  perform public._credit(cid, j.salary, 'job', 'Shift as ' || j.name);
  lvl := public._grant_xp(cid, j.xp_reward);
  perform public._recalc_missions(cid);
  return jsonb_build_object('earned', j.salary, 'xp', j.xp_reward, 'energy_spent', j.energy_cost, 'level', lvl);
end $$;

create or replace function public.complete_education_course(p_course_slug text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  course public.education_courses%rowtype;
  player public.characters%rowtype;
  payment public.wallets%rowtype;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into course from public.education_courses where slug = p_course_slug;
  if not found then raise exception 'Course not found'; end if;
  if not exists (
    select 1 from public.location_visits lv
    join public.locations l on l.id = lv.location_id
    where lv.character_id = cid and l.slug = 'student-district'
  ) then raise exception 'Visit the Student District before enrolling'; end if;
  if exists (
    select 1 from public.player_courses pc
    where pc.character_id = cid and pc.course_id = course.id
  ) then raise exception 'You have already completed this course'; end if;

  perform public._refresh_energy(cid);
  select * into player from public.characters where id = cid for update;
  if player.energy < course.energy_cost then
    raise exception 'Not enough energy (need %)', course.energy_cost;
  end if;

  update public.wallets
    set balance = balance - course.tuition,
        total_expenses = total_expenses + course.tuition
    where character_id = cid and balance >= course.tuition
    returning * into payment;
  if not found then raise exception 'Not enough Naira (tuition: %)', course.tuition; end if;

  update public.characters set
    energy = energy - course.energy_cost,
    intelligence = least(100, intelligence + course.intelligence_gain),
    career = least(100, career + course.career_gain),
    wealth = least(100, 10 + (payment.balance / 10000)::int)
    where id = cid;
  insert into public.player_courses(user_id, character_id, course_id, tuition_paid)
    values (auth.uid(), cid, course.id, course.tuition);
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values (auth.uid(), payment.id, cid, course.tuition, 'expense', 'tuition', course.name || ' tuition');

  return jsonb_build_object(
    'course', course.name,
    'tuition', course.tuition,
    'energy_spent', course.energy_cost,
    'intelligence_gain', course.intelligence_gain,
    'career_gain', course.career_gain
  );
end $$;

revoke execute on function public._course_completed(uuid, text) from public, anon, authenticated;
revoke execute on function public.complete_education_course(text) from public, anon;
grant execute on function public.complete_education_course(text) to authenticated;
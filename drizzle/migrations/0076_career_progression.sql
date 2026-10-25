-- Career paths extend the existing jobs/employment/wallet systems. No player rows are reset.
create table public.career_paths (
  slug text primary key,
  name text not null,
  description text not null,
  mood_reward smallint not null check (mood_reward between 0 and 10)
);
create table public.career_ranks (
  path_slug text not null references public.career_paths(slug),
  level smallint not null check (level between 1 and 3),
  title text not null,
  salary integer not null check (salary > 0),
  required_shifts integer not null check (required_shifts >= 0),
  required_skill_level integer not null check (required_skill_level >= 0),
  steps text[] not null check (array_length(steps, 1) = 3),
  primary key (path_slug, level)
);
alter table public.career_paths enable row level security;
alter table public.career_ranks enable row level security;
revoke all on public.career_paths, public.career_ranks from public, anon, authenticated;
grant select on public.career_paths, public.career_ranks to authenticated;
grant all on public.career_paths, public.career_ranks to service_role;
create policy career_paths_read on public.career_paths for select to authenticated using (true);
create policy career_ranks_read on public.career_ranks for select to authenticated using (true);

insert into public.career_paths(slug,name,description,mood_reward) values
 ('banking','Banking & Finance','Help customers, manage records, and lead a fictional bank branch.',2),
 ('retail','Retail & Mall Operations','Serve shoppers, manage stock, and lead the sales floor.',3);
insert into public.career_ranks(path_slug,level,title,salary,required_shifts,required_skill_level,steps) values
 ('banking',1,'Banking Assistant',3500,0,0,array['Prepare the branch','Help a customer','File the shift report']),
 ('banking',2,'Customer Service Officer',5000,5,1,array['Review customer requests','Resolve a service issue','Complete the service report']),
 ('banking',3,'Branch Supervisor',7000,15,3,array['Review branch priorities','Support the service team','Approve the closing report']),
 ('retail',1,'Sales Assistant',3000,0,0,array['Prepare the sales floor','Assist a shopper','Tidy the display']),
 ('retail',2,'Senior Sales Associate',4500,5,1,array['Check assigned stock','Resolve a customer request','Complete inventory notes']),
 ('retail',3,'Store Supervisor',6500,15,3,array['Plan floor coverage','Support the sales team','Approve closing inventory']);

alter table public.jobs add column career_path_slug text references public.career_paths(slug);
create index jobs_career_path_idx on public.jobs(career_path_slug) where career_path_slug is not null;
insert into public.jobs
 (slug,name,description,salary,energy_cost,required_level,cooldown_minutes,xp_reward,stat_bonus,icon,
  sort_order,category,duration_minutes,hunger_cost,thirst_cost,location_id,is_available,
  skill_reward_slug,skill_reward_xp,shift_start_hour,shift_end_hour,career_path_slug)
select seed.job_slug,seed.job_name,seed.description,seed.salary,16,1,30,18,'career',seed.icon,
 seed.sort_order,seed.category,90,5,3,l.id,true,seed.skill,12,8,17,seed.path_slug
from (values
 ('career_cedar_banking','Cedar Bank · Banking & Finance','Build a banking career at Cedar Bank.',3500,'banknote',240,'services','financial_literacy','banking','cedar-bank'),
 ('career_meridian_banking','Meridian Bank · Banking & Finance','Build a banking career at Meridian Bank.',3500,'banknote',241,'services','financial_literacy','banking','meridian-bank'),
 ('career_osun_mall_retail','Osun Mall · Retail Operations','Build a retail career at Osun Mall.',3000,'store',242,'retail','customer_service','retail','osun-mall')
) seed(job_slug,job_name,description,salary,icon,sort_order,category,skill,path_slug,location_slug)
join public.locations l on l.slug=seed.location_slug and l.is_active
on conflict(slug) do update set career_path_slug=excluded.career_path_slug,location_id=excluded.location_id,
 salary=excluded.salary,is_available=true;

create table public.career_shifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  character_job_id uuid not null references public.character_jobs(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  path_slug text not null references public.career_paths(slug),
  rank_level smallint not null check (rank_level between 1 and 3),
  foreign key (path_slug,rank_level) references public.career_ranks(path_slug,level),
  step_count smallint not null default 0 check (step_count between 0 and 3),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  next_step_at timestamptz not null default now(),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  paid_amount integer not null default 0 check (paid_amount >= 0),
  transaction_id uuid unique references public.transactions(id),
  check ((status='completed' and step_count=3 and completed_at is not null and paid_amount>0 and transaction_id is not null)
    or (status<>'completed' and paid_amount=0 and transaction_id is null))
);
create unique index career_one_active_shift on public.career_shifts(character_id) where status='active';
create index career_shifts_history_idx on public.career_shifts(character_id,started_at desc);
create index career_shifts_employment_idx on public.career_shifts(character_job_id,status);
alter table public.career_shifts enable row level security;
revoke all on public.career_shifts from public, anon, authenticated;
grant select on public.career_shifts to authenticated;
grant all on public.career_shifts to service_role;
create policy career_shifts_own_read on public.career_shifts for select to authenticated
 using (user_id=(select auth.uid()));

-- Existing instant shifts and legacy promotions remain available for ordinary jobs only.
alter function public.perform_job(uuid) rename to _perform_job_base;
revoke all on function public._perform_job_base(uuid) from public, anon, authenticated;
create function public.perform_job(p_request_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id();
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  if exists(select 1 from public.character_jobs cj join public.jobs j on j.id=cj.job_id
    where cj.character_id=cid and cj.is_current and j.career_path_slug is not null) then
    raise exception 'Use the three-step career shift for this role';
  end if;
  return public._perform_job_base(p_request_id);
end $$;
revoke all on function public.perform_job(uuid) from public,anon;
grant execute on function public.perform_job(uuid) to authenticated;

alter function public.promote_current_job() rename to _promote_job_base;
revoke all on function public._promote_job_base() from public,anon,authenticated;
create function public.promote_current_job() returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id();
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  if exists(select 1 from public.character_jobs cj join public.jobs j on j.id=cj.job_id
    where cj.character_id=cid and cj.is_current and j.career_path_slug is not null) then
    raise exception 'Use career promotion for this role';
  end if;
  return public._promote_job_base();
end $$;
revoke all on function public.promote_current_job() from public,anon;
grant execute on function public.promote_current_job() to authenticated;

alter function public.select_job(uuid) rename to _select_job_base;
revoke all on function public._select_job_base(uuid) from public,anon,authenticated;
create function public.select_job(p_job_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id(); current_job public.character_jobs%rowtype; path text;
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  perform 1 from public.characters where id=cid and user_id=auth.uid() for update;
  select * into current_job from public.character_jobs where character_id=cid and is_current for update;
  if exists(select 1 from public.career_shifts where character_id=cid and status='active') then
    raise exception 'Finish your active career shift before changing jobs';
  end if;
  if current_job.id is not null and current_job.job_id<>p_job_id then
    select j.career_path_slug into path from public.jobs j where j.id=current_job.job_id;
    if path is not null then raise exception 'Leave your current career before applying elsewhere'; end if;
  end if;
  perform public._select_job_base(p_job_id);
end $$;
revoke all on function public.select_job(uuid) from public,anon;
grant execute on function public.select_job(uuid) to authenticated;

create function public.leave_career() returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id(); employment public.character_jobs%rowtype;
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  perform 1 from public.characters where id=cid and user_id=auth.uid() for update;
  select cj.* into employment from public.character_jobs cj join public.jobs j on j.id=cj.job_id
    where cj.character_id=cid and cj.is_current and j.career_path_slug is not null for update of cj;
  if not found then raise exception 'No active career'; end if;
  if exists(select 1 from public.career_shifts where character_id=cid and status='active') then
    raise exception 'Finish the active shift before leaving';
  end if;
  update public.character_jobs set is_current=false where id=employment.id;
  return jsonb_build_object('left',true,'employment_id',employment.id);
end $$;
revoke all on function public.leave_career() from public,anon;
grant execute on function public.leave_career() to authenticated;

create function public.start_career_shift() returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id(); player public.characters%rowtype;
 employment public.character_jobs%rowtype; job public.jobs%rowtype; shift public.career_shifts%rowtype; refreshed integer;
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  select * into player from public.characters where id=cid and user_id=auth.uid() for update;
  if not found then raise exception 'Character not found'; end if;
  select cj.* into employment from public.character_jobs cj join public.jobs j on j.id=cj.job_id
    where cj.character_id=cid and cj.is_current and j.career_path_slug is not null for update of cj;
  if not found then raise exception 'Apply for a career first'; end if;
  select * into job from public.jobs where id=employment.job_id and is_available;
  if not found then raise exception 'Career is unavailable'; end if;
  if player.current_location_id is distinct from job.location_id then raise exception 'Travel to your workplace first'; end if;
  select * into shift from public.career_shifts where character_id=cid and status='active' for update;
  if found then return jsonb_build_object('id',shift.id,'step_count',shift.step_count,'status',shift.status); end if;
  if player.game_time_hour<job.shift_start_hour or player.game_time_hour>=job.shift_end_hour then
    raise exception 'This workplace is open for shifts from %:00 to %:00',job.shift_start_hour,job.shift_end_hour;
  end if;
  if employment.last_performed_at is not null and now()<employment.last_performed_at+make_interval(mins=>job.cooldown_minutes) then
    raise exception 'Your next shift is still on cooldown';
  end if;
  refreshed:=public._refresh_energy(cid);
  if refreshed<job.energy_cost then raise exception 'Not enough energy'; end if;
  update public.characters set energy=refreshed-job.energy_cost where id=cid;
  insert into public.career_shifts(user_id,character_id,character_job_id,location_id,path_slug,rank_level)
    values(auth.uid(),cid,employment.id,job.location_id,job.career_path_slug,employment.career_level)
    returning * into shift;
  return jsonb_build_object('id',shift.id,'step_count',0,'status','active');
end $$;
revoke all on function public.start_career_shift() from public,anon;
grant execute on function public.start_career_shift() to authenticated;

create function public.complete_career_step(p_shift_id uuid,p_step integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id(); shift public.career_shifts%rowtype; player public.characters%rowtype;
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  select * into player from public.characters where id=cid and user_id=auth.uid() for update;
  select * into shift from public.career_shifts where id=p_shift_id and character_id=cid and user_id=auth.uid() for update;
  if not found then raise exception 'Shift not found'; end if;
  if shift.status<>'active' then raise exception 'Shift is no longer active'; end if;
  if player.current_location_id is distinct from shift.location_id then raise exception 'Return to your workplace'; end if;
  if not exists(select 1 from public.character_jobs where id=shift.character_job_id and is_current) then
    raise exception 'Career is no longer active';
  end if;
  if p_step is null or p_step<>shift.step_count+1 then raise exception 'Complete the next work step in order'; end if;
  if now()<shift.next_step_at then raise exception 'This work step is still in progress'; end if;
  update public.career_shifts set step_count=p_step,next_step_at=now()+interval '15 seconds'
    where id=shift.id;
  return jsonb_build_object('id',shift.id,'step_count',p_step,'status','active');
end $$;
revoke all on function public.complete_career_step(uuid,integer) from public,anon;
grant execute on function public.complete_career_step(uuid,integer) to authenticated;

create function public.cancel_career_shift(p_shift_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id(); shift public.career_shifts%rowtype;
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  perform 1 from public.characters where id=cid and user_id=auth.uid() for update;
  select * into shift from public.career_shifts where id=p_shift_id and character_id=cid and user_id=auth.uid() for update;
  if not found then raise exception 'Shift not found'; end if;
  if shift.status<>'active' then raise exception 'Only an active shift can be cancelled'; end if;
  update public.career_shifts set status='cancelled' where id=shift.id;
  return jsonb_build_object('id',shift.id,'status','cancelled');
end $$;
revoke all on function public.cancel_career_shift(uuid) from public,anon;
grant execute on function public.cancel_career_shift(uuid) to authenticated;

create function public.claim_career_shift(p_shift_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id(); shift public.career_shifts%rowtype; player public.characters%rowtype;
 employment public.character_jobs%rowtype; job public.jobs%rowtype; rank public.career_ranks%rowtype;
 path public.career_paths%rowtype; payment uuid; new_level integer;
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  select * into player from public.characters where id=cid and user_id=auth.uid() for update;
  select * into shift from public.career_shifts where id=p_shift_id and character_id=cid and user_id=auth.uid() for update;
  if not found then raise exception 'Shift not found'; end if;
  if shift.status='completed' then
    return jsonb_build_object('id',shift.id,'earned',shift.paid_amount,'status','completed','duplicate',true);
  end if;
  if shift.status<>'active' or shift.step_count<>3 then raise exception 'Complete all three work steps first'; end if;
  if now()<shift.next_step_at then raise exception 'Finish the closing step first'; end if;
  if player.current_location_id is distinct from shift.location_id then raise exception 'Return to your workplace'; end if;
  select * into employment from public.character_jobs where id=shift.character_job_id and character_id=cid and is_current for update;
  if not found then raise exception 'Career is no longer active'; end if;
  select * into job from public.jobs where id=employment.job_id and is_available and career_path_slug=shift.path_slug;
  if not found then raise exception 'Career is unavailable'; end if;
  select * into rank from public.career_ranks where path_slug=shift.path_slug and level=shift.rank_level;
  select * into path from public.career_paths where slug=shift.path_slug;
  if rank.salary is null or rank.salary<=0 then raise exception 'Career pay is unavailable'; end if;
  perform public._credit(cid,rank.salary,'career_shift','Career shift '||shift.id::text);
  select id into payment from public.transactions where character_id=cid and category='career_shift'
    and description='Career shift '||shift.id::text order by created_at desc limit 1;
  if payment is null then raise exception 'Career payment could not be recorded'; end if;
  update public.career_shifts set status='completed',completed_at=now(),paid_amount=rank.salary,transaction_id=payment where id=shift.id;
  update public.character_jobs set times_performed=times_performed+1,last_performed_at=now() where id=employment.id;
  update public.characters set happiness=least(100,happiness+path.mood_reward),
    hunger=least(100,hunger+job.hunger_cost),thirst=least(100,thirst+job.thirst_cost),
    career=least(100,career+1) where id=cid;
  if to_regprocedure('public.apply_party_mood(uuid,uuid,integer)') is not null then
    perform public.apply_party_mood(cid,auth.uid(),path.mood_reward);
  end if;
  new_level:=public._grant_xp(cid,job.xp_reward);
  perform public._advance_character_game_time(cid,job.duration_minutes);
  perform public._recalc_missions(cid);
  return jsonb_build_object('id',shift.id,'earned',rank.salary,'xp',job.xp_reward,
    'mood',path.mood_reward,'level',new_level,'status','completed','duplicate',false);
end $$;
revoke all on function public.claim_career_shift(uuid) from public,anon;
grant execute on function public.claim_career_shift(uuid) to authenticated;

create function public.promote_career() returns jsonb language plpgsql security definer set search_path='' as $$
declare cid uuid:=public._my_character_id(); employment public.character_jobs%rowtype;
 job public.jobs%rowtype; next_rank public.career_ranks%rowtype; skill_level integer;
begin
  if cid is null or auth.uid() is null then raise exception 'Sign in and create a character first'; end if;
  perform 1 from public.characters where id=cid and user_id=auth.uid() for update;
  select cj.* into employment from public.character_jobs cj join public.jobs j on j.id=cj.job_id
    where cj.character_id=cid and cj.is_current and j.career_path_slug is not null for update of cj;
  if not found then raise exception 'No active career'; end if;
  if employment.career_level>=3 then raise exception 'You are at the highest rank'; end if;
  if exists(select 1 from public.career_shifts where character_id=cid and status='active') then
    raise exception 'Finish your active shift before promotion';
  end if;
  select * into job from public.jobs where id=employment.job_id;
  select * into next_rank from public.career_ranks where path_slug=job.career_path_slug and level=employment.career_level+1;
  if not found then raise exception 'Next rank is unavailable'; end if;
  select coalesce((select ps.level from public.player_skills ps where ps.character_id=cid
    and ps.skill_slug=job.skill_reward_slug),0) into skill_level;
  if employment.times_performed<next_rank.required_shifts or skill_level<next_rank.required_skill_level then
    raise exception 'Promotion needs % completed shifts and % level %',next_rank.required_shifts,
      job.skill_reward_slug,next_rank.required_skill_level;
  end if;
  update public.character_jobs set career_level=next_rank.level where id=employment.id;
  return jsonb_build_object('career_level',next_rank.level,'title',next_rank.title,'salary',next_rank.salary);
end $$;
revoke all on function public.promote_career() from public,anon;
grant execute on function public.promote_career() to authenticated;

notify pgrst,'reload schema';

-- Extends 0060 course plans and 0076 careers. No progression or wallet writes.
begin;

create index if not exists course_plans_owner_idx on public.player_course_plans(user_id, character_id);
create index if not exists career_income_history_idx on public.transactions(character_id, created_at desc, id desc)
  where kind='income' and category in ('job','career_shift');

create or replace function public.set_saved_course(p_course_slug text, p_saved boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); cid uuid := public._my_character_id(); course uuid;
begin
  if uid is null or cid is null or not exists(select 1 from public.characters where id=cid and user_id=uid)
    then raise exception 'Sign in and create a character first'; end if;
  if p_saved is null then raise exception 'Saved state is required'; end if;
  select id into course from public.education_courses where slug=p_course_slug;
  if course is null then raise exception 'Course not found'; end if;
  -- Serialize repeated/opposing requests for the same player and course.
  perform pg_advisory_xact_lock(hashtextextended(cid::text || course::text, 0));
  if p_saved then
    insert into public.player_course_plans(user_id,character_id,course_id) values(uid,cid,course)
      on conflict(character_id,course_id) do nothing;
  else
    delete from public.player_course_plans where character_id=cid and user_id=uid and course_id=course;
  end if;
  return jsonb_build_object('courseSlug',p_course_slug,'saved',p_saved);
end $$;
revoke all on function public.set_saved_course(text,boolean) from public,anon;
grant execute on function public.set_saved_course(text,boolean) to authenticated;

create table public.player_career_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  character_job_id uuid not null references public.character_jobs(id) on delete cascade,
  job_name text not null,
  event text not null check(event in ('joined','left','promoted')),
  career_level integer not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index career_events_owner_idx on public.player_career_events(character_id,occurred_at desc,id desc);
alter table public.player_career_events enable row level security;
revoke all on public.player_career_events from public,anon,authenticated;
grant select on public.player_career_events to authenticated;
grant all on public.player_career_events to service_role;
create policy career_events_own_read on public.player_career_events for select to authenticated
  using(user_id=(select auth.uid()));

create function public._record_career_life_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare action text; role_name text;
begin
  if tg_op='INSERT' then
    if new.is_current then action:='joined'; end if;
  elsif old.is_current is distinct from new.is_current then
    action:=case when new.is_current then 'joined' else 'left' end;
  elsif new.career_level > old.career_level then action:='promoted';
  end if;
  if action is not null then
    select name into role_name from public.jobs where id=new.job_id;
    insert into public.player_career_events(user_id,character_id,character_job_id,job_name,event,career_level)
      values(new.user_id,new.character_id,new.id,role_name,action,new.career_level);
  end if;
  return new;
end $$;
revoke all on function public._record_career_life_event() from public,anon,authenticated;
create trigger record_career_life_event after insert or update on public.character_jobs
  for each row execute function public._record_career_life_event();

-- Aggregates are computed across all retained records, independently of page size.
create function public.get_career_life_summary() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id();
begin
  if uid is null or cid is null or not exists(select 1 from public.characters where id=cid and user_id=uid)
    then raise exception 'Sign in and create a character first'; end if;
  return jsonb_build_object(
    'earned', (select coalesce(sum(amount),0) from public.transactions where character_id=cid and user_id=uid
      and kind='income' and category in ('job','career_shift')),
    'shifts', (select coalesce(sum(times_performed),0) from public.character_jobs where character_id=cid and user_id=uid),
    'employments', coalesce((select jsonb_agg(jsonb_build_object(
      'id',cj.id,'name',j.name,'current',cj.is_current,'level',cj.career_level,
      'shifts',cj.times_performed,'hiredAt',cj.hired_at,'lastWorkedAt',cj.last_performed_at,
      'location',l.name,'requiredCourse',ec.name
    ) order by cj.is_current desc,cj.hired_at desc,cj.id)
      from public.character_jobs cj join public.jobs j on j.id=cj.job_id
      left join public.locations l on l.id=j.location_id
      left join public.education_courses ec on ec.slug=j.required_course_slug
      where cj.character_id=cid and cj.user_id=uid),'[]'::jsonb)
  );
end $$;
revoke all on function public.get_career_life_summary() from public,anon;
grant execute on function public.get_career_life_summary() to authenticated;

-- Page the merged timeline. Offset pages are read-only and can shift with new activity.
create function public.get_career_life_history(p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id();
begin
  if uid is null or cid is null or not exists(select 1 from public.characters where id=cid and user_id=uid)
    then raise exception 'Sign in and create a character first'; end if;
  if p_offset is null or p_offset<0 then raise exception 'Invalid history offset'; end if;
  return coalesce((select jsonb_agg(to_jsonb(page) order by page.at desc,page.id desc) from (
    select * from (
      select 'event-'||id::text as id,occurred_at as at,event as kind,job_name as label,
        null::bigint as amount,career_level as level from public.player_career_events where character_id=cid and user_id=uid
      union all
      select 'pay-'||id::text,created_at,'payment',description,amount,null::integer
        from public.transactions where character_id=cid and user_id=uid and kind='income' and category in ('job','career_shift')
    ) records order by at desc,id desc limit 21 offset p_offset
  ) page),'[]'::jsonb);
end $$;
revoke all on function public.get_career_life_history(integer) from public,anon;
grant execute on function public.get_career_life_history(integer) to authenticated;
commit;

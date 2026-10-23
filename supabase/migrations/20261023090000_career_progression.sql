-- Career progression: persistent tracks and server-authoritative, step-gated shifts.
-- Careers extend Jobs and reuse characters, locations, wallets, transactions, XP and mood.
create table if not exists public.career_tracks (
  slug text primary key,
  name text not null,
  venue_slug text not null,
  location_id uuid references public.locations(id) on delete restrict,
  description text not null,
  mood_delta integer not null default 2 check (mood_delta between -10 and 10),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.career_tracks(slug,name,venue_slug,location_id,description,mood_delta,is_active)
select seed.slug,seed.name,seed.venue_slug,l.id,seed.description,seed.mood_delta,(l.id is not null)
from (values
  ('banking','Banking & Finance','cedar-bank','Serve customers, process routine requests and build toward branch leadership.',2),
  ('retail','Retail & Mall Operations','osun-mall','Help customers, maintain displays and progress toward store supervision.',3)
) as seed(slug,name,venue_slug,description,mood_delta)
left join public.locations l on l.slug=seed.venue_slug
on conflict(slug) do update set name=excluded.name,venue_slug=excluded.venue_slug,
  location_id=excluded.location_id,description=excluded.description,mood_delta=excluded.mood_delta,
  is_active=excluded.is_active;

-- Meridian Bank is an alternate banking venue; both banks use the same career track.
create table if not exists public.career_track_venues (
  track_slug text not null references public.career_tracks(slug) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  primary key(track_slug,location_id)
);
insert into public.career_track_venues(track_slug,location_id)
select 'banking',id from public.locations where slug in ('cedar-bank','meridian-bank')
on conflict do nothing;
insert into public.career_track_venues(track_slug,location_id)
select 'retail',id from public.locations where slug='osun-mall'
on conflict do nothing;

create table if not exists public.career_ranks (
  track_slug text not null references public.career_tracks(slug) on delete cascade,
  level integer not null check(level between 1 and 3),
  title text not null,
  shift_pay bigint not null check(shift_pay between 1 and 1000000),
  promotion_shifts integer not null default 0 check(promotion_shifts >= 0),
  primary key(track_slug,level)
);
insert into public.career_ranks(track_slug,level,title,shift_pay,promotion_shifts) values
  ('banking',1,'Banking Assistant',3500,0),
  ('banking',2,'Customer Service Officer',5000,5),
  ('banking',3,'Branch Supervisor',7000,15),
  ('retail',1,'Sales Assistant',3000,0),
  ('retail',2,'Senior Sales Associate',4500,5),
  ('retail',3,'Store Supervisor',6500,15)
on conflict(track_slug,level) do update set title=excluded.title,shift_pay=excluded.shift_pay,
  promotion_shifts=excluded.promotion_shifts;

create table if not exists public.career_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  track_slug text not null references public.career_tracks(slug),
  status text not null default 'active' check(status in ('active','completed','resigned')),
  career_level integer not null default 1 check(career_level between 1 and 3),
  completed_shifts integer not null default 0 check(completed_shifts >= 0),
  performance_points integer not null default 0 check(performance_points >= 0),
  applied_at timestamptz not null default now(),
  last_shift_completed_at timestamptz,
  updated_at timestamptz not null default now()
);
create unique index if not exists career_one_active_track_per_character
  on public.career_applications(character_id) where status='active';
create unique index if not exists career_one_track_application
  on public.career_applications(character_id,track_slug) where status='active';

create table if not exists public.career_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  application_id uuid not null references public.career_applications(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  status text not null default 'in_progress' check(status in ('in_progress','completed','abandoned')),
  steps_required integer not null default 3 check(steps_required between 1 and 10),
  steps_completed integer not null default 0 check(steps_completed between 0 and steps_required),
  reward bigint not null default 0 check(reward >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create unique index if not exists career_one_open_session_per_character
  on public.career_sessions(character_id) where status='in_progress';

create table if not exists public.career_action_requests (
  character_id uuid not null references public.characters(id) on delete cascade,
  request_id uuid not null,
  operation text not null check(operation in ('apply','start_shift','complete_step','promote')),
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(character_id,request_id)
);

alter table public.career_tracks enable row level security;
alter table public.career_track_venues enable row level security;
alter table public.career_ranks enable row level security;
alter table public.career_applications enable row level security;
alter table public.career_sessions enable row level security;
alter table public.career_action_requests enable row level security;

drop policy if exists career_tracks_read on public.career_tracks;
create policy career_tracks_read on public.career_tracks for select to authenticated using(is_active);
drop policy if exists career_track_venues_read on public.career_track_venues;
create policy career_track_venues_read on public.career_track_venues for select to authenticated
  using(exists(select 1 from public.career_tracks t where t.slug=track_slug and t.is_active));
drop policy if exists career_ranks_read on public.career_ranks;
create policy career_ranks_read on public.career_ranks for select to authenticated using(true);
drop policy if exists career_applications_own_read on public.career_applications;
create policy career_applications_own_read on public.career_applications for select to authenticated using(user_id=auth.uid());
drop policy if exists career_sessions_own_read on public.career_sessions;
create policy career_sessions_own_read on public.career_sessions for select to authenticated using(user_id=auth.uid());
drop policy if exists career_action_requests_own_read on public.career_action_requests;
create policy career_action_requests_own_read on public.career_action_requests for select to authenticated
  using(character_id in(select id from public.characters where user_id=auth.uid()));

revoke all on public.career_action_requests from anon,authenticated;
grant select on public.career_tracks,public.career_track_venues,public.career_ranks,
  public.career_applications,public.career_sessions to authenticated;

create or replace function public.apply_for_career(p_track_slug text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  t public.career_tracks%rowtype; result jsonb; app public.career_applications%rowtype;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select car.result into result from public.career_action_requests car where car.character_id=cid and car.request_id=p_request_id;
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into t from public.career_tracks where slug=p_track_slug and is_active;
  if not found then raise exception 'This career track is not available'; end if;
  if not exists(select 1 from public.career_track_venues v where v.track_slug=t.slug and v.location_id=c.current_location_id) then
    raise exception 'Travel to an approved career venue before applying';
  end if;
  if exists(select 1 from public.career_applications where character_id=cid and status='active') then
    raise exception 'You already have an active career. Complete or resign before applying again';
  end if;
  insert into public.career_applications(user_id,character_id,track_slug)
    values(uid,cid,t.slug) returning * into app;
  result:=jsonb_build_object('application_id',app.id,'track_slug',app.track_slug,'career_level',app.career_level,'status',app.status);
  insert into public.career_action_requests(character_id,request_id,operation,result)
    values(cid,p_request_id,'apply',result);
  return result;
end $$;

create or replace function public.start_career_shift(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  app public.career_applications%rowtype; venue_id uuid; s public.career_sessions%rowtype; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select car.result into result from public.career_action_requests car where car.character_id=cid and car.request_id=p_request_id;
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into app from public.career_applications where character_id=cid and status='active' for update;
  if not found then raise exception 'Apply for a career before starting a shift'; end if;
  if exists(select 1 from public.career_sessions where character_id=cid and status='in_progress') then
    raise exception 'Finish your current career shift first';
  end if;
  select location_id into venue_id from public.career_track_venues
    where track_slug=app.track_slug and location_id=c.current_location_id limit 1;
  if venue_id is null then raise exception 'Travel to an approved workplace before starting your shift'; end if;
  if app.last_shift_completed_at is not null and now()<app.last_shift_completed_at+interval '20 minutes' then
    raise exception 'Take a short break before your next career shift';
  end if;
  insert into public.career_sessions(user_id,character_id,application_id,location_id)
    values(uid,cid,app.id,venue_id) returning * into s;
  result:=jsonb_build_object('session_id',s.id,'steps_required',s.steps_required,'steps_completed',s.steps_completed,'status',s.status);
  insert into public.career_action_requests(character_id,request_id,operation,result)
    values(cid,p_request_id,'start_shift',result);
  return result;
end $$;

create or replace function public.complete_career_step(p_session_id uuid,p_step_number integer,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  s public.career_sessions%rowtype; app public.career_applications%rowtype; r public.career_ranks%rowtype;
  cash_result jsonb; result jsonb; mood_after integer; completed integer; paid bigint:=0;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null or p_session_id is null then raise exception 'Session and request IDs are required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select car.result into result from public.career_action_requests car where car.character_id=cid and car.request_id=p_request_id;
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into s from public.career_sessions where id=p_session_id and character_id=cid for update;
  if not found or s.status<>'in_progress' then raise exception 'This career shift is not active'; end if;
  if c.current_location_id is distinct from s.location_id then raise exception 'Return to your workplace to complete this step'; end if;
  if p_step_number is distinct from s.steps_completed+1 then raise exception 'Complete the next step in order'; end if;
  if p_step_number>s.steps_required then raise exception 'This shift has no remaining steps'; end if;
  update public.career_sessions set steps_completed=steps_completed+1 where id=s.id
    returning steps_completed into completed;
  if completed=s.steps_required then
    select * into app from public.career_applications where id=s.application_id and status='active' for update;
    if not found then raise exception 'Career application is no longer active'; end if;
    select * into r from public.career_ranks where track_slug=app.track_slug and level=app.career_level;
    if not found then raise exception 'Career pay configuration is missing'; end if;
    paid:=r.shift_pay;
    perform public._credit(cid,paid,'job','Completed career shift: '||r.title);
    mood_after:=public.apply_party_mood(cid,uid,(select mood_delta from public.career_tracks where slug=app.track_slug));
    update public.career_applications set completed_shifts=completed_shifts+1,
      performance_points=performance_points+1,last_shift_completed_at=now(),updated_at=now()
      where id=app.id;
    update public.career_sessions set status='completed',reward=paid,completed_at=now() where id=s.id;
    perform public._grant_xp(cid,10);
    perform public._recalc_missions(cid);
  end if;
  result:=jsonb_build_object('session_id',s.id,'step_completed',completed,'steps_required',s.steps_required,
    'shift_complete',completed=s.steps_required,'paid',paid,'mood',mood_after);
  insert into public.career_action_requests(character_id,request_id,operation,result)
    values(cid,p_request_id,'complete_step',result);
  return result;
end $$;

create or replace function public.promote_career(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); app public.career_applications%rowtype;
  next_rank public.career_ranks%rowtype; result jsonb; required_shifts integer;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select car.result into result from public.career_action_requests car where car.character_id=cid and car.request_id=p_request_id;
  if found then return result; end if;
  select * into app from public.career_applications where character_id=cid and status='active' for update;
  if not found then raise exception 'You do not have an active career'; end if;
  if app.career_level>=3 then raise exception 'You have reached the highest career rank'; end if;
  select * into next_rank from public.career_ranks where track_slug=app.track_slug and level=app.career_level+1;
  required_shifts:=next_rank.promotion_shifts;
  if app.completed_shifts<required_shifts or app.performance_points<required_shifts then
    raise exception 'Complete % shifts with good performance before promotion',required_shifts;
  end if;
  update public.career_applications set career_level=career_level+1,updated_at=now() where id=app.id;
  result:=jsonb_build_object('career_level',app.career_level+1,'title',next_rank.title,'shift_pay',next_rank.shift_pay);
  insert into public.career_action_requests(character_id,request_id,operation,result)
    values(cid,p_request_id,'promote',result);
  return result;
end $$;

revoke all on function public.apply_for_career(text,uuid) from public,anon;
revoke all on function public.start_career_shift(uuid) from public,anon;
revoke all on function public.complete_career_step(uuid,integer,uuid) from public,anon;
revoke all on function public.promote_career(uuid) from public,anon;
grant execute on function public.apply_for_career(text,uuid) to authenticated;
grant execute on function public.start_career_shift(uuid) to authenticated;
grant execute on function public.complete_career_step(uuid,integer,uuid) to authenticated;
grant execute on function public.promote_career(uuid) to authenticated;

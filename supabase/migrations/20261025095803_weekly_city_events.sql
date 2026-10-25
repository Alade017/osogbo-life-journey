-- Requires Drizzle 0076, dated expanded_town_places (20261022000000), and daily tasks.
begin;
do $$ begin
  if (select count(*) from public.locations where slug in ('town-market','youth-arts-centre') and is_active)<>2
    or not exists(select 1 from public.map_districts where id='east-gate') then
    raise exception 'Weekly events require active Town Market and Youth Arts Centre locations and East Gate district';
  end if;
end $$;
-- The expanded-town migration created the venue but omitted its map registration.
insert into public.map_landmarks(id,district_id,location_id,min_age,is_available)
  select 'youth-arts-centre','east-gate',id,0,true from public.locations where slug='youth-arts-centre'
  on conflict(id) do nothing;
do $$ begin
  if (select count(*) from public.map_landmarks m join public.locations l on l.id=m.location_id
      where m.id in ('town-market','youth-arts-centre') and m.is_available and l.is_active
        and l.slug=m.id and m.district_id=case m.id when 'town-market' then 'market-quarter' else 'east-gate' end) <> 2 then
    raise exception 'Weekly events require active Town Market and Youth Arts Centre map venues';
  end if;
end $$;

create table public.city_event_catalog (
  id text primary key check (id in ('market-day','riverlight-gathering','weekend-arts')),
  title text not null check (length(title) between 1 and 100),
  description text not null check (length(description) between 1 and 500),
  landmark_id text not null references public.map_landmarks(id),
  weekday integer not null check (weekday between 0 and 6),
  start_hour integer not null check (start_hour between 0 and 23),
  end_hour integer not null check (end_hour between 1 and 24 and end_hour > start_hour),
  outdoors boolean not null,
  enabled boolean not null default true
);
create index city_event_catalog_landmark_idx on public.city_event_catalog(landmark_id);
insert into public.city_event_catalog(id,title,description,landmark_id,weekday,start_hour,end_hour,outdoors) values
 ('market-day','Town Market Day','Meet fictional stallholders and neighbours at the town market.','town-market',2,9,16,true),
 ('riverlight-gathering','Riverlight Community Gathering','An evening of music, food and neighbourly conversation.','youth-arts-centre',4,17,21,false),
 ('weekend-arts','Open Courtyard Arts','An open-air showcase by local artists and makers.','youth-arts-centre',5,14,19,true);

create table public.city_event_occurrences (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references public.city_event_catalog(id),
  week_start date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  world_day integer not null,
  title text not null,
  description text not null,
  location_id uuid not null references public.locations(id),
  landmark_id text not null references public.map_landmarks(id),
  district_id text not null references public.map_districts(id),
  outdoors boolean not null,
  unique(event_id,week_start),
  unique(event_id,starts_at)
);
create index city_event_occurrences_window_idx on public.city_event_occurrences(ends_at,starts_at);
create index city_event_occurrences_location_idx on public.city_event_occurrences(location_id);
create index city_event_occurrences_landmark_idx on public.city_event_occurrences(landmark_id);
create index city_event_occurrences_district_idx on public.city_event_occurrences(district_id);
alter table public.city_event_catalog enable row level security;
alter table public.city_event_occurrences enable row level security;
revoke all on public.city_event_catalog,public.city_event_occurrences from public,anon,authenticated;
grant select on public.city_event_catalog,public.city_event_occurrences to authenticated;
grant all on public.city_event_catalog,public.city_event_occurrences to service_role;
create policy "Read enabled city event catalog" on public.city_event_catalog for select to authenticated using(enabled);
create policy "Read shared city occurrences" on public.city_event_occurrences for select to authenticated using(true);
-- The old policy called a helper whose client EXECUTE grant is revoked.
-- Keep ownership enforcement without exposing that privileged helper.
drop policy "Own event participation" on public.city_event_participation;
create policy "Own event participation" on public.city_event_participation for select to authenticated
  using(character_id in (select id from public.characters where user_id=(select auth.uid())));

-- Internal only: callers cannot choose a materialization time or generate arbitrary weeks.
create function public._ensure_city_event_occurrences(p_stamp timestamptz) returns void
language sql security definer set search_path='' as $$
  insert into public.city_event_occurrences(event_id,week_start,starts_at,ends_at,world_day,
    title,description,location_id,landmark_id,district_id,outdoors)
  select c.id, weeks.monday,
    (days.day + make_interval(hours=>c.start_hour)) at time zone 'Africa/Lagos',
    (days.day + make_interval(hours=>c.end_hour)) at time zone 'Africa/Lagos',
    (days.day - date '2026-01-01') + 1,
    c.title,c.description,m.location_id,m.id,m.district_id,c.outdoors
  from public.city_event_catalog c
  join public.map_landmarks m on m.id=c.landmark_id
  cross join generate_series(0,1) n
  cross join lateral (select date_trunc('week',p_stamp at time zone 'Africa/Lagos')::date + n*7 as monday) weeks
  cross join lateral (select weeks.monday+c.weekday as day) days
  where c.enabled
  order by c.id,weeks.monday
  on conflict(event_id,week_start) do nothing
$$;
revoke all on function public._ensure_city_event_occurrences(timestamptz) from public,anon,authenticated;

create function public.get_city_events() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; stamp timestamptz; events jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then
    raise exception 'Sign in with a registered account first';
  end if;
  cid:=public._my_character_id();
  if cid is null then raise exception 'Create a character first'; end if;
  stamp:=clock_timestamp();
  perform public._ensure_city_event_occurrences(stamp);
  stamp:=clock_timestamp(); -- Materialization may have waited for another transaction.
  select coalesce(jsonb_agg(jsonb_build_object(
    'occurrenceId',o.id,'id',o.event_id,'title',o.title,'description',o.description,
    'locationSlug',l.slug,'locationName',l.name,'landmarkId',o.landmark_id,'districtId',o.district_id,
    'startsAt',o.starts_at,'endsAt',o.ends_at,
    'status',case when not l.is_active or not m.is_available then 'unavailable'
      when o.outdoors and public.world_weather_for_day(o.world_day)='heavy-rain' then 'cancelled'
      when stamp>=o.starts_at then 'active' else 'upcoming' end,
    'joined',exists(select 1 from public.city_event_participation p
      where p.character_id=cid and p.event_id=o.event_id and p.world_day=o.world_day)
    ) order by o.starts_at,o.event_id),'[]'::jsonb) into events
  from public.city_event_occurrences o
  join public.city_event_catalog c on c.id=o.event_id and c.enabled
  join public.locations l on l.id=o.location_id
  join public.map_landmarks m on m.id=o.landmark_id
  where o.ends_at>stamp and o.week_start>=date_trunc('week',stamp at time zone 'Africa/Lagos')::date
    and o.week_start<=date_trunc('week',stamp at time zone 'Africa/Lagos')::date+7;
  return jsonb_build_object('serverTime',stamp,'events',events);
end $$;

create function public._join_city_event_occurrence(p_event text,p_occurrence_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; player public.characters%rowtype;
  stamp timestamptz; occurrence public.city_event_occurrences%rowtype; inserted integer;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then
    raise exception 'Sign in with a registered account first';
  end if;
  cid:=public._my_character_id();
  if cid is null then raise exception 'Create a character first'; end if;
  select * into player from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  stamp:=clock_timestamp(); -- Capture only after any character-lock wait.
  perform public._ensure_city_event_occurrences(stamp);
  stamp:=clock_timestamp(); -- Also revalidate after any occurrence-materialization wait.
  if not exists(select 1 from public.city_event_catalog where id=p_event and enabled) then
    raise exception 'Unknown city event';
  end if;
  select o.* into occurrence from public.city_event_occurrences o
    where o.event_id=p_event and o.starts_at<=stamp and o.ends_at>stamp;
  if not found then raise exception 'This event is not active'; end if;
  if p_occurrence_id is not null and occurrence.id<>p_occurrence_id then
    raise exception 'This event occurrence has ended. Refresh the schedule.';
  end if;
  if occurrence.outdoors and public.world_weather_for_day(occurrence.world_day)='heavy-rain' then
    raise exception 'This outdoor event is cancelled due to heavy rain';
  end if;
  if not exists(select 1 from public.map_landmarks m join public.locations l on l.id=occurrence.location_id
    where m.id=occurrence.landmark_id and m.is_available and l.is_active) then
    raise exception 'This event venue is unavailable';
  end if;
  if player.current_location_id is distinct from occurrence.location_id then
    raise exception 'Travel to the event location first';
  end if;
  insert into public.city_event_participation(character_id,event_id,world_day)
    values(cid,p_event,occurrence.world_day) on conflict do nothing;
  get diagnostics inserted=row_count;
  return jsonb_build_object('joined',true,'duplicate',inserted=0);
end $$;
revoke all on function public._join_city_event_occurrence(text,uuid) from public,anon,authenticated;
-- Preserve the legacy contract; new clients pin the occurrence through the second RPC.
create or replace function public.join_city_event(p_event text) returns jsonb
language sql security definer set search_path='' as $$
  select public._join_city_event_occurrence(p_event,null)
$$;
create function public.join_city_event_occurrence(p_occurrence_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare event_key text;
begin
  select event_id into event_key from public.city_event_occurrences where id=p_occurrence_id;
  if not found then raise exception 'Unknown city event occurrence'; end if;
  return public._join_city_event_occurrence(event_key,p_occurrence_id);
end $$;
revoke all on function public.get_city_events(),public.join_city_event(text),public.join_city_event_occurrence(uuid) from public,anon,authenticated;
grant execute on function public.get_city_events(),public.join_city_event(text),public.join_city_event_occurrence(uuid) to authenticated;
notify pgrst,'reload schema';
commit;

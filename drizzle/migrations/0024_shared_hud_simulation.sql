-- Personal simulation is active-session only. Shared schedules use Lagos server time.
create or replace function public.world_clock() returns jsonb
language sql stable set search_path=public as $$
  select jsonb_build_object('minute',extract(minute from t)::int,
    'hour',extract(hour from t)::int,'day',(t::date-date '2026-01-01')+1,
    'weekday',extract(isodow from t)::int-1)
  from (select now() at time zone 'Africa/Lagos' as t) clock
$$;

-- Energy recovery is a personal activity; reopening the game must not grant offline energy.
create or replace function public._refresh_energy(p_char uuid) returns integer
language sql security definer set search_path=public as $$
  select energy from public.characters where id=p_char
$$;

create table public.character_simulations (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  session_id uuid,
  heartbeat_at timestamptz not null default now(),
  paused boolean not null default false,
  speed numeric not null default 1 check (speed in (0.5,1,2)),
  minute_remainder numeric not null default 0,
  personal_time jsonb not null,
  character_time jsonb not null,
  needs jsonb not null,
  character_snapshot jsonb not null,
  active_action text,
  active_request text,
  action_location uuid,
  queued_actions jsonb not null default '[]'::jsonb,
  skills jsonb not null default '{}'::jsonb
);
create table public.simulation_action_receipts (
  character_id uuid not null references public.characters(id) on delete cascade,
  request_id text not null check (length(request_id) between 1 and 120),
  action_id text not null,
  completed_at timestamptz not null default now(),
  primary key(character_id,request_id)
);
create table public.city_event_participation (
  character_id uuid not null references public.characters(id) on delete cascade,
  event_id text not null,
  world_day integer not null,
  joined_at timestamptz not null default now(),
  primary key(character_id,event_id,world_day)
);
alter table public.character_simulations enable row level security;
alter table public.simulation_action_receipts enable row level security;
alter table public.city_event_participation enable row level security;
create policy "Own simulation" on public.character_simulations for select to authenticated using(user_id=auth.uid());
create policy "Own activity receipts" on public.simulation_action_receipts for select to authenticated using(character_id=public._my_character_id());
create policy "Own event participation" on public.city_event_participation for select to authenticated using(character_id=public._my_character_id());
revoke all on public.character_simulations,public.simulation_action_receipts,public.city_event_participation from public,anon,authenticated;
grant select on public.character_simulations,public.simulation_action_receipts,public.city_event_participation to authenticated;
grant all on public.character_simulations,public.simulation_action_receipts,public.city_event_participation to service_role;

create or replace function public.personal_simulation_command(
  p_session uuid,p_revision bigint,p_command text,p_action text default null,
  p_request text default null,p_paused boolean default null,p_speed numeric default null,p_queue jsonb default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
  cid uuid:=public._my_character_id(); c public.characters%rowtype;
  s public.character_simulations%rowtype; source jsonb; source_time jsonb; n jsonb; k text; server_minutes int:=0;
  elapsed numeric:=0; minutes int:=0; total int; duration int; changes jsonb:='{}';
  furniture text; home_required boolean:=false; skill text; skill_gain int:=0;
  rates jsonb:='{"hunger":0.035,"energy":0.025,"hygiene":0.018,"bladder":0.03,"fun":0.02,"social":0.012}';
begin
  if cid is null or auth.uid() is null or p_session is null then raise exception 'Sign in and create a character first'; end if;
  if p_command is null or p_command not in ('open','tick','settings','start','complete','interrupt','queue') then raise exception 'Unknown simulation command'; end if;
  if p_speed is not null and p_speed not in (0.5,1,2) then raise exception 'Invalid simulation speed'; end if;
  -- Lock the character first, consistently with economy RPCs.
  select * into c from public.characters where id=cid and user_id=auth.uid() for update;
  source:=jsonb_build_object('energy',c.energy,'hunger',100-c.hunger,'fun',c.happiness,'social',c.social);
  source_time:=jsonb_build_object('minute',c.game_time_minute,'hour',c.game_time_hour,'day',c.game_day,'weekday',c.game_weekday);
  insert into public.character_simulations(character_id,user_id,personal_time,needs,character_snapshot,character_time)
    values(cid,auth.uid(),source_time,source||'{"hygiene":80,"bladder":72}'::jsonb,source,source_time)
    on conflict(character_id) do nothing;
  select * into s from public.character_simulations where character_id=cid for update;
  if p_command='open' then
    if s.session_id is distinct from p_session and s.heartbeat_at>now()-interval '15 seconds' and s.session_id is not null then
      raise exception 'Simulation is active on another tab or device. Close it and retry after 15 seconds.';
    end if;
    s.session_id:=p_session;
  elsif s.session_id is distinct from p_session or s.revision is distinct from p_revision then
    raise exception 'Simulation changed on another device. Reconnect before continuing.';
  end if;
  n:=s.needs;
  server_minutes:=greatest(0,c.game_day*1440+c.game_time_hour*60+c.game_time_minute-
    ((s.character_time->>'day')::int*1440+(s.character_time->>'hour')::int*60+(s.character_time->>'minute')::int));
  if c.personality='easygoing' then rates:=jsonb_set(rates,'{fun}','0.016'); end if;
  if c.personality='social' then rates:=jsonb_set(rates,'{social}','0.0108'); end if;
  if c.personality='studious' and exists(select 1 from public.locations where id=c.current_location_id and type in ('residential','home')) then rates:=jsonb_set(rates,'{hygiene}','0.0162'); end if;
  foreach k in array array['energy','hunger','fun','social'] loop
    if source->k is distinct from s.character_snapshot->k then n:=jsonb_set(n,array[k],source->k); end if;
  end loop;
  -- Never catch up after disconnect/backgrounding; client heartbeats every six seconds.
  if p_command<>'open' and not s.paused and s.active_action is null
    and now()-s.heartbeat_at<=interval '15 seconds' then
    elapsed:=greatest(0,extract(epoch from now()-s.heartbeat_at));
    s.minute_remainder:=s.minute_remainder+elapsed*s.speed/6;
    minutes:=floor(s.minute_remainder); s.minute_remainder:=s.minute_remainder-minutes;
  end if;
  if p_command='settings' then
    s.paused:=coalesce(p_paused,s.paused); s.speed:=coalesce(p_speed,s.speed);
  elsif p_command='queue' then
    if p_queue is null or jsonb_typeof(p_queue)<>'array' then raise exception 'Invalid activity queue'; end if;
    if jsonb_array_length(s.queued_actions)+jsonb_array_length(p_queue)>20 then raise exception 'Queue is limited to 20 activities'; end if;
    if exists(select 1 from jsonb_array_elements(p_queue) a where jsonb_typeof(a)<>'string' or a#>>'{}' not in ('eat','cook','shower','toilet','sleep','watch_tv','study','exercise','socialize')) then raise exception 'Unknown queued activity'; end if;
    s.queued_actions:=s.queued_actions||p_queue;
  elsif p_command in ('start','complete') then
    if s.paused then raise exception 'Resume your personal simulation first'; end if;
    if p_request is null or length(p_request) not between 1 and 120 then raise exception 'Invalid activity request'; end if;
    if exists(select 1 from public.simulation_action_receipts where character_id=cid and request_id=p_request) then
      if not exists(select 1 from public.simulation_action_receipts where character_id=cid and request_id=p_request and action_id=p_action) then raise exception 'Request belongs to a different activity'; end if;
      -- A retry returns the current authoritative snapshot without applying effects again.
      p_command:='tick';
    else
      case p_action
        when 'eat' then duration:=20; changes:='{"hunger":35,"fun":3}';
        when 'cook' then duration:=35; changes:='{"hunger":25,"fun":5}'; furniture:='stove'; skill:='cooking'; skill_gain:=8;
        when 'shower' then duration:=15; changes:='{"hygiene":45,"fun":2}'; furniture:='shower';
        when 'toilet' then duration:=5; changes:='{"bladder":65}'; furniture:='toilet';
        when 'sleep' then duration:=480; changes:='{"energy":80}'; furniture:='bed';
        when 'watch_tv' then duration:=45; changes:='{"fun":32}'; furniture:='television';
        when 'study' then duration:=60; changes:='{"energy":-8,"fun":-4}'; skill:='learning'; skill_gain:=12;
        when 'exercise' then duration:=35; changes:='{"energy":-15,"fun":6,"hygiene":-8}'; skill:='fitness'; skill_gain:=10;
        when 'socialize' then duration:=30; changes:='{"social":28,"fun":10}'; skill:='charisma'; skill_gain:=5;
        else raise exception 'Use the travel interface for travel';
      end case;
      home_required:=furniture is not null;
      if home_required and not exists(select 1 from public.locations where id=c.current_location_id and type in ('residential','home')) then raise exception 'Travel home before this activity'; end if;
      if furniture is not null and not exists(select 1 from public.character_home_saves h,
        lateral jsonb_array_elements(h.payload->'furniture') f where h.character_id=cid and public._valid_home_save(h.payload) and f->>'itemId'=furniture)
        then raise exception 'Save a home layout with a % first',furniture; end if;
      if p_command='start' then
        if s.active_request is not null and s.active_request<>p_request then raise exception 'Finish or interrupt your current activity'; end if;
        if s.active_request=p_request and s.active_action is distinct from p_action then raise exception 'Request belongs to a different activity'; end if;
        if s.active_request is null and s.queued_actions->>0=p_action then s.queued_actions:=s.queued_actions-0; end if;
        s.active_action:=p_action; s.active_request:=p_request; s.action_location:=c.current_location_id;
      else
        if s.active_request is distinct from p_request or s.active_action is distinct from p_action then raise exception 'Activity does not match your active request'; end if;
        if s.action_location is distinct from c.current_location_id then raise exception 'Your location changed. Interrupt and restart this activity.'; end if;
        minutes:=minutes+duration;
        if skill is not null then
          skill_gain:=skill_gain+case when c.personality in ('ambitious','studious') then 1 else 0 end;
          s.skills:=jsonb_set(s.skills,array[skill],to_jsonb(coalesce((s.skills->>skill)::int,0)+skill_gain));
        end if;
        if c.personality='social' and p_action='socialize' then changes:=jsonb_set(changes,'{social}','33'); end if;
        if c.personality='creative' and p_action in ('cook','watch_tv') then changes:=jsonb_set(changes,'{fun}',to_jsonb((changes->>'fun')::int+4)); end if;
        insert into public.simulation_action_receipts(character_id,request_id,action_id) values(cid,p_request,p_action);
        s.active_action:=null; s.active_request:=null; s.action_location:=null;
      end if;
    end if;
  elsif p_command='interrupt' then
    s.active_action:=null; s.active_request:=null; s.action_location:=null;
  end if;
  foreach k in array array['hunger','energy','hygiene','bladder','fun','social'] loop
    n:=jsonb_set(n,array[k],to_jsonb(greatest(0,least(100,(n->>k)::numeric-
      (case when p_command='complete' and p_action='sleep' and k='energy' then -0.18 else (rates->>k)::numeric end)*
      (minutes+case when k in ('hygiene','bladder') then server_minutes else 0 end)*
      (case when p_command='complete' and p_action='socialize' and k='social' then 0.35 else 1 end)
      +case when p_command='complete' then coalesce((changes->>k)::numeric,0) else 0 end))));
  end loop;
  total:=(s.personal_time->>'hour')::int*60+(s.personal_time->>'minute')::int+minutes+server_minutes;
  s.personal_time:=jsonb_build_object('minute',mod(total,60),'hour',mod(total/60,24),
    'day',(s.personal_time->>'day')::int+total/1440,'weekday',mod((s.personal_time->>'weekday')::int+total/1440,7));
  -- Publish confirmed personal needs to the existing authoritative character stats.
  update public.characters set energy=round((n->>'energy')::numeric),hunger=100-round((n->>'hunger')::numeric),
    happiness=round((n->>'fun')::numeric),social=round((n->>'social')::numeric) where id=cid;
  s.character_snapshot:=jsonb_build_object('energy',round((n->>'energy')::numeric),'hunger',round((n->>'hunger')::numeric),
    'fun',round((n->>'fun')::numeric),'social',round((n->>'social')::numeric));
  update public.character_simulations set revision=s.revision+1,session_id=s.session_id,heartbeat_at=now(),
    paused=s.paused,speed=s.speed,minute_remainder=s.minute_remainder,personal_time=s.personal_time,character_time=source_time,
    needs=n,character_snapshot=s.character_snapshot,active_action=s.active_action,active_request=s.active_request,
    action_location=s.action_location,skills=s.skills,queued_actions=s.queued_actions where character_id=cid;
  return jsonb_build_object('revision',s.revision+1,'needs',n,'game_time',s.personal_time,'paused',s.paused,
    'speed',s.speed,'action',s.active_action,'request_id',s.active_request,'skills',s.skills,'queued_actions',s.queued_actions);
end $$;

create or replace function public.join_city_event(p_event text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); c public.characters%rowtype; t jsonb:=public.world_clock();
  target_slug text; weekday int; start_hour int; end_hour int; outdoors boolean; inserted int;
begin
  if cid is null then raise exception 'Create a character first'; end if;
  select * into c from public.characters where id=cid and user_id=auth.uid() for update;
  case p_event
    when 'market-day' then target_slug:='oja-oba';weekday:=2;start_hour:=9;end_hour:=16;outdoors:=true;
    when 'riverlight-gathering' then target_slug:='cultural-district';weekday:=4;start_hour:=17;end_hour:=21;outdoors:=false;
    when 'weekend-arts' then target_slug:='cultural-district';weekday:=5;start_hour:=14;end_hour:=19;outdoors:=true;
    else raise exception 'Unknown city event';
  end case;
  if (t->>'weekday')::int<>weekday or (t->>'hour')::int<start_hour or (t->>'hour')::int>=end_hour
    or (outdoors and public.world_weather_for_day((t->>'day')::int)='heavy-rain') then raise exception 'This event is not active'; end if;
  if not exists(select 1 from public.locations where id=c.current_location_id and locations.slug=target_slug and is_active) then raise exception 'Travel to the event location first'; end if;
  insert into public.city_event_participation(character_id,event_id,world_day) values(cid,p_event,(t->>'day')::int) on conflict do nothing;
  get diagnostics inserted=row_count;
  return jsonb_build_object('joined',true,'duplicate',inserted=0);
end $$;

-- Change only schedule/condition inputs, preserving existing reward and travel logic.
do $$ declare definition text; signature regprocedure; begin
  foreach signature in array array['public.perform_job(uuid)'::regprocedure,
    'public.travel_to_location(uuid,text)'::regprocedure] loop
    select pg_get_functiondef(signature) into definition;
    definition:=replace(definition,'player.game_time_hour < j.shift_start_hour','(public.world_clock()->>''hour'')::int < j.shift_start_hour');
    definition:=replace(definition,'player.game_time_hour >= j.shift_end_hour','(public.world_clock()->>''hour'')::int >= j.shift_end_hour');
    definition:=replace(definition,'public.world_weather_for_day(player.game_day)','public.world_weather_for_day((public.world_clock()->>''day'')::int)');
    definition:=replace(definition,'public.world_traffic_for_time(player.game_time_hour,player.game_weekday)',
      'public.world_traffic_for_time((public.world_clock()->>''hour'')::int,(public.world_clock()->>''weekday'')::int)');
    execute definition;
  end loop;
end $$;
create or replace function public._economy_shop_is_open(p_shop public.shops,p_hour integer)
returns boolean language sql stable set search_path=public as $$
  select p_shop.is_open and case when p_shop.opening_hour=p_shop.closing_hour then true
    when p_shop.opening_hour<p_shop.closing_hour then (public.world_clock()->>'hour')::int>=p_shop.opening_hour and (public.world_clock()->>'hour')::int<p_shop.closing_hour
    else (public.world_clock()->>'hour')::int>=p_shop.opening_hour or (public.world_clock()->>'hour')::int<p_shop.closing_hour end
$$;
revoke all on function public.world_clock(),public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb),public.join_city_event(text) from public,anon;
grant execute on function public.world_clock(),public.personal_simulation_command(uuid,bigint,text,text,text,boolean,numeric,jsonb),public.join_city_event(text) to authenticated;

-- Add functional move-in fixtures to the existing house system.
-- No currency, purchase, rent, or ownership records are changed.
update public.house_types ht
set slots = ht.slots || jsonb_build_array(jsonb_build_object(
  'id','bathroom-shower','slot_type','bathroom','x',76,'y',38))
where not exists (
  select 1 from jsonb_array_elements(ht.slots) slot where slot->>'id'='bathroom-shower'
);

update public.house_types ht
set starter_accessories = (
  select jsonb_object_agg(band.key,
    (select jsonb_agg(distinct item)
     from jsonb_array_elements_text(coalesce(band.value,'[]'::jsonb) ||
       '["starter-bed","starter-light","starter-seat","stove","shower","toilet","television"]'::jsonb) items(item)))
  from jsonb_each(ht.starter_accessories) band
)
where ht.id in ('shared-room','single-room','studio-flat','mini-flat','bungalow','duplex');

update public.player_home_accessory_sets accessories
set items = (select jsonb_agg(distinct item)
  from jsonb_array_elements_text(accessories.items ||
    '["starter-bed","starter-light","starter-seat","stove","shower","toilet","television"]'::jsonb) items(item))
where exists (select 1 from public.player_properties property
  where property.id=accessories.player_property_id and property.is_active);

create or replace function public._grant_house_essentials(p_house_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare home public.player_houses%rowtype;
begin
  select * into home from public.player_houses where id=p_house_id;
  if not found or home.status not in ('active','overdue') then return; end if;

  insert into public.player_items(player_id,item_id,source,is_stackable,quantity)
  select home.player_id, item.id, 'gift', item.stackable, 1
  from public.content_items item
  where item.id in ('starter-bed','starter-light','starter-seat','stove','shower','toilet','television')
    and item.is_active
  on conflict(player_id,item_id) where not is_stackable do nothing;

  insert into public.house_placements(player_house_id,item_id,slot)
  select home.id, fixture.item_id, fixture.slot
  from (values
    ('starter-bed','bed'),('starter-light','light'),('starter-seat','seat'),
    ('stove','kitchen'),('toilet','bathroom'),('shower','bathroom-shower'),
    ('television','device')
  ) as fixture(item_id,slot)
  join public.house_types ht on ht.id=home.house_type_id
  join public.content_items item on item.id=fixture.item_id and item.is_active
  where exists(select 1 from jsonb_array_elements(ht.slots) s
    where s->>'id'=fixture.slot and s->>'slot_type'=item.slot_type)
    and not exists(select 1 from public.house_placements placed
      where placed.player_house_id=home.id and placed.item_id=fixture.item_id)
  on conflict(player_house_id,slot) do nothing;
end $$;
revoke all on function public._grant_house_essentials(uuid) from public,anon,authenticated;

create or replace function public._grant_house_essentials_after_insert()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  perform public._grant_house_essentials(new.id);
  return new;
end $$;
revoke all on function public._grant_house_essentials_after_insert() from public,anon,authenticated;
create trigger grant_house_essentials_after_insert
after insert on public.player_houses
for each row execute function public._grant_house_essentials_after_insert();

select public._grant_house_essentials(id)
from public.player_houses where status in ('active','overdue');

-- Keep the simulation server-authoritative while recognising placed furniture
-- in the current housing system as well as existing legacy home saves.
-- Add server-validated furniture interactions using existing simulation receipts. No schema objects are added.
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
    s.minute_remainder:=s.minute_remainder+elapsed*s.speed/60;
    minutes:=floor(s.minute_remainder); s.minute_remainder:=s.minute_remainder-minutes;
  end if;
  if p_command='settings' then
    s.paused:=coalesce(p_paused,s.paused); s.speed:=coalesce(p_speed,s.speed);
  elsif p_command='queue' then
    if p_queue is null or jsonb_typeof(p_queue)<>'array' then raise exception 'Invalid activity queue'; end if;
    if jsonb_array_length(s.queued_actions)+jsonb_array_length(p_queue)>20 then raise exception 'Queue is limited to 20 activities'; end if;
    if exists(select 1 from jsonb_array_elements(p_queue) a where jsonb_typeof(a)<>'string' or a#>>'{}' not in ('eat','cook','shower','toilet','sleep','watch_tv','relax_sofa','study_computer','tend_plant','study','exercise','socialize')) then raise exception 'Unknown queued activity'; end if;
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
        when 'relax_sofa' then duration:=20; changes:='{"fun":5}'; furniture:='sofa';
        when 'study_computer' then duration:=30; changes:='{"energy":-4,"fun":-2}'; furniture:='computer'; skill:='learning'; skill_gain:=8;
        when 'tend_plant' then duration:=5; changes:='{"fun":2}'; furniture:='plant';
        when 'study' then duration:=60; changes:='{"energy":-8,"fun":-4}'; skill:='learning'; skill_gain:=12;
        when 'exercise' then duration:=35; changes:='{"energy":-15,"fun":6,"hygiene":-8}'; skill:='fitness'; skill_gain:=10;
        when 'socialize' then duration:=30; changes:='{"social":28,"fun":10}'; skill:='charisma'; skill_gain:=5;
        else raise exception 'Use the travel interface for travel';
      end case;
      home_required:=furniture is not null;
      if home_required and not exists(select 1 from public.locations where id=c.current_location_id and type in ('residential','home')) then raise exception 'Travel home before this activity'; end if;
      if furniture is not null
        and not exists(select 1 from public.house_placements hp
          join public.player_houses ph on ph.id=hp.player_house_id
          join public.content_items ci on ci.id=hp.item_id
          where ph.player_id=auth.uid() and ph.status in ('active','overdue')
            and ci.art_key=furniture)
        and not exists(select 1 from public.character_home_saves h,
          lateral jsonb_array_elements(h.payload->'furniture') f
          where h.character_id=cid and public._valid_home_save(h.payload)
            and f->>'itemId'=furniture and f->>'room'=h.payload->>'room')
        then raise exception 'Place a % in your home first',furniture; end if;
      if p_command='start' and furniture is not null then
        declare cooldown_seconds int; remaining_seconds int;
        begin
          cooldown_seconds:=case p_action when 'sleep' then 30 when 'cook' then 20 when 'study_computer' then 20
            when 'shower' then 12 when 'watch_tv' then 15 when 'relax_sofa' then 10 when 'toilet' then 5
            when 'tend_plant' then 5 else 0 end;
          select ceil(cooldown_seconds-extract(epoch from now()-max(completed_at)))::int
            into remaining_seconds from public.simulation_action_receipts
            where character_id=cid and action_id=p_action;
          if coalesce(remaining_seconds,0)>0 then
            raise exception 'That home activity is cooling down; try again in % seconds',remaining_seconds;
          end if;
        end;
      end if;
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

-- Milestone 9: persistent, server-authoritative social relationships.
create table public.npc_definitions (
  id text primary key,
  name text not null,
  role text not null,
  personality text not null,
  home_location_id uuid references public.locations(id),
  work_location_id uuid references public.locations(id),
  interests text[] not null default '{}',
  topics text[] not null default '{}',
  routine jsonb not null default '[]',
  created_at timestamptz not null default now()
);

insert into public.npc_definitions (id,name,role,personality,home_location_id,work_location_id,interests,topics,routine)
select seed.id,seed.name,seed.role,seed.personality,home.id,work.id,seed.interests,seed.topics,seed.routine::jsonb
from (values
  ('npc-adeola','Adeola Akinyemi','Market trader','warm',array['cooking','family','market stories']::text[],array['The best pepper stalls','Sunday cooking','A busy market morning']::text[],'[{"start":7,"end":16,"place":"work","activity":"selling produce"},{"start":16,"end":18,"place":"market","activity":"picking up groceries"},{"start":18,"end":24,"place":"home","activity":"resting at home"},{"start":0,"end":7,"place":"home","activity":"sleeping"}]'),
  ('npc-tunde','Tunde Bakare','Apprentice mechanic','playful',array['football','engines','music']::text[],array['Weekend football','A tricky engine repair','New music in town']::text[],'[{"start":8,"end":17,"place":"work","activity":"working on repairs"},{"start":17,"end":20,"place":"park","activity":"meeting friends"},{"start":20,"end":24,"place":"home","activity":"winding down"},{"start":0,"end":8,"place":"home","activity":"sleeping"}]'),
  ('npc-morenike','Morenike Bello','Community teacher','thoughtful',array['books','young people','local history']::text[],array['A book worth reading','School life','Osogbo history']::text[],'[{"start":7,"end":15,"place":"work","activity":"teaching a class"},{"start":15,"end":17,"place":"market","activity":"running errands"},{"start":17,"end":21,"place":"park","activity":"taking an evening walk"},{"start":21,"end":24,"place":"home","activity":"preparing lessons"},{"start":0,"end":7,"place":"home","activity":"sleeping"}]'),
  ('npc-kunle','Kunle Adesina','Café owner','ambitious',array['business','football','hospitality']::text[],array['Growing a small business','The café regulars','A big match coming up']::text[],'[{"start":6,"end":15,"place":"work","activity":"opening the café"},{"start":15,"end":17,"place":"market","activity":"buying supplies"},{"start":17,"end":19,"place":"park","activity":"catching up with friends"},{"start":19,"end":24,"place":"home","activity":"reviewing the day"},{"start":0,"end":6,"place":"home","activity":"sleeping"}]'),
  ('npc-bisola','Bisola Ogunleye','Local artist','creative',array['art','music','culture']::text[],array['A new mural idea','Osogbo creative scene','Favourite colours']::text[],'[{"start":9,"end":14,"place":"work","activity":"working on a mural"},{"start":14,"end":16,"place":"market","activity":"finding art supplies"},{"start":16,"end":19,"place":"park","activity":"sketching outdoors"},{"start":19,"end":24,"place":"home","activity":"making art at home"},{"start":0,"end":9,"place":"home","activity":"resting"}]')
) as seed(id,name,role,personality,interests,topics,routine)
join public.locations home on home.slug = 'residential'
join public.locations work on work.slug = case seed.id
  when 'npc-adeola' then 'oja-oba' when 'npc-tunde' then 'old-garage'
  when 'npc-morenike' then 'student-district' when 'npc-kunle' then 'oke-fia'
  else 'cultural-district' end
on conflict (id) do update set name=excluded.name,role=excluded.role,personality=excluded.personality,
  home_location_id=excluded.home_location_id,work_location_id=excluded.work_location_id,
  interests=excluded.interests,topics=excluded.topics,routine=excluded.routine;

alter table public.npc_definitions enable row level security;
create policy "NPC definitions are readable by signed-in players" on public.npc_definitions
  for select to authenticated using (true);
grant select on public.npc_definitions to authenticated;

create table public.character_npc_relationships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  npc_id text not null references public.npc_definitions(id) on delete cascade,
  friendship smallint not null default 0 check (friendship between 0 and 100),
  romance smallint not null default 0 check (romance between 0 and 100),
  trust smallint not null default 0 check (trust between 0 and 100),
  conflict smallint not null default 0 check (conflict between 0 and 100),
  meetings integer not null default 0 check (meetings >= 0),
  last_interaction_day integer,
  last_interaction_text text,
  daily_points smallint not null default 0,
  daily_points_day integer,
  updated_at timestamptz not null default now(),
  unique(character_id,npc_id)
);
create index on public.character_npc_relationships(character_id,updated_at desc);
alter table public.character_npc_relationships enable row level security;
create policy "Players read own NPC relationships" on public.character_npc_relationships
  for select to authenticated using (user_id=auth.uid());
grant select on public.character_npc_relationships to authenticated;

create table public.npc_interaction_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  npc_id text not null references public.npc_definitions(id) on delete cascade,
  request_id uuid not null,
  action text not null,
  accepted boolean not null,
  message text not null,
  game_day integer not null,
  created_at timestamptz not null default now(),
  unique(character_id,request_id)
);
create index on public.npc_interaction_events(character_id,created_at desc);
alter table public.npc_interaction_events enable row level security;
create policy "Players read own NPC conversation history" on public.npc_interaction_events
  for select to authenticated using (user_id=auth.uid());
grant select on public.npc_interaction_events to authenticated;

create or replace function public.interact_with_npc(p_npc_id text,p_action text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid(); player public.characters%rowtype; npc public.npc_definitions%rowtype;
  rel public.character_npc_relationships%rowtype; action_gain int := 0; next_day int;
  target_id uuid; target_slug text; available boolean; accepted boolean := true;
  result_message text; event_id uuid; points_today int;
begin
  if uid is null then raise exception 'Sign in to interact'; end if;
  if p_request_id is null then raise exception 'Interaction request ID is required'; end if;
  if p_action is null or p_action not in ('greet','work','events','interests','joke','compliment','help','invite','romance','end') then raise exception 'Unknown social interaction'; end if;
  select * into player from public.characters where user_id=uid for update;
  if not found then raise exception 'Create a character first'; end if;
  select id into event_id from public.npc_interaction_events where character_id=player.id and request_id=p_request_id;
  if event_id is not null then
    return (select jsonb_build_object('event_id',e.id,'accepted',e.accepted,'message',e.message,'duplicate',true)
      from public.npc_interaction_events e where e.id=event_id);
  end if;
  select * into npc from public.npc_definitions where id=p_npc_id;
  if not found then raise exception 'This person is not available'; end if;
  select * into rel from public.character_npc_relationships where character_id=player.id and npc_id=npc.id for update;
  if not found then
    insert into public.character_npc_relationships(user_id,character_id,npc_id)
      values(uid,player.id,npc.id) returning * into rel;
  end if;
  select coalesce((select (part->>'place') from jsonb_array_elements(npc.routine) part
    where player.game_time_hour >= (part->>'start')::int and player.game_time_hour < (part->>'end')::int limit 1),'home') into target_slug;
  target_id := case target_slug when 'work' then npc.work_location_id when 'home' then npc.home_location_id
    when 'market' then (select id from public.locations where slug='oja-oba')
    else (select id from public.locations where slug='cultural-district') end;
  available := player.game_time_hour >= 7 and player.game_time_hour < 22;
  if p_action <> 'end' and (not available or target_id is null or player.current_location_id is distinct from target_id) then
    raise exception 'Travel to where this person is and meet while they are available';
  end if;
  if p_action='end' then result_message := 'You say goodbye for now.';
  elsif p_action='invite' and (rel.friendship < 40 or rel.trust < 25 or rel.conflict >= 50) then
    accepted := false; result_message := 'You need a stronger friendship before inviting them along.';
  elsif p_action='romance' and (rel.meetings < 4 or rel.friendship < 55 or rel.trust < 40 or rel.conflict >= 30) then
    accepted := false; result_message := 'It feels too soon for that. Keep building trust and friendship first.';
  elsif rel.conflict >= 70 and p_action <> 'greet' then
    accepted := false; result_message := npc.name || ' needs some space right now.';
  elsif npc.personality='reserved' and p_action in ('joke','compliment','romance') and rel.friendship < 25 then
    accepted := false; result_message := npc.name || ' seems uncomfortable. A simple greeting may work better.';
  else
    result_message := case
      when p_action='invite' then npc.name || ' is glad you thought of them. You make plans to attend together.'
      when p_action='interests' and npc.personality in ('thoughtful','creative') then npc.name || ' lights up as you talk about a favourite subject.'
      when p_action='joke' and npc.personality in ('playful','warm') then npc.name || ' laughs and shares a joke back.'
      when p_action='help' then npc.name || ' appreciates your offer and trusts you a little more.'
      else 'You spent time with ' || npc.name || '.' end;
    action_gain := case
      when p_action='interests' and npc.personality in ('thoughtful','creative') then 6
      when p_action='interests' then 4
      when p_action='joke' and npc.personality in ('playful','warm') then 6
      when p_action='joke' then 2
      when p_action='help' then 7 when p_action='invite' then 5
      when p_action='work' then 5 when p_action='events' then 4
      when p_action='compliment' then 4 when p_action='romance' then 5 else 2 end;
  end if;
  -- Request keys make retries idempotent; daily caps prevent relationship farming.
  next_day := case when rel.daily_points_day=player.game_day then rel.daily_points else 0 end;
  points_today := least(action_gain, greatest(0,12-next_day));
  if accepted and p_action <> 'end' then
    update public.character_npc_relationships set
      friendship=least(100,friendship + case when p_action='romance' then 0 else points_today end),
      trust=least(100,trust + case when p_action='help' then least(4,points_today) when p_action in ('interests','work','invite') then least(2,points_today) else 0 end),
      romance=least(100,romance + case when p_action='romance' then least(3,points_today) else 0 end),
      meetings=meetings + case when last_interaction_day is distinct from player.game_day then 1 else 0 end,
      last_interaction_day=player.game_day,last_interaction_text=initcap(replace(p_action,'_',' ')),
      daily_points=next_day+points_today,daily_points_day=player.game_day,updated_at=now()
    where id=rel.id returning * into rel;
  elsif not accepted then
    update public.character_npc_relationships set conflict=least(100,conflict+1),updated_at=now()
      where id=rel.id returning * into rel;
  end if;
  insert into public.npc_interaction_events(user_id,character_id,npc_id,request_id,action,accepted,message,game_day)
    values(uid,player.id,npc.id,p_request_id,p_action,accepted,result_message,player.game_day)
    returning id into event_id;
  return jsonb_build_object('event_id',event_id,'accepted',accepted,'message',result_message,
    'friendship',rel.friendship,'romance',rel.romance,'trust',rel.trust,'conflict',rel.conflict,'meetings',rel.meetings,'duplicate',false);
end;
$$;
revoke all on function public.interact_with_npc(text,text,uuid) from public;
grant execute on function public.interact_with_npc(text,text,uuid) to authenticated;

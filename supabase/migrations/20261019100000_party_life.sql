-- Party life: clubs, drinks, dancing and hosted events.
-- Every change goes through security-definer RPCs; browsers get read-only RLS access.
-- Product defaults (confirm before release):
--   * Venues reuse existing town map locations: lantern-club is the club, sports-ground and town-market are event centers.
--   * Mood is a separate 0-100 score (default 50), changed only by apply_party_mood().
--   * Dance cooldown 60 seconds per player; club visits auto-expire after 2 hours.
--   * Events can be scheduled up to 24 hours ahead and stay live for 3 hours. Hosting is free.

create table if not exists public.party_venues (
  location_id uuid primary key references public.locations(id) on delete cascade,
  venue_kind text not null check (venue_kind in ('club','event_center')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.party_venues(location_id,venue_kind)
select id,'club' from public.locations where slug='lantern-club'
on conflict (location_id) do update set venue_kind=excluded.venue_kind,is_active=true;
insert into public.party_venues(location_id,venue_kind)
select id,'event_center' from public.locations where slug in ('sports-ground','town-market')
on conflict (location_id) do update set venue_kind=excluded.venue_kind,is_active=true;

create table if not exists public.party_drinks (
  slug text primary key,
  name text not null,
  price bigint not null check (price > 0),
  mood_effect integer not null check (mood_effect between 1 and 20),
  icon text not null default 'glass-water',
  is_active boolean not null default true
);

insert into public.party_drinks(slug,name,price,mood_effect,icon) values
  ('zobo','Zobo',500,5,'glass-water'),
  ('chapman','Chapman',1500,10,'martini'),
  ('star-beer','Star beer',1000,8,'beer')
on conflict (slug) do update set name=excluded.name,price=excluded.price,mood_effect=excluded.mood_effect,
  icon=excluded.icon,is_active=true;

create table if not exists public.party_mood (
  character_id uuid primary key references public.characters(id) on delete cascade,
  user_id uuid not null,
  score integer not null default 50 check (score between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.club_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 hours',
  ended_at timestamptz,
  end_reason text check (end_reason in ('left','expired'))
);
create unique index if not exists club_visits_one_active_idx
  on public.club_visits(character_id) where ended_at is null;

create table if not exists public.party_drink_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  drink_slug text not null references public.party_drinks(slug),
  amount bigint not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.party_dance_cooldowns (
  character_id uuid primary key references public.characters(id) on delete cascade,
  last_dance_at timestamptz not null default now()
);

create table if not exists public.party_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  host_character_id uuid not null references public.characters(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 60),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists public.party_event_requirements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_events(id) on delete cascade,
  kind text not null check (kind in ('drink','guest')),
  item_or_role text not null,
  quantity integer not null check (quantity between 1 and 20),
  fulfilled_count integer not null default 0,
  check (fulfilled_count between 0 and quantity)
);

create table if not exists public.party_event_fulfilments (
  requirement_id uuid not null references public.party_event_requirements(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (requirement_id, character_id)
);

-- RLS: players read only their own rows, plus public party venues, drinks and scheduled events.
alter table public.party_venues enable row level security;
alter table public.party_drinks enable row level security;
alter table public.party_mood enable row level security;
alter table public.club_visits enable row level security;
alter table public.party_drink_purchases enable row level security;
alter table public.party_dance_cooldowns enable row level security;
alter table public.party_events enable row level security;
alter table public.party_event_requirements enable row level security;
alter table public.party_event_fulfilments enable row level security;

drop policy if exists party_venues_read on public.party_venues;
create policy party_venues_read on public.party_venues for select to authenticated using (is_active);
drop policy if exists party_drinks_read on public.party_drinks;
create policy party_drinks_read on public.party_drinks for select to authenticated using (is_active);
drop policy if exists party_mood_own on public.party_mood;
create policy party_mood_own on public.party_mood for select to authenticated using (user_id=auth.uid());
drop policy if exists club_visits_own on public.club_visits;
create policy club_visits_own on public.club_visits for select to authenticated using (user_id=auth.uid());
drop policy if exists party_drink_purchases_own on public.party_drink_purchases;
create policy party_drink_purchases_own on public.party_drink_purchases for select to authenticated using (user_id=auth.uid());
drop policy if exists party_dance_cooldowns_own on public.party_dance_cooldowns;
create policy party_dance_cooldowns_own on public.party_dance_cooldowns for select to authenticated
  using (character_id in (select id from public.characters where user_id=auth.uid()));
drop policy if exists party_events_read on public.party_events;
create policy party_events_read on public.party_events for select to authenticated
  using (status='scheduled' and ends_at>now() or user_id=auth.uid());
drop policy if exists party_event_requirements_read on public.party_event_requirements;
create policy party_event_requirements_read on public.party_event_requirements for select to authenticated
  using (exists (select 1 from public.party_events e where e.id=event_id
    and ((e.status='scheduled' and e.ends_at>now()) or e.user_id=auth.uid())));
drop policy if exists party_event_fulfilments_own on public.party_event_fulfilments;
create policy party_event_fulfilments_own on public.party_event_fulfilments for select to authenticated
  using (character_id in (select id from public.characters where user_id=auth.uid()));

-- Shared mood function: the only place mood changes. Clamped to 0..100.
create or replace function public.apply_party_mood(p_character_id uuid, p_user_id uuid, p_delta integer)
returns integer language plpgsql security definer set search_path=public as $$
declare new_score integer;
begin
  insert into public.party_mood(character_id,user_id,score) values(p_character_id,p_user_id,50)
    on conflict (character_id) do nothing;
  update public.party_mood
    set score=least(100,greatest(0,score+p_delta)), updated_at=now()
    where character_id=p_character_id
    returning score into new_score;
  return new_score;
end $$;
revoke all on function public.apply_party_mood(uuid,uuid,integer) from public,anon,authenticated;

create or replace function public._party_active_visit(p_character_id uuid)
returns public.club_visits language plpgsql security definer set search_path=public as $$
declare v public.club_visits%rowtype;
begin
  update public.club_visits set ended_at=now(), end_reason='expired'
    where character_id=p_character_id and ended_at is null and expires_at<=now();
  select * into v from public.club_visits where character_id=p_character_id and ended_at is null;
  return v;
end $$;
revoke all on function public._party_active_visit(uuid) from public,anon,authenticated;

create or replace function public._party_is_venue(p_location_id uuid, p_kind text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (select 1 from public.party_venues v where v.location_id=p_location_id
    and v.is_active and (p_kind is null or v.venue_kind=p_kind));
$$;
revoke all on function public._party_is_venue(uuid,text) from public,anon,authenticated;

create or replace function public.enter_club(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  v public.club_visits%rowtype; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_enter_club';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  if not public._party_is_venue(c.current_location_id,'club') then raise exception 'Travel to a club to join the party'; end if;
  v:=public._party_active_visit(cid);
  if v.id is not null and v.location_id=c.current_location_id then
    null;
  elsif v.id is not null then
    raise exception 'Leave your current club before joining another';
  else
    insert into public.club_visits(user_id,character_id,location_id) values(uid,cid,c.current_location_id)
      returning * into v;
  end if;
  result:=jsonb_build_object('visit_id',v.id,'location_id',v.location_id,'expires_at',v.expires_at);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_enter_club',result);
  return result;
end $$;

create or replace function public.leave_club(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); v public.club_visits%rowtype; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_leave_club';
  if found then return result; end if;
  v:=public._party_active_visit(cid);
  if v.id is null then raise exception 'You are not in a club'; end if;
  update public.club_visits set ended_at=now(), end_reason='left' where id=v.id;
  result:=jsonb_build_object('left',true,'location_id',v.location_id);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_leave_club',result);
  return result;
end $$;

create or replace function public.buy_drink(p_drink_slug text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  d public.party_drinks%rowtype; w public.wallets%rowtype; v public.club_visits%rowtype;
  cash_after bigint; mood integer; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_buy_drink';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  v:=public._party_active_visit(cid);
  if v.id is null or v.location_id is distinct from c.current_location_id then raise exception 'Join the club to buy a drink'; end if;
  select * into d from public.party_drinks where slug=p_drink_slug and is_active;
  if not found then raise exception 'This drink is not on the menu'; end if;
  select * into w from public.wallets where character_id=cid and user_id=uid for update;
  if not found or w.balance<d.price then raise exception 'Insufficient cash'; end if;
  cash_after:=w.balance-d.price;
  update public.wallets set balance=cash_after,total_expenses=total_expenses+d.price where id=w.id;
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(uid,w.id,cid,d.price,'expense','purchase','Bought '||d.name,'purchase','cash','Club bar',
    'party',cash_after,jsonb_build_object('drink_slug',d.slug,'request_id',p_request_id));
  insert into public.party_drink_purchases(user_id,character_id,location_id,drink_slug,amount)
    values(uid,cid,v.location_id,d.slug,d.price);
  mood:=public.apply_party_mood(cid,uid,d.mood_effect);
  perform public._advance_character_game_time(cid,20);
  result:=jsonb_build_object('drink',d.name,'price',d.price,'mood',mood,'cash',cash_after);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_buy_drink',result);
  return result;
end $$;

create or replace function public.dance_with_npc(p_npc_slug text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  v public.club_visits%rowtype; last_at timestamptz; mood integer; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  if p_npc_slug is null or p_npc_slug !~ '^[a-z0-9-]{1,40}$' then raise exception 'Choose a dancer'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_dance_npc';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  v:=public._party_active_visit(cid);
  if v.id is null or v.location_id is distinct from c.current_location_id then raise exception 'Join the club to dance'; end if;
  select last_dance_at into last_at from public.party_dance_cooldowns where character_id=cid;
  if found and last_at>now()-interval '60 seconds' then raise exception 'Rest a moment before dancing again'; end if;
  insert into public.party_dance_cooldowns(character_id,last_dance_at) values(cid,now())
    on conflict (character_id) do update set last_dance_at=excluded.last_dance_at;
  mood:=public.apply_party_mood(cid,uid,3);
  result:=jsonb_build_object('partner','npc','npc',p_npc_slug,'mood',mood);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_dance_npc',result);
  return result;
end $$;

create or replace function public.dance_with_player(p_target_character_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  target public.characters%rowtype; v public.club_visits%rowtype; tv public.club_visits%rowtype;
  last_at timestamptz; mood integer; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  if p_target_character_id is null or p_target_character_id=cid then raise exception 'Choose another player to dance with'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_dance_player';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  v:=public._party_active_visit(cid);
  if v.id is null or v.location_id is distinct from c.current_location_id then raise exception 'Join the club to dance'; end if;
  select * into target from public.characters where id=p_target_character_id;
  if not found then raise exception 'That player is not here'; end if;
  tv:=public._party_active_visit(target.id);
  if tv.id is null or tv.location_id is distinct from c.current_location_id then raise exception 'That player is not in this club'; end if;
  select last_dance_at into last_at from public.party_dance_cooldowns where character_id=cid;
  if found and last_at>now()-interval '60 seconds' then raise exception 'Rest a moment before dancing again'; end if;
  insert into public.party_dance_cooldowns(character_id,last_dance_at) values(cid,now())
    on conflict (character_id) do update set last_dance_at=excluded.last_dance_at;
  mood:=public.apply_party_mood(cid,uid,5);
  perform public.apply_party_mood(target.id,target.user_id,5);
  result:=jsonb_build_object('partner','player','partner_name',target.name,'mood',mood);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_dance_player',result);
  return result;
end $$;

create or replace function public.host_party_event(p_location_id uuid,p_title text,p_starts_at timestamptz,
  p_requirements jsonb,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  e public.party_events%rowtype; req jsonb; result jsonb; req_count integer;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_host_event';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  if p_location_id is distinct from c.current_location_id or not public._party_is_venue(p_location_id,'event_center') then
    raise exception 'Host events at an event center you are in';
  end if;
  if char_length(coalesce(p_title,'')) not between 3 and 60 then raise exception 'Give the event a title of 3 to 60 characters'; end if;
  if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '24 hours' then
    raise exception 'Events must start within the next 24 hours';
  end if;
  if jsonb_typeof(p_requirements)<>'array' then raise exception 'Requirements must be a list'; end if;
  req_count:=jsonb_array_length(p_requirements);
  if req_count<1 or req_count>5 then raise exception 'Add between 1 and 5 requirements'; end if;
  insert into public.party_events(user_id,host_character_id,location_id,title,starts_at,ends_at)
    values(uid,cid,p_location_id,trim(p_title),p_starts_at,p_starts_at+interval '3 hours')
    returning * into e;
  for req in select * from jsonb_array_elements(p_requirements) loop
    if req->>'kind' not in ('drink','guest') then raise exception 'Requirement kind must be drink or guest'; end if;
    if coalesce(req->>'item_or_role','') = '' then raise exception 'Each requirement needs an item or role'; end if;
    if req->>'kind'='drink' and not exists(select 1 from public.party_drinks d where d.slug=req->>'item_or_role' and d.is_active) then
      raise exception 'Unknown drink requirement';
    end if;
    insert into public.party_event_requirements(event_id,kind,item_or_role,quantity)
      values(e.id,req->>'kind',req->>'item_or_role',(req->>'quantity')::integer);
  end loop;
  result:=jsonb_build_object('event_id',e.id,'starts_at',e.starts_at,'ends_at',e.ends_at);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_host_event',result);
  return result;
end $$;

create or replace function public.respond_to_event(p_requirement_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  r public.party_event_requirements%rowtype; e public.party_events%rowtype;
  host public.characters%rowtype; visit public.club_visits%rowtype; result jsonb;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_respond_event';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  select * into r from public.party_event_requirements where id=p_requirement_id for update;
  if not found then raise exception 'This requirement no longer exists'; end if;
  select * into e from public.party_events where id=r.event_id;
  if e.status<>'scheduled' or now()<e.starts_at or now()>=e.ends_at then raise exception 'This event is not live'; end if;
  if c.current_location_id is distinct from e.location_id then raise exception 'Go to the event to take part'; end if;
  if e.host_character_id=cid then raise exception 'Hosts cannot fulfil their own requirements'; end if;
  if exists(select 1 from public.party_event_fulfilments f where f.requirement_id=r.id and f.character_id=cid) then
    raise exception 'You have already done this';
  end if;
  if r.kind='drink' then
    if not exists(select 1 from public.party_drink_purchases p where p.character_id=cid
      and p.drink_slug=r.item_or_role and p.location_id=e.location_id and p.created_at>=e.starts_at) then
      raise exception 'Buy a % at this event first', r.item_or_role;
    end if;
  end if;
  if r.kind='guest' then
    visit:=public._party_active_visit(cid);
    if visit.id is null or visit.location_id<>e.location_id then raise exception 'Join the event club first'; end if;
  end if;
  if r.fulfilled_count>=r.quantity then raise exception 'This requirement is already complete'; end if;
  insert into public.party_event_fulfilments(requirement_id,character_id) values(r.id,cid);
  update public.party_event_requirements set fulfilled_count=fulfilled_count+1 where id=r.id
    returning * into r;
  if r.fulfilled_count=r.quantity then
    select * into host from public.characters where id=e.host_character_id;
    perform public.apply_party_mood(host.id,host.user_id,15);
  end if;
  result:=jsonb_build_object('requirement_id',r.id,'fulfilled_count',r.fulfilled_count,'quantity',r.quantity);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_respond_event',result);
  return result;
end $$;

grant execute on function public.enter_club(uuid) to authenticated;
grant execute on function public.leave_club(uuid) to authenticated;
grant execute on function public.buy_drink(text,uuid) to authenticated;
grant execute on function public.dance_with_npc(text,uuid) to authenticated;
grant execute on function public.dance_with_player(uuid,uuid) to authenticated;
grant execute on function public.host_party_event(uuid,text,timestamptz,jsonb,uuid) to authenticated;
grant execute on function public.respond_to_event(uuid,uuid) to authenticated;

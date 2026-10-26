-- Requires October 19 party migrations and the existing game/auth schema.
begin;
create table public.party_host_reward_settings (
  singleton boolean primary key default true check(singleton),
  activated_at timestamptz not null default clock_timestamp(),
  reputation_reward integer not null default 1 check(reputation_reward=1)
);
insert into public.party_host_reward_settings(singleton) values(true);
create table public.party_host_reward_receipts (
  -- Keep event/account-day evidence after character deletion cascades its events.
  event_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id uuid references public.characters(id) on delete set null,
  claim_date date not null,
  awarded_at timestamptz not null,
  result jsonb not null,
  unique(user_id,claim_date)
);
create index party_host_reward_character_idx on public.party_host_reward_receipts(character_id);
alter table public.party_host_reward_settings enable row level security;
alter table public.party_host_reward_receipts enable row level security;
revoke all on public.party_host_reward_settings,public.party_host_reward_receipts from public,anon,authenticated;
grant select on public.party_host_reward_receipts to authenticated;
grant all on public.party_host_reward_settings,public.party_host_reward_receipts to service_role;
create policy party_host_reward_own on public.party_host_reward_receipts for select to authenticated using(user_id=(select auth.uid()));

create function public._party_host_result(p_event uuid,p_now timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.party_events%rowtype; total integer; complete integer; guests integer; reason text; receipt jsonb;
begin
  if not exists(select 1 from public.party_host_reward_settings where singleton) then raise exception 'REWARD_SETTINGS_UNAVAILABLE'; end if;
  select * into e from public.party_events where id=p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  select count(*),count(*) filter(where (
    select count(*) from public.party_event_fulfilments f
    join public.characters c on c.id=f.character_id
    join auth.users u on u.id=c.user_id and not coalesce(u.is_anonymous,false)
    where f.requirement_id=r.id and c.user_id<>e.user_id
      and f.created_at>=e.starts_at and f.created_at<e.ends_at
  )>=r.quantity) into total,complete from public.party_event_requirements r where r.event_id=e.id;
  select count(distinct c.user_id) into guests from public.party_event_fulfilments f
    join public.party_event_requirements r on r.id=f.requirement_id
    join public.characters c on c.id=f.character_id
    join auth.users u on u.id=c.user_id and not coalesce(u.is_anonymous,false)
    where r.event_id=e.id and c.user_id<>e.user_id and f.created_at>=e.starts_at and f.created_at<e.ends_at;
  select r.result into receipt from public.party_host_reward_receipts r where r.event_id=e.id;
  reason:=case
    when receipt is not null then 'claimed'
    when e.created_at<(select activated_at from public.party_host_reward_settings where singleton) then 'legacy'
    when e.status<>'scheduled' then 'cancelled'
    when p_now<e.ends_at then 'not_ended'
    when p_now>e.ends_at+interval '7 days' then 'expired'
    when total=0 or complete<>total then 'requirements'
    when guests<2 then 'guests'
    when exists(select 1 from public.party_host_reward_receipts r where r.user_id=e.user_id and r.claim_date=(p_now at time zone 'Africa/Lagos')::date) then 'daily_cap'
    else 'eligible' end;
  return jsonb_build_object('eventId',e.id,'title',e.title,'endsAt',e.ends_at,'claimUntil',e.ends_at+interval '7 days',
    'requirements',total,'completed',complete,'guests',guests,'reason',reason,'receipt',receipt);
end $$;
revoke all on function public._party_host_result(uuid,timestamptz) from public,anon,authenticated;

create function public.get_party_host_results() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); stamp timestamptz:=clock_timestamp(); events jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  select coalesce(jsonb_agg(public._party_host_result(e.id,stamp) order by e.ends_at desc),'[]'::jsonb) into events
    from (select p.* from public.party_events p where p.user_id=uid and p.ends_at>=stamp-interval '7 days' order by p.ends_at desc limit 100) e;
  return jsonb_build_object('serverTime',stamp,'date',(stamp at time zone 'Africa/Lagos')::date,'reward',1,'events',events);
end $$;
revoke all on function public.get_party_host_results() from public,anon;
grant execute on function public.get_party_host_results() to authenticated;

create function public.claim_party_host_reward(p_event_id uuid,p_date date) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); e public.party_events%rowtype; receipt public.party_host_reward_receipts%rowtype;
  stamp timestamptz; day date; state jsonb; before_rep integer; after_rep integer; result jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('party-host:'||uid::text,0));
  select * into receipt from public.party_host_reward_receipts r where r.event_id=p_event_id and r.user_id=uid;
  if found then return receipt.result||jsonb_build_object('newlyAwarded',false); end if;
  select * into e from public.party_events where id=p_event_id for update;
  if not found or e.user_id<>uid then raise exception 'NOT_YOUR_EVENT'; end if;
  select c.reputation into before_rep from public.characters c where c.id=e.host_character_id and c.user_id=uid for update;
  if not found then raise exception 'NOT_YOUR_EVENT'; end if;
  stamp:=clock_timestamp(); day:=(stamp at time zone 'Africa/Lagos')::date;
  if p_date is distinct from day then raise exception 'STALE_DATE'; end if;
  state:=public._party_host_result(e.id,stamp);
  if state->>'reason'<>'eligible' then raise exception 'PARTY_INELIGIBLE:%',state->>'reason'; end if;
  after_rep:=least(100,before_rep+1);
  result:=jsonb_build_object('eventId',e.id,'date',day,'awardedAt',stamp,'reputationDelta',after_rep-before_rep,'reputationAfter',after_rep,'reward',1,'completed',state->'completed','guests',state->'guests');
  insert into public.party_host_reward_receipts(event_id,user_id,character_id,claim_date,awarded_at,result)
    values(e.id,uid,e.host_character_id,day,stamp,result);
  update public.characters set reputation=after_rep where id=e.host_character_id;
  return result||jsonb_build_object('newlyAwarded',true);
end $$;
revoke all on function public.claim_party_host_reward(uuid,date) from public,anon;
grant execute on function public.claim_party_host_reward(uuid,date) to authenticated;

-- Same public contract and requirement mood reward; event-centre attendance uses saved location.
create or replace function public.respond_to_event(p_requirement_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); cid uuid; target_event uuid; e public.party_events%rowtype;
  c public.characters%rowtype; host public.characters%rowtype; r public.party_event_requirements%rowtype;
  stamp timestamptz; result jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  select id into cid from public.characters where user_id=uid;
  if cid is null or p_request_id is null then raise exception 'Character and request ID required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er where er.character_id=cid and er.request_id=p_request_id and er.operation='party_respond_event';
  if found then return result; end if;
  select pr.event_id into target_event from public.party_event_requirements pr where pr.id=p_requirement_id;
  select * into e from public.party_events where id=target_event for update;
  if not found then raise exception 'Event no longer exists'; end if;
  -- Every response takes the event first, then both character rows in UUID order.
  perform 1 from public.characters where id in(cid,e.host_character_id) order by id for update;
  select * into c from public.characters where id=cid and user_id=uid;
  select * into host from public.characters where id=e.host_character_id;
  if c.id is null or host.id is null or e.user_id=uid then raise exception 'Hosts cannot fulfil their own requirements'; end if;
  select * into r from public.party_event_requirements where id=p_requirement_id and party_event_requirements.event_id=e.id for update;
  if not found then raise exception 'Requirement no longer exists'; end if;
  stamp:=clock_timestamp();
  if e.status<>'scheduled' or stamp<e.starts_at or stamp>=e.ends_at then raise exception 'This event is not live'; end if;
  if c.current_location_id is distinct from e.location_id or not public._party_is_venue(e.location_id,'event_center') then raise exception 'Go to the active event centre to take part'; end if;
  if exists(select 1 from public.party_event_fulfilments f where f.requirement_id=r.id and f.character_id=cid) then raise exception 'You have already done this'; end if;
  if r.kind='drink' and not exists(select 1 from public.party_drink_purchases p where p.character_id=cid and p.drink_slug=r.item_or_role and p.location_id=e.location_id and p.created_at>=e.starts_at and p.created_at<e.ends_at and p.created_at<=stamp) then raise exception 'Buy the required drink at this event first'; end if;
  if r.fulfilled_count>=r.quantity then raise exception 'This requirement is already complete'; end if;
  insert into public.party_event_fulfilments(requirement_id,character_id,created_at) values(r.id,cid,stamp);
  update public.party_event_requirements set fulfilled_count=fulfilled_count+1 where id=r.id returning * into r;
  if r.fulfilled_count=r.quantity then perform public.apply_party_mood(host.id,host.user_id,15); end if;
  result:=jsonb_build_object('requirement_id',r.id,'fulfilled_count',r.fulfilled_count,'quantity',r.quantity);
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'party_respond_event',result);
  return result;
end $$;
revoke all on function public.respond_to_event(uuid,uuid) from public,anon;
grant execute on function public.respond_to_event(uuid,uuid) to authenticated;
notify pgrst,'reload schema';
commit;

-- Requires party life, clubs/activities and host reputation migrations.
begin;
create table public.party_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.party_events(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','declined')),
  created_at timestamptz not null,
  responded_at timestamptz,
  unique(event_id,recipient_user_id),
  check(host_user_id<>recipient_user_id),
  check((status='pending')=(responded_at is null))
);
create index party_invitations_recipient_page on public.party_invitations(recipient_user_id,id);
create table public.party_event_guests (
  event_id uuid not null,
  guest_user_id uuid not null,
  character_id uuid references public.characters(id) on delete set null,
  accepted_at timestamptz not null,
  primary key(event_id,guest_user_id),
  foreign key(event_id,guest_user_id) references public.party_invitations(event_id,recipient_user_id) on delete cascade
);
create index party_event_guests_character on public.party_event_guests(character_id);
-- Account receipts deliberately have no event/character FK: retries and account rate limits
-- survive character/event deletion. Payload binds each UUID to one exact operation.
create table public.party_invitation_receipts (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_invitation boolean not null,
  created_at timestamptz not null,
  primary key(user_id,request_id)
);
create index party_invitation_send_rate on public.party_invitation_receipts(user_id,created_at desc) where created_invitation;
alter table public.party_invitations enable row level security;
alter table public.party_event_guests enable row level security;
alter table public.party_invitation_receipts enable row level security;
create policy party_invitation_participants on public.party_invitations for select to authenticated
  using((select auth.uid()) in(host_user_id,recipient_user_id));
create policy party_guests_participants on public.party_event_guests for select to authenticated
  using(guest_user_id=(select auth.uid()) or exists(select 1 from public.party_invitations i where i.event_id=party_event_guests.event_id and i.recipient_user_id=guest_user_id and i.host_user_id=(select auth.uid())));
create policy party_invitation_receipt_owner on public.party_invitation_receipts for select to authenticated using(user_id=(select auth.uid()));
revoke all on public.party_invitations,public.party_event_guests,public.party_invitation_receipts from public,anon,authenticated;
grant all on public.party_invitations,public.party_event_guests,public.party_invitation_receipts to service_role;

create function public.party_invitation_action(
  p_kind text,p_request_id uuid,p_event_id uuid default null,p_recipient_character_id uuid default null,
  p_invitation_id uuid default null,p_decision text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); e public.party_events%rowtype; i public.party_invitations%rowtype;
  host public.characters%rowtype; recipient public.characters%rowtype;
  receipt public.party_invitation_receipts%rowtype; payload jsonb; result jsonb;
  event_id_value uuid; stamp timestamptz; created boolean:=false;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if p_request_id is null or p_kind is null or p_kind not in('send','respond') then raise exception 'INVALID_INVITATION_REQUEST'; end if;
  if p_kind='send' then
    if p_event_id is null or p_recipient_character_id is null or p_invitation_id is not null or p_decision is not null then raise exception 'INVALID_INVITATION_REQUEST'; end if;
    event_id_value:=p_event_id;
  else
    if p_invitation_id is null or p_decision is null or p_decision not in('accepted','declined') or p_event_id is not null or p_recipient_character_id is not null then raise exception 'INVALID_INVITATION_REQUEST'; end if;
  end if;
  payload:=jsonb_build_object('kind',p_kind,'eventId',p_event_id,'target',p_recipient_character_id,'invitationId',p_invitation_id,'decision',p_decision);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('party-invitation-request:'||uid::text||p_request_id::text,0));
  select * into receipt from public.party_invitation_receipts r where r.user_id=uid and r.request_id=p_request_id;
  if found then
    if receipt.payload<>payload then raise exception 'REQUEST_ID_REUSED'; end if;
    return receipt.result||jsonb_build_object('duplicate',true);
  end if;
  if p_kind='respond' then
    select event_id into event_id_value from public.party_invitations where id=p_invitation_id and recipient_user_id=uid;
  end if;
  select * into e from public.party_events where id=event_id_value for update;
  if not found or (p_kind='send' and e.user_id<>uid) then raise exception 'INVITATION_UNAVAILABLE'; end if;
  if p_kind='send' then
    -- All sends use the same account lock across events, before any character lock.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('party-invitation-quota:'||uid::text,0));
    select * into recipient from public.characters where id=p_recipient_character_id;
    if not found or recipient.user_id=uid then raise exception 'INVALID_RECIPIENT'; end if;
    select * into i from public.party_invitations where event_id=e.id and recipient_user_id=recipient.user_id for update;
  else
    select * into i from public.party_invitations where id=p_invitation_id and recipient_user_id=uid and event_id=e.id for update;
    if not found then raise exception 'INVITATION_UNAVAILABLE'; end if;
    select * into recipient from public.characters where user_id=uid;
  end if;
  perform 1 from public.characters where id in(e.host_character_id,recipient.id) order by id for update;
  select * into host from public.characters where id=e.host_character_id and user_id=e.user_id;
  select * into recipient from public.characters where id=recipient.id;
  if host.id is null or recipient.id is null or not exists(select 1 from auth.users u where u.id=host.user_id and not coalesce(u.is_anonymous,false)) or not exists(select 1 from auth.users u where u.id=recipient.user_id and not coalesce(u.is_anonymous,false)) then raise exception 'INVITATION_UNAVAILABLE'; end if;
  stamp:=clock_timestamp();
  if p_kind='respond' and i.status<>'pending' then
    if i.status<>p_decision then raise exception 'INVITATION_ALREADY_RESOLVED'; end if;
    -- Returning an already confirmed choice creates no new membership or attendance.
  else
    if e.status<>'scheduled' or stamp>=e.ends_at then raise exception 'EVENT_NOT_ACCEPTING_INVITATIONS'; end if;
    if exists(select 1 from public.player_blocks b where (b.blocker_character_id=host.id and b.blocked_character_id=recipient.id) or (b.blocker_character_id=recipient.id and b.blocked_character_id=host.id)) then raise exception 'PLAYER_BLOCKED'; end if;
    if p_kind='send' then
      if i.id is null then
        if (select count(*) from public.party_invitations where event_id=e.id)>=50 then raise exception 'EVENT_INVITATION_LIMIT'; end if;
        if (select count(*) from public.party_invitation_receipts r where r.user_id=uid and r.created_invitation and r.created_at>stamp-interval '1 minute')>=20 then raise exception 'INVITATION_RATE_LIMIT'; end if;
        insert into public.party_invitations(event_id,host_user_id,recipient_user_id,created_at) values(e.id,uid,recipient.user_id,stamp) returning * into i;
        insert into public.notifications(user_id,character_id,title,body,kind,created_at) values(recipient.user_id,recipient.id,'Party invitation',host.name||' invited you to "'||e.title||'". Open Party → Invitations to respond.','party_invitation',stamp);
        created:=true;
      end if;
    else
      update public.party_invitations set status=p_decision,responded_at=stamp where id=i.id returning * into i;
      if p_decision='accepted' then
        insert into public.party_event_guests(event_id,guest_user_id,character_id,accepted_at) values(e.id,uid,recipient.id,stamp);
      end if;
    end if;
  end if;
  result:=jsonb_build_object('requestId',p_request_id,'invitationId',i.id,'eventId',e.id,'status',i.status,'isNew',created,'confirmedAt',coalesce(i.responded_at,i.created_at));
  insert into public.party_invitation_receipts(user_id,request_id,payload,result,created_invitation,created_at) values(uid,p_request_id,payload,result,created,stamp);
  return result||jsonb_build_object('duplicate',false);
end $$;

create function public.get_party_invitations(p_event_id uuid default null,p_after uuid default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); stamp timestamptz:=statement_timestamp(); result jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if not exists(select 1 from public.characters where user_id=uid) then raise exception 'CHARACTER_REQUIRED'; end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'INVALID_PAGE_LIMIT'; end if;
  if p_event_id is not null and not exists(select 1 from public.party_events e join public.characters h on h.id=e.host_character_id and h.user_id=e.user_id where e.id=p_event_id and e.user_id=uid) then raise exception 'INVITATION_UNAVAILABLE'; end if;
  with eligible as (
    select i.*,e.title,e.starts_at,e.ends_at,e.location_id,l.name as venue_name,h.name as host_name,
      r.name as recipient_name,r.id as recipient_character_id,
      case when e.status='cancelled' then 'cancelled' when stamp>=e.ends_at then 'ended' when stamp<e.starts_at then 'scheduled' else 'live' end as phase,
      exists(select 1 from public.party_event_guests g where g.event_id=i.event_id and g.guest_user_id=i.recipient_user_id) as is_guest,
      (r.id is not null and exists(select 1 from auth.users u where u.id=i.recipient_user_id and not coalesce(u.is_anonymous,false))
        and exists(select 1 from auth.users u where u.id=i.host_user_id and not coalesce(u.is_anonymous,false))
        and not exists(select 1 from public.player_blocks b where (b.blocker_character_id=h.id and b.blocked_character_id=r.id) or (b.blocker_character_id=r.id and b.blocked_character_id=h.id))) as eligible_response
    from public.party_invitations i join public.party_events e on e.id=i.event_id and e.user_id=i.host_user_id
    join public.characters h on h.id=e.host_character_id and h.user_id=i.host_user_id
    join public.locations l on l.id=e.location_id left join public.characters r on r.user_id=i.recipient_user_id
    where ((p_event_id is null and i.recipient_user_id=uid) or (p_event_id is not null and i.event_id=p_event_id and i.host_user_id=uid))
      and(p_after is null or i.id>p_after) order by i.id limit p_limit+1
  ), page as(select * from eligible order by id limit p_limit)
  select jsonb_build_object('serverTime',stamp,'items',coalesce((select jsonb_agg(jsonb_build_object(
    'id',id,'eventId',event_id,'title',title,'hostName',host_name,'recipientName',coalesce(recipient_name,'Former player'),
    'recipientCharacterId',recipient_character_id,'venue',venue_name,'startsAt',starts_at,'endsAt',ends_at,'status',status,
    'phase',phase,'isGuest',is_guest,'canRespond',recipient_user_id=uid and status='pending' and phase in('scheduled','live') and eligible_response
  ) order by id) from page),'[]'::jsonb),
  'nextCursor',case when (select count(*) from eligible)>p_limit then (select id from page order by id desc limit 1) else null end) into result;
  return result;
end $$;
revoke all on function public.party_invitation_action(text,uuid,uuid,uuid,uuid,text),public.get_party_invitations(uuid,uuid,integer) from public,anon;
grant execute on function public.party_invitation_action(text,uuid,uuid,uuid,uuid,text),public.get_party_invitations(uuid,uuid,integer) to authenticated;
commit;

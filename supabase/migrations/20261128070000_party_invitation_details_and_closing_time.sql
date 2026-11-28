-- DRAFT, not applied. Needs explicit approval before it runs on the live project.
-- 1. get_party_invitations also returns the event type and the Aso Ebi colour.
-- 2. host_party_event takes an optional closing time (p_ends_at). When it is
--    not given, the event closes three hours after it starts, as now.

create or replace function public.get_party_invitations(p_event_id uuid default null,p_after uuid default null,p_limit integer default 20)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=auth.uid(); stamp timestamptz:=statement_timestamp(); result jsonb;
begin
  if uid is null or not exists(select 1 from auth.users u where u.id=uid and not coalesce(u.is_anonymous,false)) then raise exception 'REGISTERED_ACCOUNT_REQUIRED'; end if;
  if not exists(select 1 from public.characters where user_id=uid) then raise exception 'CHARACTER_REQUIRED'; end if;
  if p_limit is null or p_limit not between 1 and 50 then raise exception 'INVALID_PAGE_LIMIT'; end if;
  if p_event_id is not null and not exists(select 1 from public.party_events e join public.characters h on h.id=e.host_character_id and h.user_id=e.user_id where e.id=p_event_id and e.user_id=uid) then raise exception 'INVITATION_UNAVAILABLE'; end if;
  with eligible as (
    select i.*,e.title,e.starts_at,e.ends_at,e.location_id,e.event_type,e.aso_ebi_colour,l.name as venue_name,h.name as host_name,
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
    'phase',phase,'isGuest',is_guest,'eventType',event_type,'asoEbiColour',aso_ebi_colour,
    'canRespond',recipient_user_id=uid and status='pending' and phase in('scheduled','live') and eligible_response
  ) order by id) from page),'[]'::jsonb),
  'nextCursor',case when (select count(*) from eligible)>p_limit then (select id from page order by id desc limit 1) else null end) into result;
  return result;
end $$;

-- Closing time: the optional p_ends_at. Limits (the closing time must be after
-- the start and at most 8 hours after it) are a proposal, not yet agreed.
drop function if exists public.host_party_event(uuid, text, timestamptz, jsonb, uuid, text, text);

create or replace function public.host_party_event(
  p_location_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_requirements jsonb,
  p_request_id uuid,
  p_event_type text default 'owambe_party',
  p_aso_ebi_colour text default null,
  p_ends_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid:=public._my_character_id(); c public.characters%rowtype;
  e public.party_events%rowtype; req jsonb; result jsonb; req_count integer; closes timestamptz;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'Request ID is required'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select er.result into result from public.economy_request_results er
    where er.character_id=cid and er.request_id=p_request_id and er.operation='party_host_event';
  if found then return result; end if;
  select * into c from public.characters where id=cid and user_id=uid for update;
  if not found then raise exception 'Character not found'; end if;
  if not public._party_is_venue(p_location_id,'event_center') then raise exception 'Choose an event center to host at'; end if;
  if char_length(coalesce(p_title,'')) not between 3 and 60 then raise exception 'Give the event a title of 3 to 60 characters'; end if;
  if p_event_type not in ('owambe_party','naming_ceremony','traditional_wedding','chieftaincy_coronation','osun_festival') then
    raise exception 'Choose an event type from the list';
  end if;
  if p_aso_ebi_colour is not null and char_length(trim(p_aso_ebi_colour)) not between 2 and 40 then
    raise exception 'Aso Ebi colour must be 2 to 40 characters';
  end if;
  if p_starts_at is null or p_starts_at<=now() or p_starts_at>now()+interval '24 hours' then
    raise exception 'Events must start within the next 24 hours';
  end if;
  closes:=coalesce(p_ends_at,p_starts_at+interval '3 hours');
  if closes<=p_starts_at or closes>p_starts_at+interval '8 hours' then
    raise exception 'The closing time must be after the start and at most 8 hours later';
  end if;
  if jsonb_typeof(p_requirements)<>'array' then raise exception 'Requirements must be a list'; end if;
  req_count:=jsonb_array_length(p_requirements);
  if req_count<1 or req_count>5 then raise exception 'Add between 1 and 5 requirements'; end if;
  insert into public.party_events(user_id,host_character_id,location_id,title,starts_at,ends_at,event_type,aso_ebi_colour)
    values(uid,cid,p_location_id,trim(p_title),p_starts_at,closes,p_event_type,nullif(trim(coalesce(p_aso_ebi_colour,'')),''))
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
  result:=jsonb_build_object('event_id',e.id,'starts_at',e.starts_at,'ends_at',e.ends_at,'event_type',e.event_type,'aso_ebi_colour',e.aso_ebi_colour);
  insert into public.economy_request_results(character_id,request_id,operation,result)
    values(cid,p_request_id,'party_host_event',result);
  return result;
end $$;

grant execute on function public.host_party_event(uuid, text, timestamptz, jsonb, uuid, text, text, timestamptz) to authenticated;

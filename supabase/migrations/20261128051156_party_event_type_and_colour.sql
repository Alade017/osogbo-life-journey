-- Party events: event type and the Aso Ebi colour for the whole event.
alter table public.party_events
  add column if not exists event_type text not null default 'owambe_party'
    check (event_type in (
      'owambe_party', 'naming_ceremony', 'traditional_wedding',
      'chieftaincy_coronation', 'osun_festival'
    )),
  add column if not exists aso_ebi_colour text
    check (aso_ebi_colour is null or char_length(aso_ebi_colour) between 2 and 40);

drop function if exists public.host_party_event(uuid, text, timestamptz, jsonb, uuid);

create or replace function public.host_party_event(
  p_location_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_requirements jsonb,
  p_request_id uuid,
  p_event_type text default 'owambe_party',
  p_aso_ebi_colour text default null
)
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
  if jsonb_typeof(p_requirements)<>'array' then raise exception 'Requirements must be a list'; end if;
  req_count:=jsonb_array_length(p_requirements);
  if req_count<1 or req_count>5 then raise exception 'Add between 1 and 5 requirements'; end if;
  insert into public.party_events(user_id,host_character_id,location_id,title,starts_at,ends_at,event_type,aso_ebi_colour)
    values(uid,cid,p_location_id,trim(p_title),p_starts_at,p_starts_at+interval '3 hours',p_event_type,nullif(trim(coalesce(p_aso_ebi_colour,'')),''))
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

grant execute on function public.host_party_event(uuid, text, timestamptz, jsonb, uuid, text, text) to authenticated;

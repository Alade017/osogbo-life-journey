-- Phase 7.1b: data-driven club opening hours and server-authoritative entry.
-- Club visits already admitted are intentionally not terminated at closing time.

alter table public.party_venues
  add column if not exists opening_hour smallint,
  add column if not exists closing_hour smallint;

update public.party_venues
set opening_hour = 18,
    closing_hour = 3
where venue_kind = 'club';

alter table public.party_venues
  drop constraint if exists party_venues_schedule_check;

alter table public.party_venues
  add constraint party_venues_schedule_check
  check (
    (
      venue_kind = 'club'
      and opening_hour between 0 and 23
      and closing_hour between 0 and 23
      and opening_hour <> closing_hour
    )
    or (
      venue_kind = 'event_center'
      and opening_hour is null
      and closing_hour is null
    )
  );

comment on column public.party_venues.opening_hour is
  'Club opening hour in Africa/Lagos shared world time; inclusive, 0-23.';
comment on column public.party_venues.closing_hour is
  'Club closing hour in Africa/Lagos shared world time; exclusive, 0-23. Supports overnight schedules.';

create or replace function public.enter_club(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  c public.characters%rowtype;
  v public.club_visits%rowtype;
  result jsonb;
  clock_snapshot jsonb;
  current_minute integer;
  opening_minute integer;
  closing_minute integer;
  club_opening_hour integer;
  club_closing_hour integer;
  is_open boolean;
begin
  if uid is null or cid is null then
    raise exception 'Sign in and create a character first';
  end if;
  if p_request_id is null then
    raise exception 'Request ID is required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(cid::text || p_request_id::text, 0));

  -- Successful request replays remain valid after the club closes.
  select er.result into result
  from public.economy_request_results er
  where er.character_id = cid
    and er.request_id = p_request_id
    and er.operation = 'party_enter_club';
  if found then
    return result;
  end if;

  select * into c
  from public.characters
  where id = cid and user_id = uid
  for update;
  if not found then
    raise exception 'Character not found';
  end if;

  if not public._party_is_venue(c.current_location_id, 'club') then
    raise exception 'Travel to a club to join the party';
  end if;

  v := public._party_active_visit(cid);

  if v.id is not null and v.location_id = c.current_location_id then
    -- Existing admitted visitors may continue until they leave or their
    -- normal two-hour visit expires, even after the venue closes.
    null;
  elsif v.id is not null then
    raise exception 'Leave your current club before joining another';
  else
    select pv.opening_hour, pv.closing_hour
      into club_opening_hour, club_closing_hour
    from public.party_venues pv
    where pv.location_id = c.current_location_id
      and pv.venue_kind = 'club'
      and pv.is_active;

    if club_opening_hour is null or club_closing_hour is null then
      raise exception 'Club hours are not configured';
    end if;

    clock_snapshot := public.world_clock();
    current_minute :=
      (clock_snapshot ->> 'hour')::integer * 60
      + (clock_snapshot ->> 'minute')::integer;
    opening_minute := club_opening_hour * 60;
    closing_minute := club_closing_hour * 60;

    if opening_minute < closing_minute then
      is_open := current_minute >= opening_minute and current_minute < closing_minute;
    else
      -- Overnight schedule, e.g. 18:00 inclusive through 03:00 exclusive.
      is_open := current_minute >= opening_minute or current_minute < closing_minute;
    end if;

    if not is_open then
      raise exception 'This club is closed. It opens at %:00 WAT',
        lpad(club_opening_hour::text, 2, '0');
    end if;

    insert into public.club_visits(user_id, character_id, location_id)
    values(uid, cid, c.current_location_id)
    returning * into v;
  end if;

  result := jsonb_build_object(
    'visit_id', v.id,
    'location_id', v.location_id,
    'expires_at', v.expires_at
  );
  insert into public.economy_request_results(character_id, request_id, operation, result)
  values(cid, p_request_id, 'party_enter_club', result);

  return result;
end
$$;

grant execute on function public.enter_club(uuid) to authenticated;

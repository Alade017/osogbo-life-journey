-- Fictional clinic visit flow. No health, economy, diagnosis or reward changes.
create table public.clinic_visits (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 character_id uuid not null references public.characters(id) on delete cascade,
 location_id uuid not null references public.locations(id),
 status text not null check(status in ('waiting','examination','discharged','cancelled')),
 checked_in_at timestamptz not null default now(),
 exam_started_at timestamptz,
 finished_at timestamptz
);
create unique index clinic_one_active_visit on public.clinic_visits(character_id) where status in ('waiting','examination');
create unique index clinic_one_exam_station on public.clinic_visits(location_id) where status='examination';
create index clinic_wait_order on public.clinic_visits(location_id,checked_in_at,id) where status='waiting';
alter table public.clinic_visits enable row level security;
create policy clinic_read_own on public.clinic_visits for select to authenticated using(user_id=auth.uid());
revoke all on public.clinic_visits from public, anon, authenticated;
grant select on public.clinic_visits to authenticated;

create function public.clinic_visit_command(p_command text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 uid uuid:=auth.uid(); cid uuid; lid uuid; venue text; visit public.clinic_visits%rowtype;
 queued_id uuid; position_in_queue integer:=0; stamp timestamptz:=clock_timestamp();
begin
 if uid is null then raise exception 'Sign in to use the clinic'; end if;
 if p_command is null or p_command not in ('status','check_in','new_visit','cancel') then raise exception 'Unknown clinic command'; end if;
 select id,current_location_id into cid,lid from public.characters where user_id=uid for update;
 if cid is null then raise exception 'Character not found'; end if;
 select slug into venue from public.locations where id=lid and is_active;
 if venue is distinct from 'community-clinic' then raise exception 'Travel to Community Clinic first'; end if;
 perform pg_advisory_xact_lock(hashtextextended('clinic:'||lid::text,0));
 -- Readers reconcile absent visitors too, preventing abandoned reservations from blocking the station.
 update public.clinic_visits v set status='cancelled',finished_at=stamp
 where v.location_id=lid and v.status in ('waiting','examination')
 and (v.checked_in_at<stamp-interval '15 minutes' or not exists(select 1 from public.characters c where c.id=v.character_id and c.current_location_id=lid));
 update public.clinic_visits set status='discharged',finished_at=stamp
 where location_id=lid and status='examination' and exam_started_at<=stamp-interval '20 seconds';
 select * into visit from public.clinic_visits where character_id=cid order by checked_in_at desc,id desc limit 1;
 if p_command in ('check_in','new_visit') and (visit.id is null or visit.status in ('discharged','cancelled')) then
  -- Check-in retries preserve a completed visit. A new visit requires an explicit command.
  if visit.id is null or p_command='new_visit' then
   insert into public.clinic_visits(user_id,character_id,location_id,status) values(uid,cid,lid,'waiting') returning * into visit;
  end if;
 end if;
 if p_command='cancel' then
  update public.clinic_visits set status='cancelled',finished_at=stamp where character_id=cid and status in ('waiting','examination');
 end if;
 if not exists(select 1 from public.clinic_visits where location_id=lid and status='examination') then
  select id into queued_id from public.clinic_visits where location_id=lid and status='waiting' order by checked_in_at,id limit 1 for update;
  if queued_id is not null then update public.clinic_visits set status='examination',exam_started_at=stamp where id=queued_id; end if;
 end if;
 select * into visit from public.clinic_visits where character_id=cid order by checked_in_at desc,id desc limit 1;
 if visit.status='waiting' then select count(*)::integer into position_in_queue from public.clinic_visits where location_id=lid and status='waiting' and (checked_in_at,id)<=(visit.checked_in_at,visit.id); end if;
 return jsonb_build_object('id',visit.id,'status',coalesce(visit.status,'not_checked_in'),'queuePosition',position_in_queue,
 'examEndsAt',case when visit.status='examination' then visit.exam_started_at+interval '20 seconds' else null end);
end $$;
revoke all on function public.clinic_visit_command(text) from public,anon;
grant execute on function public.clinic_visit_command(text) to authenticated;
notify pgrst,'reload schema';

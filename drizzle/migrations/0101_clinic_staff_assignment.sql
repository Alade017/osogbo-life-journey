-- Server-owned clinic roster; no hiring, treatment, health or currency effects.
create table public.clinic_staff_assignments(
 location_id uuid not null references public.locations(id),
 station text not null check(station='examination'),
 npc_id text not null unique references public.npc_definitions(id),
 shift_start integer not null check(shift_start between 0 and 23),
 shift_end integer not null check(shift_end between 0 and 23),
 enabled boolean not null default true,
 primary key(location_id,station),check(shift_start<>shift_end)
);
alter table public.clinic_staff_assignments enable row level security;
revoke all on public.clinic_staff_assignments from public,anon,authenticated;
-- Reuse configured clinic workers and their existing work shifts. Never invent staff in the UI.
-- If no eligible roster exists, the clinic correctly reports that new visits are unavailable.
insert into public.clinic_staff_assignments(location_id,station,npc_id,shift_start,shift_end)
select distinct on (l.id) l.id,'examination',n.id,h.start_hour,h.end_hour
from public.locations l
join public.npc_definitions n on n.work_location_id=l.id
cross join lateral jsonb_array_elements(case when jsonb_typeof(n.routine)='array' then n.routine else '[]'::jsonb end) r
cross join lateral (select
 case when (r->>'start') ~ '^[0-9]{1,2}$' then (r->>'start')::integer end as start_hour,
 case when (r->>'end') ~ '^[0-9]{1,2}$' then (r->>'end')::integer end as end_hour
) h
where l.slug='community-clinic' and l.is_active and r->>'place'='work'
and h.start_hour between 0 and 23 and h.end_hour between 0 and 23 and h.start_hour<>h.end_hour
order by l.id,n.id,h.start_hour;
alter table public.clinic_visits add column assigned_staff_id text references public.npc_definitions(id);
update public.clinic_visits v set assigned_staff_id=s.npc_id from public.clinic_staff_assignments s
where v.location_id=s.location_id and v.status='examination' and v.assigned_staff_id is null;
create unique index clinic_staff_one_active_exam on public.clinic_visits(assigned_staff_id) where status='examination' and assigned_staff_id is not null;

create or replace function public.clinic_visit_command(p_command text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 uid uuid:=auth.uid(); cid uuid; lid uuid; venue text; visit public.clinic_visits%rowtype;
 staff_id text; duty_hour integer; staff_available boolean;
 queued_id uuid; position_in_queue integer:=0; stamp timestamptz:=clock_timestamp();
begin
 if uid is null then raise exception 'Sign in to use the clinic'; end if;
 if p_command is null or p_command not in ('status','check_in','new_visit','cancel') then raise exception 'Unknown clinic command'; end if;
 select id,current_location_id into cid,lid from public.characters where user_id=uid for update;
 if cid is null then raise exception 'Character not found'; end if;
 select slug into venue from public.locations where id=lid and is_active;
 if venue is distinct from 'community-clinic' then raise exception 'Travel to Community Clinic first'; end if;
 perform pg_advisory_xact_lock(hashtextextended('clinic:'||lid::text,0));
 duty_hour := (public.world_clock()->>'hour')::integer;
 select s.npc_id into staff_id from public.clinic_staff_assignments s
 join public.npc_definitions n on n.id=s.npc_id and n.work_location_id=s.location_id
 where s.location_id=lid and s.station='examination' and s.enabled
 and case when s.shift_start<s.shift_end then duty_hour>=s.shift_start and duty_hour<s.shift_end
 else duty_hour>=s.shift_start or duty_hour<s.shift_end end;
 staff_available := staff_id is not null;
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
   if not staff_available then raise exception 'Clinic staff are off duty'; end if;
   insert into public.clinic_visits(user_id,character_id,location_id,status) values(uid,cid,lid,'waiting') returning * into visit;
  end if;
 end if;
 if p_command='cancel' then
  update public.clinic_visits set status='cancelled',finished_at=stamp where character_id=cid and status in ('waiting','examination');
 end if;
 if staff_available and not exists(select 1 from public.clinic_visits where assigned_staff_id=staff_id and status='examination') and not exists(select 1 from public.clinic_visits where location_id=lid and status='examination') then
  select id into queued_id from public.clinic_visits where location_id=lid and status='waiting' order by checked_in_at,id limit 1 for update;
  if queued_id is not null then update public.clinic_visits set status='examination',exam_started_at=stamp,assigned_staff_id=staff_id where id=queued_id; end if;
 end if;
 select * into visit from public.clinic_visits where character_id=cid order by checked_in_at desc,id desc limit 1;
 if visit.status='waiting' then select count(*)::integer into position_in_queue from public.clinic_visits where location_id=lid and status='waiting' and (checked_in_at,id)<=(visit.checked_in_at,visit.id); end if;
 return jsonb_build_object('id',visit.id,'status',coalesce(visit.status,'not_checked_in'),'queuePosition',position_in_queue,
 'staffAvailable',staff_available,
 'staff',(select jsonb_build_object('id',n.id,'name',n.name,'role',n.role,'onDuty',staff_available,'shiftStart',s.shift_start,'shiftEnd',s.shift_end) from public.clinic_staff_assignments s join public.npc_definitions n on n.id=s.npc_id where s.location_id=lid and s.station='examination'),
 'assignedStaff',(select jsonb_build_object('id',n.id,'name',n.name,'role',n.role) from public.npc_definitions n where n.id=visit.assigned_staff_id),
 'examEndsAt',case when visit.status='examination' then visit.exam_started_at+interval '20 seconds' else null end);
end $$;
revoke all on function public.clinic_visit_command(text) from public,anon;
grant execute on function public.clinic_visit_command(text) to authenticated;
notify pgrst,'reload schema';

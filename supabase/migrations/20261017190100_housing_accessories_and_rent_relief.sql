-- Automatic move-in accessories and rent-relief side hustles.
-- Side hustles deliberately do not use character_jobs, which remains the one-main-job system.

alter table public.house_types
  add column if not exists starter_accessories jsonb not null default '{}'::jsonb
  check (jsonb_typeof(starter_accessories) = 'object');

create table if not exists public.player_home_accessory_sets (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  player_property_id uuid not null references public.player_properties(id) on delete cascade,
  budget_minor bigint not null check (budget_minor >= 0),
  band text not null check (band in ('basic','comfortable','premium')),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  created_at timestamptz not null default now(),
  unique (player_property_id)
);
alter table public.player_home_accessory_sets enable row level security;
revoke all on public.player_home_accessory_sets from anon, authenticated;
grant all on public.player_home_accessory_sets to service_role;
create policy player_home_accessory_sets_read on public.player_home_accessory_sets
  for select to authenticated using (character_id = public._my_character_id());

create table if not exists public.player_side_hustles (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  rent_cycle_id uuid not null references public.property_rent_cycles(id) on delete cascade,
  title text not null default 'Rent relief shift',
  shift_pay_minor bigint not null check (shift_pay_minor > 0),
  shifts_total smallint not null default 3 check (shifts_total between 1 and 3),
  shifts_completed smallint not null default 0 check (shifts_completed between 0 and 3),
  next_shift_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','completed','dropped')),
  created_at timestamptz not null default now(),
  dropped_at timestamptz,
  unique (character_id, rent_cycle_id, title)
);
create index if not exists player_side_hustles_active_idx on public.player_side_hustles(character_id,next_shift_at) where status='active';
alter table public.player_side_hustles enable row level security;
revoke all on public.player_side_hustles from anon, authenticated;
grant all on public.player_side_hustles to service_role;
create policy player_side_hustles_read on public.player_side_hustles
  for select to authenticated using (character_id = public._my_character_id());

create or replace function public._housing_accessory_band(p_budget_minor bigint)
returns text language sql immutable as $$
  select case when p_budget_minor >= 20000 then 'premium' when p_budget_minor >= 5000 then 'comfortable' else 'basic' end;
$$;
revoke all on function public._housing_accessory_band(bigint) from public, anon, authenticated;

create or replace function public.apply_rent_relief_hustle(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); cycle public.property_rent_cycles%rowtype; result jsonb; hustle public.player_side_hustles%rowtype;
begin
  if cid is null or p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select result into result from public.economy_request_results where character_id=cid and request_id=p_request_id and operation='rent_relief_apply';
  if found then return result; end if;
  select * into cycle from public.property_rent_cycles where character_id=cid and status='grace' and now()<grace_ends_at order by due_at limit 1 for update;
  if not found then raise exception 'RENT_RELIEF_UNAVAILABLE'; end if;
  insert into public.player_side_hustles(character_id,rent_cycle_id,shift_pay_minor,next_shift_at)
    values(cid,cycle.id,ceil(cycle.amount_minor/3.0)::bigint,now())
    on conflict(character_id,rent_cycle_id,title) do update set status='active',dropped_at=null
    returning * into hustle;
  result:=jsonb_build_object('id',hustle.id,'shiftPayMinor',hustle.shift_pay_minor,'nextShiftAt',hustle.next_shift_at,'status',hustle.status);
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'rent_relief_apply',result);
  return result;
end $$;
revoke all on function public.apply_rent_relief_hustle(uuid) from public,anon,authenticated;
grant execute on function public.apply_rent_relief_hustle(uuid) to service_role;

create or replace function public.drop_side_hustle(p_hustle_id uuid,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare cid uuid:=public._my_character_id(); hustle public.player_side_hustles%rowtype; result jsonb;
begin
  if cid is null or p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  perform pg_advisory_xact_lock(hashtextextended(cid::text||p_request_id::text,0));
  select result into result from public.economy_request_results where character_id=cid and request_id=p_request_id and operation='rent_relief_drop';
  if found then return result; end if;
  update public.player_side_hustles set status='dropped',dropped_at=now() where id=p_hustle_id and character_id=cid and status='active' returning * into hustle;
  if not found then raise exception 'SIDE_HUSTLE_NOT_ACTIVE'; end if;
  result:=jsonb_build_object('id',hustle.id,'status','dropped');
  insert into public.economy_request_results(character_id,request_id,operation,result) values(cid,p_request_id,'rent_relief_drop',result);
  return result;
end $$;
revoke all on function public.drop_side_hustle(uuid,uuid) from public,anon,authenticated;
grant execute on function public.drop_side_hustle(uuid,uuid) to service_role;

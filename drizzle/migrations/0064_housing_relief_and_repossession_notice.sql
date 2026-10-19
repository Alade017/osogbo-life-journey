-- Keep repossession visible until the affected player acknowledges it.
alter table public.property_rent_cycles
  add column if not exists repossessed_at timestamptz,
  add column if not exists notice_acknowledged_at timestamptz;

create or replace function public._stamp_property_repossession()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'repossessed' and old.status is distinct from 'repossessed' then
    new.repossessed_at := now();
  end if;
  return new;
end $$;
revoke all on function public._stamp_property_repossession() from public, anon, authenticated;
drop trigger if exists stamp_property_repossession on public.property_rent_cycles;
create trigger stamp_property_repossession
  before update of status on public.property_rent_cycles for each row
  execute function public._stamp_property_repossession();

update public.property_rent_cycles
set repossessed_at = rescue_ends_at
where status = 'repossessed' and repossessed_at is null;

create index if not exists property_rent_cycles_unseen_repossession_idx
  on public.property_rent_cycles(character_id, repossessed_at desc)
  where status = 'repossessed' and notice_acknowledged_at is null;

-- A keep choice records intent; it does not change wages, rent, or job status.
alter table public.player_side_hustles
  add column if not exists keep_confirmed_at timestamptz;

create or replace function public.confirm_rent_relief_hustle(
  p_user_id uuid, p_hustle_id uuid, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_character_id uuid; v_hustle public.player_side_hustles%rowtype;
  v_result jsonb; v_operation text; v_cycle_status text;
begin
  if p_hustle_id is null or p_request_id is null then raise exception 'INVALID_REQUEST'; end if;
  select id into v_character_id from public.characters where user_id = p_user_id;
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_character_id::text || p_request_id::text, 0));
  select operation, result into v_operation, v_result
    from public.economy_request_results
    where character_id = v_character_id and request_id = p_request_id;
  if found then
    if v_operation <> 'rent_relief_keep' or v_result->>'id' <> p_hustle_id::text
      then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return v_result;
  end if;
  select * into v_hustle from public.player_side_hustles
    where id = p_hustle_id and character_id = v_character_id and status = 'active' for update;
  if not found then raise exception 'SIDE_HUSTLE_NOT_ACTIVE'; end if;
  select status into v_cycle_status from public.property_rent_cycles where id = v_hustle.rent_cycle_id;
  if v_cycle_status <> 'paid' then raise exception 'RENT_NOT_PAID'; end if;
  update public.player_side_hustles
    set keep_confirmed_at = coalesce(keep_confirmed_at, now())
    where id = v_hustle.id returning * into v_hustle;
  v_result := jsonb_build_object('id', v_hustle.id,
    'status', v_hustle.status, 'keepConfirmedAt', v_hustle.keep_confirmed_at);
  insert into public.economy_request_results(character_id, request_id, operation, result)
    values(v_character_id, p_request_id, 'rent_relief_keep', v_result);
  return v_result;
end $$;
revoke all on function public.confirm_rent_relief_hustle(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_rent_relief_hustle(uuid,uuid,uuid) to service_role;

create or replace function public.housing_relief_state(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_character_id uuid; v_notice jsonb; v_hustles jsonb;
  v_loan_offer jsonb; v_job_offer jsonb; v_cycle public.property_rent_cycles%rowtype;
begin
  select id into v_character_id from public.characters where user_id = p_user_id;
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  perform public._advance_property_rent_cycles();

  select jsonb_build_object(
    'cycleId', rent.id, 'houseName', listing.name,
    'repossessedAt', coalesce(rent.repossessed_at, rent.rescue_ends_at)
  ) into v_notice
  from public.property_rent_cycles rent
  join public.player_properties tenancy on tenancy.id = rent.player_property_id
  join public.game_properties listing on listing.id = tenancy.property_id
  where rent.character_id = v_character_id and rent.status = 'repossessed'
    and rent.notice_acknowledged_at is null
  order by rent.repossessed_at desc nulls last, rent.rescue_ends_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', hustle.id, 'title', hustle.title,
    'shiftPayMinor', hustle.shift_pay_minor,
    'shiftsTotal', hustle.shifts_total,
    'shiftsCompleted', hustle.shifts_completed,
    'nextShiftAt', hustle.next_shift_at,
    'canWorkNow', hustle.next_shift_at <= now(),
    'rentPaid', rent.status = 'paid',
    'keepConfirmedAt', hustle.keep_confirmed_at
  ) order by hustle.created_at desc), '[]'::jsonb) into v_hustles
  from public.player_side_hustles hustle
  join public.property_rent_cycles rent on rent.id = hustle.rent_cycle_id
  where hustle.character_id = v_character_id and hustle.status = 'active';

  select * into v_cycle from public.property_rent_cycles
    where character_id = v_character_id and status = 'rescue'
      and now() < rescue_ends_at
    order by due_at desc limit 1;
  if found then
    if not exists (select 1 from public.property_rent_rescue_loans loan
      where loan.character_id = v_character_id and loan.status = 'open') then
      v_loan_offer := jsonb_build_object(
        'principalMinor', v_cycle.amount_minor,
        'instalmentMinor', ceil(v_cycle.amount_minor / 4.0)::bigint,
        'instalmentsTotal', 4
      );
    end if;
    if not exists (select 1 from public.player_side_hustles hustle
      where hustle.rent_cycle_id = v_cycle.id and hustle.character_id = v_character_id
        and hustle.status = 'active') then
      v_job_offer := jsonb_build_object(
        'shiftPayMinor', ceil(v_cycle.amount_minor / 3.0)::bigint,
        'shiftsTotal', 3
      );
    end if;
  end if;
  return jsonb_build_object('notice', v_notice, 'hustles', v_hustles,
    'loanOffer', v_loan_offer, 'jobOffer', v_job_offer);
end $$;
revoke all on function public.housing_relief_state(uuid) from public, anon, authenticated;
grant execute on function public.housing_relief_state(uuid) to service_role;

create or replace function public.ack_housing_repossession(
  p_user_id uuid, p_cycle_id uuid
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_character_id uuid; v_cycle_id uuid;
begin
  if p_cycle_id is null then raise exception 'INVALID_REQUEST'; end if;
  select id into v_character_id from public.characters where user_id = p_user_id;
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  update public.property_rent_cycles
    set notice_acknowledged_at = coalesce(notice_acknowledged_at, now())
    where id = p_cycle_id and character_id = v_character_id and status = 'repossessed'
    returning id into v_cycle_id;
  if v_cycle_id is null then raise exception 'REPOSSESSION_NOTICE_NOT_FOUND'; end if;
  return jsonb_build_object('acknowledged', true, 'cycleId', v_cycle_id);
end $$;
revoke all on function public.ack_housing_repossession(uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.ack_housing_repossession(uuid,uuid) to service_role;

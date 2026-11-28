-- Retire the legacy property rent ledger and the tenancy-level due date.
-- property_rent_cycles is the rent source of truth. player_houses keeps the
-- due date that get_house_state and the house screen read.

-- 1. Archive the ledger rows (no client access) before removing the table.
create table public.property_rent_ledger_archive as
  select * from public.property_rent_ledger;

alter table public.property_rent_ledger_archive enable row level security;
revoke all on public.property_rent_ledger_archive from anon, authenticated;

do $$
begin
  if (select count(*) from public.property_rent_ledger_archive)
     <> (select count(*) from public.property_rent_ledger) then
    raise exception 'LEDGER_ARCHIVE_MISMATCH';
  end if;
end $$;

-- 2. Stop writing the tenancy due date. This trigger was its only writer.
create or replace function public._initialize_property_rent()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare listing public.game_properties%rowtype;
begin
  select * into listing from public.game_properties where id = new.property_id;
  new.housing_kind := case
    when listing.house_type_id is not null then 'home'
    when listing.property_type = 'market_stall' then 'stall'
    else 'other' end;
  if new.tenure = 'rented' then
    new.rent_amount := listing.rent_price;
    new.rent_period_days := listing.rent_period_days;
  else
    new.rent_amount := null;
    new.rent_period_days := null;
  end if;
  return new;
end $function$;

-- 3. Remove the legacy readers, the ledger, and the tenancy due date.
drop function if exists public.my_property_rent_status();
drop function if exists public.property_rent_status();
drop table public.property_rent_ledger;
alter table public.player_properties drop column next_rent_due_at;

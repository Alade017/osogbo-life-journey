-- Enforce age-restricted destinations at the database boundary, including RPC actions.
create or replace function public._assert_map_destination_age(p_character_id uuid, p_location_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  player_age integer;
  place_metadata jsonb;
begin
  if p_location_id is null then return; end if;
  select age into player_age from public.characters where id = p_character_id;
  select coalesce(metadata, '{}'::jsonb) into place_metadata
    from public.locations where id = p_location_id and is_active;
  if not found then return; end if;
  if (coalesce(place_metadata ->> 'min_age', '0') ~ '^[0-9]+$'
      and (place_metadata ->> 'min_age')::integer >= 18
      or coalesce(place_metadata -> 'flags', '[]'::jsonb) ? '18+')
     and coalesce(player_age, 0) < 18 then
    raise exception 'This place is for players 18 and over.' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._guard_map_destination_age()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.current_location_id is distinct from old.current_location_id then
    perform public._assert_map_destination_age(new.id, new.current_location_id);
  end if;
  return new;
end;
$$;

drop trigger if exists characters_map_destination_age on public.characters;
create trigger characters_map_destination_age
  before update of current_location_id on public.characters
  for each row execute function public._guard_map_destination_age();

create or replace function public._guard_job_destination_age()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  destination_id uuid;
begin
  if new.is_current then
    select location_id into destination_id from public.jobs where id = new.job_id and is_available;
    if destination_id is not null then
      perform public._assert_map_destination_age(new.character_id, destination_id);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists character_jobs_map_destination_age on public.character_jobs;
create trigger character_jobs_map_destination_age
  before insert or update on public.character_jobs
  for each row execute function public._guard_job_destination_age();

revoke all on function public._assert_map_destination_age(uuid, uuid) from public, anon, authenticated;
revoke all on function public._guard_map_destination_age() from public, anon, authenticated;
revoke all on function public._guard_job_destination_age() from public, anon, authenticated;

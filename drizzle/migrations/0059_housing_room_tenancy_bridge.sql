-- A canonical housing rental also needs a legacy room row until furniture
-- placement and outfit RPCs are moved to player_properties. No charge occurs here.
create or replace function public._mirror_housing_tenancy_to_room()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_house_type_id text;
begin
  if not new.is_active or new.tenure <> 'rented' then return new; end if;
  select listing.house_type_id into v_house_type_id
    from public.game_properties listing
    where listing.id = new.property_id
      and listing.slug = 'housing-' || listing.house_type_id;
  if v_house_type_id is null then return new; end if;
  insert into public.player_houses(player_id, house_type_id, rented_at, next_rent_due_at, status)
    select new.user_id, v_house_type_id, now(),
      coalesce(new.lease_ends_at, now() + interval '7 days'), 'active'
    where not exists (
      select 1 from public.player_houses existing
      where existing.player_id = new.user_id and existing.status in ('active', 'overdue')
    );
  insert into public.player_homes(user_id, character_id, house_type_id, moved_in_at, next_rent_at)
    values(new.user_id, new.character_id, v_house_type_id, now(),
      coalesce(new.lease_ends_at, now() + interval '7 days'))
    on conflict (character_id) do nothing;
  return new;
end $$;
revoke all on function public._mirror_housing_tenancy_to_room() from public, anon, authenticated;
drop trigger if exists mirror_housing_tenancy_to_room on public.player_properties;
create trigger mirror_housing_tenancy_to_room
  after insert on public.player_properties for each row
  execute function public._mirror_housing_tenancy_to_room();

-- Existing rentals created before this migration gain the same furniture view.
insert into public.player_houses(player_id, house_type_id, rented_at, next_rent_due_at, status)
select tenancy.user_id, listing.house_type_id, tenancy.acquired_at,
  coalesce(tenancy.lease_ends_at, now() + interval '7 days'), 'active'
from public.player_properties tenancy
join public.game_properties listing on listing.id = tenancy.property_id
  and listing.slug = 'housing-' || listing.house_type_id
where tenancy.is_active and tenancy.tenure = 'rented'
  and not exists (
    select 1 from public.player_houses existing
    where existing.player_id = tenancy.user_id and existing.status in ('active', 'overdue')
  );

insert into public.player_homes(user_id, character_id, house_type_id, moved_in_at, next_rent_at)
select tenancy.user_id, tenancy.character_id, listing.house_type_id,
  tenancy.acquired_at, coalesce(tenancy.lease_ends_at, now() + interval '7 days')
from public.player_properties tenancy
join public.game_properties listing on listing.id = tenancy.property_id
  and listing.slug = 'housing-' || listing.house_type_id
where tenancy.is_active and tenancy.tenure = 'rented'
on conflict (character_id) do nothing;

-- Ending a room in the established house screen also ends its canonical lease.
create or replace function public._end_housing_tenancy_with_room()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'ended' and old.status in ('active', 'overdue') then
    update public.player_properties tenancy
      set is_active = false, updated_at = now()
      from public.game_properties listing
      where tenancy.user_id = new.player_id and tenancy.is_active
        and tenancy.property_id = listing.id
        and listing.slug = 'housing-' || new.house_type_id;
  end if;
  return new;
end $$;
revoke all on function public._end_housing_tenancy_with_room() from public, anon, authenticated;
drop trigger if exists end_housing_tenancy_with_room on public.player_houses;
create trigger end_housing_tenancy_with_room
  after update of status on public.player_houses for each row
  execute function public._end_housing_tenancy_with_room();

-- Service-only read used by the house screen. The rent cycle remains the
-- authority for payment state and dates; the room row supplies furniture.
create or replace function public.housing_current_home(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_character_id uuid; v_result jsonb;
begin
  select id into v_character_id from public.characters where user_id = p_user_id;
  if v_character_id is null then raise exception 'NO_CHARACTER'; end if;
  perform public._advance_property_rent_cycles();
  select jsonb_build_object(
    'propertyId', tenancy.property_id,
    'houseTypeId', house.id,
    'name', house.label,
    'assetKey', house.asset_key,
    'tenure', tenancy.tenure,
    'status', case when tenancy.tenure = 'owned' then 'owned' else cycle.status end,
    'weeklyRentMinor', house.weekly_rent_minor,
    'dueAt', cycle.due_at,
    'graceEndsAt', cycle.grace_ends_at,
    'rescueEndsAt', cycle.rescue_ends_at,
    'accessoryBand', coalesce(accessories.band, 'basic')
  ) into v_result
  from public.player_properties tenancy
  join public.game_properties listing on listing.id = tenancy.property_id
    and listing.slug = 'housing-' || listing.house_type_id
  join public.house_types house on house.id = listing.house_type_id
  left join lateral (
    select current_cycle.status, current_cycle.due_at,
      current_cycle.grace_ends_at, current_cycle.rescue_ends_at
    from public.property_rent_cycles current_cycle
    where current_cycle.player_property_id = tenancy.id
      and current_cycle.status in ('current', 'due', 'grace', 'rescue')
    order by current_cycle.due_at desc limit 1
  ) cycle on true
  left join public.player_home_accessory_sets accessories
    on accessories.player_property_id = tenancy.id
  where tenancy.character_id = v_character_id and tenancy.is_active
  order by tenancy.acquired_at desc limit 1;
  return coalesce(v_result, 'null'::jsonb);
end $$;
revoke all on function public.housing_current_home(uuid) from public, anon, authenticated;
grant execute on function public.housing_current_home(uuid) to service_role;

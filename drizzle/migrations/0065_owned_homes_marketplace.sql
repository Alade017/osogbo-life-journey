-- Keep catalogue, ownership and the selected home in the existing property model.
alter table public.player_properties add column if not exists is_home boolean not null default false;
-- The earlier one-active-property index prevented owning a second house.
drop index if exists public.one_active_home_per_character;
create unique index if not exists one_selected_home_per_character
  on public.player_properties(character_id) where is_active and is_home;
alter table public.player_houses add column if not exists player_property_id uuid
  references public.player_properties(id) on delete set null;
create unique index if not exists player_houses_property_idx
  on public.player_houses(player_property_id) where player_property_id is not null;
alter table public.player_houses drop constraint if exists player_houses_status_check;
alter table public.player_houses add constraint player_houses_status_check
  check (status in ('active','overdue','inactive','ended'));

-- Six established house types keep their listing IDs and all existing tenancies.
update public.game_properties listing set
  purchase_price = house.weekly_rent_minor * 52,
  image_url = '/assets/homes/' || house.asset_key || '.webp',
  metadata = listing.metadata || jsonb_build_object(
    'district', case house.id
      when 'shared-room' then 'Oja-Oba Starter District'
      when 'single-room' then 'Isale-Osun Residential Area'
      when 'studio-flat' then 'Alekuwodo Estate'
      when 'mini-flat' then 'Dada Residential District'
      when 'bungalow' then 'Oke-Fia Premium District'
      else 'Hillcrest Luxury Estate' end,
    'bedrooms', house.bedrooms,
    'features', jsonb_build_array('Furnished interior', jsonb_array_length(house.slots) || ' furniture slots'))
from public.house_types house
where listing.slug = 'housing-' || house.id;

insert into public.game_properties(slug,name,description,property_type,location_id,
  image_url,purchase_price,rent_price,rent_period_days,level_required,house_type_id,metadata)
select 'housing-royal-crown-duplex','Royal Crown Duplex',
  'A spacious duplex in the fictional Royal Crown Estate.', 'house', location.id,
  '/assets/homes/duplex.webp', 2600000, 50000, 7, 0, 'duplex',
  '{"world":"fictional","housing":true,"district":"Royal Crown Estate","bedrooms":4,"features":["Furnished interior","Premium duplex rooms"],"mapPlot":{"x":13,"z":7,"model":"compound"}}'::jsonb
from public.locations location where location.slug = 'residential'
on conflict(slug) do nothing;

-- Older sale listings are still owned by existing players; give their rooms a
-- layout without changing the original listing, price, or ownership record.
update public.game_properties set
  image_url = coalesce(image_url, '/assets/homes/studio-flat.webp'),
  metadata = metadata || '{"district":"Alekuwodo Estate","bedrooms":1,"features":["Furnished interior"]}'::jsonb
where slug = 'garden-court-flat';
update public.game_properties set
  image_url = coalesce(image_url, '/assets/homes/bungalow.webp'),
  metadata = metadata || '{"district":"Oke-Fia Premium District","bedrooms":3,"features":["Furnished interior"]}'::jsonb
where slug = 'family-courtyard-home';

-- A room row is an interior view of a property right, never another purchase.
create or replace function public._activate_property_home(p_property_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare tenancy public.player_properties%rowtype; listing public.game_properties%rowtype;
  room_id uuid; prior_status text;
begin
  select * into tenancy from public.player_properties where id = p_property_id and is_active;
  if not found then raise exception 'HOME_NOT_OWNED'; end if;
  select * into listing from public.game_properties where id = tenancy.property_id;
  if listing.house_type_id is null then raise exception 'NOT_A_HOUSE'; end if;
  update public.player_properties set is_home = false
    where character_id = tenancy.character_id and is_home and id <> tenancy.id;
  update public.player_houses set status = 'inactive'
    where player_id = tenancy.user_id and status in ('active','overdue')
      and player_property_id is distinct from tenancy.id;
  select id, status into room_id, prior_status from public.player_houses
    where player_property_id = tenancy.id limit 1;
  if room_id is null then
    -- Buying the room currently rented keeps its furniture placements.
    select room.id, room.status into room_id, prior_status from public.player_houses room
      join public.player_properties former on former.id = room.player_property_id
      where room.player_id = tenancy.user_id and former.property_id = tenancy.property_id
        and not former.is_active and former.tenure = 'rented'
      order by room.rented_at desc limit 1;
  end if;
  if room_id is null then
    -- The rental bridge may already have created the room before this link was added.
    select id, status into room_id, prior_status from public.player_houses
      where player_id = tenancy.user_id and player_property_id is null
        and house_type_id = listing.house_type_id and status in ('active','overdue','inactive')
      order by rented_at desc limit 1;
  end if;
  if room_id is null then
    insert into public.player_houses(player_id,house_type_id,rented_at,next_rent_due_at,status,player_property_id)
      values(tenancy.user_id,listing.house_type_id,tenancy.acquired_at,
        coalesce(tenancy.lease_ends_at,'infinity'::timestamptz),'active',tenancy.id);
  else
    update public.player_houses set player_property_id = tenancy.id,
      status = case when prior_status = 'overdue' then 'overdue' else 'active' end,
      next_rent_due_at = coalesce(tenancy.lease_ends_at,'infinity'::timestamptz)
      where id = room_id;
  end if;
  update public.player_properties set is_home = true where id = tenancy.id;
  insert into public.player_homes(user_id,character_id,house_type_id,moved_in_at,next_rent_at)
    values(tenancy.user_id,tenancy.character_id,listing.house_type_id,now(),
      coalesce(tenancy.lease_ends_at,'infinity'::timestamptz))
    on conflict(character_id) do update set house_type_id = excluded.house_type_id,
      moved_in_at = excluded.moved_in_at,next_rent_at = excluded.next_rent_at;
end $$;
revoke all on function public._activate_property_home(uuid) from public,anon,authenticated;

create or replace function public.set_active_property_home(p_player_property_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); uid uuid := auth.uid();
  listing_id uuid;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  perform 1 from public.characters where id = cid for update;
  select tenancy.property_id into listing_id from public.player_properties tenancy
    join public.game_properties listing on listing.id = tenancy.property_id
    where tenancy.id = p_player_property_id and tenancy.character_id = cid
      and tenancy.user_id = uid and tenancy.is_active and listing.house_type_id is not null;
  if not found then raise exception 'HOME_NOT_OWNED'; end if;
  perform public._activate_property_home(p_player_property_id);
  return jsonb_build_object('propertyId',listing_id,'playerPropertyId',p_player_property_id);
end $$;
revoke all on function public.set_active_property_home(uuid) from public,anon;
grant execute on function public.set_active_property_home(uuid) to authenticated;

create or replace function public._select_new_property_home()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_active and exists(select 1 from public.game_properties
      where id = new.property_id and house_type_id is not null) then
    perform public._activate_property_home(new.id);
  end if;
  return new;
end $$;
revoke all on function public._select_new_property_home() from public,anon,authenticated;
drop trigger if exists select_new_property_home on public.player_properties;
create trigger select_new_property_home after insert on public.player_properties
  for each row execute function public._select_new_property_home();

create function public._fallback_property_home()
returns trigger language plpgsql security definer set search_path = public as $$
declare replacement_id uuid;
begin
  if old.is_active and old.is_home and not new.is_active then
    select tenancy.id into replacement_id from public.player_properties tenancy
      join public.game_properties listing on listing.id = tenancy.property_id
    where tenancy.character_id = old.character_id and tenancy.is_active
      and listing.house_type_id is not null and tenancy.id <> old.id
    order by tenancy.acquired_at desc limit 1;
    if replacement_id is not null then
      perform public._activate_property_home(replacement_id);
    end if;
  end if;
  return new;
end $$;
revoke all on function public._fallback_property_home() from public,anon,authenticated;
create trigger fallback_property_home after update of is_active on public.player_properties
  for each row execute function public._fallback_property_home();

-- Existing players retain the most recently acquired active house as Home.
do $$ declare home record; begin
  for home in select distinct on (tenancy.character_id) tenancy.id
    from public.player_properties tenancy join public.game_properties listing
      on listing.id = tenancy.property_id and listing.house_type_id is not null
    where tenancy.is_active
    order by tenancy.character_id, tenancy.acquired_at desc, tenancy.id desc
  loop perform public._activate_property_home(home.id); end loop;
end $$;

-- Retain the original secure wallet transaction while refusing a second buy.
alter function public.acquire_game_property(uuid,text) rename to _acquire_game_property_original;
revoke all on function public._acquire_game_property_original(uuid,text) from public,anon,authenticated;
create function public.acquire_game_property(p_property_id uuid,p_tenure text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); result jsonb;
begin
  if cid is null then raise exception 'Sign in and create a character first'; end if;
  perform 1 from public.characters where id = cid for update;
  if p_tenure = 'owned' and exists(select 1 from public.player_properties
      where character_id = cid and property_id = p_property_id
        and tenure = 'owned' and is_active) then
    raise exception 'ALREADY_OWNED';
  end if;
  result := public._acquire_game_property_original(p_property_id,p_tenure);
  if p_tenure = 'owned' then
    update public.property_rent_cycles set status = 'paid', paid_at = now()
      where player_property_id in (select id from public.player_properties
        where character_id = cid and property_id = p_property_id
          and tenure = 'rented' and not is_active)
        and status in ('current','due','grace','rescue');
  end if;
  return result;
end $$;
revoke all on function public.acquire_game_property(uuid,text) from public,anon;
grant execute on function public.acquire_game_property(uuid,text) to authenticated;

-- A purchased room cannot be ended through the old rent cancellation RPC.
alter function public.cancel_player_house(uuid) rename to _cancel_player_house_original;
revoke all on function public._cancel_player_house_original(uuid) from public,anon,authenticated;
create function public.cancel_player_house(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or auth.uid() <> p_user_id then raise exception 'Sign in to cancel your tenancy'; end if;
  if exists (select 1 from public.player_houses room
    join public.player_properties tenancy on tenancy.id = room.player_property_id
    where room.player_id = p_user_id and room.status in ('active','overdue')
      and tenancy.is_active and tenancy.tenure = 'owned') then
    raise exception 'OWNED_HOME_CANNOT_BE_CANCELLED';
  end if;
  return public._cancel_player_house_original(p_user_id);
end $$;
revoke all on function public.cancel_player_house(uuid) from public,anon;
grant execute on function public.cancel_player_house(uuid) to authenticated;

-- Old rent helpers target the selected room by player ID. Suppress their
-- due/ended updates when that room belongs to an owned house.
create function public._protect_owned_room_from_rent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.player_property_id is not null and exists (
    select 1 from public.player_properties tenancy where tenancy.id = old.player_property_id
      and tenancy.is_active and tenancy.tenure = 'owned'
  ) and (new.status in ('overdue','ended')
    or (new.status = 'active' and new.next_rent_due_at is distinct from old.next_rent_due_at)) then
    return null;
  end if;
  return new;
end $$;
revoke all on function public._protect_owned_room_from_rent() from public,anon,authenticated;
create trigger protect_owned_room_from_rent before update on public.player_houses
  for each row execute function public._protect_owned_room_from_rent();

-- Repossession affects the expired tenancy's room. An independently owned
-- selected home and its placed furniture remain available.
create or replace function public._advance_property_rent_cycles()
returns integer language plpgsql security definer set search_path = public as $$
declare changed integer := 0; ended_ids uuid[];
begin
  update public.property_rent_cycles set status = 'due'
    where status = 'current' and due_at <= now();
  get diagnostics changed = row_count;
  update public.property_rent_cycles set status = 'grace'
    where status = 'due' and due_at <= now();
  update public.property_rent_cycles set status = 'rescue'
    where status in ('due','grace') and grace_ends_at <= now();
  update public.player_houses room set status = 'overdue'
    from public.property_rent_cycles cycle
    where room.player_property_id = cycle.player_property_id
      and room.status = 'active' and cycle.status in ('grace','rescue');
  with repossessed as (
    update public.property_rent_cycles set status = 'repossessed'
      where status = 'rescue' and rescue_ends_at <= now()
      returning player_property_id,character_id
  ), ended as (
    update public.player_properties tenancy set is_active = false,updated_at = now()
      from repossessed where tenancy.id = repossessed.player_property_id
      returning tenancy.id,tenancy.character_id,tenancy.user_id
  ), moved as (
    update public.characters character set current_location_id = location.id,updated_at = now()
      from ended join public.locations location on location.slug = 'city-centre'
      where character.id = ended.character_id and not exists (
        select 1 from public.player_properties home
        join public.game_properties listing on listing.id = home.property_id
        where home.character_id = character.id and home.is_active
          and listing.house_type_id is not null
      ) returning character.id
  ), ended_rooms as (
    update public.player_houses room set status = 'ended'
      from ended where room.player_property_id = ended.id
        and room.status in ('active','overdue') returning room.id
  ) select array_agg(id) into ended_ids from ended_rooms;
  if ended_ids is not null then
    delete from public.house_placements where player_house_id = any(ended_ids);
    delete from public.player_homes legacy where legacy.user_id in (
      select player_id from public.player_houses where id = any(ended_ids))
      and not exists (select 1 from public.player_properties home
        where home.user_id = legacy.user_id and home.is_active and home.is_home);
    update public.home_items item set placed = false,slot_id = null,updated_at = now()
      where item.user_id in (select player_id from public.player_houses where id = any(ended_ids))
        and not exists (select 1 from public.player_properties home
          where home.user_id = item.user_id and home.is_active and home.is_home);
  end if;
  return changed;
end $$;
revoke all on function public._advance_property_rent_cycles() from public,anon,authenticated;

create or replace function public.housing_current_home(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid; result jsonb;
begin
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform public._advance_property_rent_cycles();
  select jsonb_build_object(
    'propertyId',listing.id,'playerPropertyId',tenancy.id,
    'houseTypeId',house.id,'name',listing.name,'assetKey',house.asset_key,
    'imageUrl',listing.image_url,'district',coalesce(listing.metadata->>'district','Residential District'),
    'locationName',coalesce(listing.metadata->>'district',location.name),
    'bedrooms',house.bedrooms,'features',coalesce(listing.metadata->'features','[]'::jsonb),
    'tenure',tenancy.tenure,
    'status',case when tenancy.tenure = 'owned' then 'owned' else cycle.status end,
    'weeklyRentMinor',case when tenancy.tenure = 'owned' then 0 else house.weekly_rent_minor end,
    'dueAt',case when tenancy.tenure = 'owned' then null else cycle.due_at end,
    'graceEndsAt',cycle.grace_ends_at,'rescueEndsAt',cycle.rescue_ends_at,
    'accessoryBand',coalesce(accessories.band,'basic')) into result
  from public.player_properties tenancy
  join public.game_properties listing on listing.id = tenancy.property_id
  join public.house_types house on house.id = listing.house_type_id
  join public.locations location on location.id = listing.location_id
  left join lateral (select status,due_at,grace_ends_at,rescue_ends_at
    from public.property_rent_cycles where player_property_id = tenancy.id
      and status in ('current','due','grace','rescue') order by due_at desc limit 1) cycle on true
  left join public.player_home_accessory_sets accessories on accessories.player_property_id = tenancy.id
  where tenancy.character_id = cid and tenancy.is_active
  order by tenancy.is_home desc,tenancy.acquired_at desc limit 1;
  return coalesce(result,'null'::jsonb);
end $$;
revoke all on function public.housing_current_home(uuid) from public,anon,authenticated;
grant execute on function public.housing_current_home(uuid) to service_role;

create or replace function public.housing_map_properties(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare cid uuid; result jsonb;
begin
  select id into cid from public.characters where user_id = p_user_id;
  if cid is null then raise exception 'NO_CHARACTER'; end if;
  perform public._advance_property_rent_cycles();
  select coalesce(jsonb_agg(jsonb_build_object(
    'propertyId',listing.id,'houseTypeId',house.id,'label',listing.name,
    'model',listing.metadata #>> '{mapPlot,model}',
    'gridX',(listing.metadata #>> '{mapPlot,x}')::integer,
    'gridZ',(listing.metadata #>> '{mapPlot,z}')::integer,
    'tier',case accessories.band when 'premium' then 3 when 'comfortable' then 2 else 1 end,
    'status',case when tenancy.id is null then 'vacant'
      when tenancy.tenure = 'owned' then 'owned'
      when cycle.status = 'rescue' then 'overdue'
      when cycle.status in ('due','grace') then 'rent_due'
      when cycle.status = 'current' then 'current' else 'vacant' end
  ) order by house.sort_order,listing.slug),'[]'::jsonb) into result
  from public.game_properties listing
  join public.house_types house on house.id = listing.house_type_id and house.is_active
  left join public.player_properties tenancy on tenancy.property_id = listing.id
    and tenancy.character_id = cid and tenancy.is_active
  left join lateral(select rent.status from public.property_rent_cycles rent
    where rent.player_property_id = tenancy.id
      and rent.status in ('current','due','grace','rescue')
    order by rent.due_at desc limit 1) cycle on true
  left join public.player_home_accessory_sets accessories
    on accessories.player_property_id = tenancy.id
  where listing.is_active and listing.metadata ? 'mapPlot';
  return result;
end $$;
revoke all on function public.housing_map_properties(uuid) from public,anon,authenticated;
grant execute on function public.housing_map_properties(uuid) to service_role;

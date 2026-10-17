-- Reframe map gameplay around fictional destinations on a real geographic basemap.
-- Stable slugs and foreign keys remain intact for existing saves and jobs.
update public.locations as place set
  name = seed.name,
  tagline = seed.tagline,
  description = seed.description,
  metadata = (coalesce(place.metadata, '{}'::jsonb) - 'disclosure' - 'coordinate_precision')
    || jsonb_build_object('origin', 'fictional', 'map_role', 'fictional_destination')
from (values
  ('city-centre', 'Central Crossing', 'The heart of the game city', 'A fictional central district where players meet, travel and find services.'),
  ('oja-oba', 'Market Square', 'Everyday trading and local finds', 'A fictional market quarter with player-owned stalls and community spaces.'),
  ('oke-fia', 'Hillview Quarter', 'A neighborhood on the rise', 'A fictional neighborhood with homes, shops and lively streets.'),
  ('old-garage', 'North Gate Transit Hub', 'Travel and vehicle services', 'A fictional transit hub with player-run services and workshops.'),
  ('student-district', 'Campus Quarter', 'Study, work and community', 'A fictional education district with student services and career opportunities.'),
  ('residential', 'Home Quarter', 'A place to settle in', 'A fictional residential district. No real home or street address is represented.'),
  ('business-district', 'Commerce Quarter', 'Work and new ventures', 'A fictional business district for player-run companies and jobs.'),
  ('cultural-district', 'Arts Quarter', 'Creative work and community events', 'A fictional arts and recreation district with galleries, studios and event spaces.'),
  ('rural-outskirts', 'Greenbelt Outskirts', 'Farms and open roads', 'A fictional edge-of-city district for farming, recreation and community life.'),
  ('government-area', 'Civic Services District', 'Public service careers', 'A fictional civic district with public counters and player career paths.'),
  ('stadium', 'Northfield Stadium', 'Sport and community events', 'A fictional sports ground for training, matches and community events.'),
  ('state-hospital', 'Green Cross Clinic', 'Health and recovery', 'A fictional care center for recovery and healthcare careers.'),
  ('airport-terminal', 'Regional Air Terminal', 'Travel and transport work', 'A fictional terminal for future cross-region journeys.'),
  ('oke-baale', 'Highland Commons', 'A high-ground viewpoint', 'A fictional public viewpoint used to orient players across the city.'),
  ('isale-osun', 'South Market Row', 'Neighborhood shopping', 'A fictional retail district with player-run shops and everyday services.'),
  ('atiku', 'Greenbank Estates', 'Starter homes and neighbors', 'A fictional residential neighborhood. No real residence is represented.'),
  ('industrial-area', 'Workshop Quarter', 'Trades and shift work', 'A fictional work zone for manufacturing, repair and skilled trades.'),
  ('osun-mall', 'Palmline Galleria', 'Shopping and everyday essentials', 'A fictional shopping destination with player-run stores, stalls and social spaces.'),
  ('aiyegbaju-market', 'Mosaic Market', 'Market trading and local shopping', 'A fictional market with player-run stalls, trader work and community spaces.'),
  ('osogbo-high-court', 'Civic Justice Hall', 'Fictional civic services', 'A fictional civic venue for in-game case filing and public-service careers.'),
  ('bola-ige-secretariat', 'Civic Operations Hub', 'Public services and careers', 'A fictional administration center with public-service career pathways.'),
  ('mandela-freedom-park', 'Greenway Commons', 'Open-air recreation and events', 'A fictional public park for walks, events and meeting other players.'),
  ('osogbo-bank-district', 'Cedarline Finance House', 'Banking and finance careers', 'A fictional finance venue. No real bank is represented.'),
  ('adire-cloth-market', 'Indigo Loom Market', 'Local textiles and clothing', 'A fictional clothing and textile market with player-run shops and stalls.')
) as seed(slug, name, tagline, description)
where place.slug = seed.slug;

update public.locations set metadata = coalesce(metadata, '{}'::jsonb)
  || jsonb_build_object('origin', 'fictional', 'map_role', 'fictional_destination')
where is_active;

-- Keep historic religious records for referential integrity, but remove them from all active play.
update public.locations set
  is_active = false,
  metadata = (coalesce(metadata, '{}'::jsonb) - 'available_actions')
    || jsonb_build_object('origin', 'excluded', 'map_role', 'excluded', 'map_exclusion_reason', 'religious_site')
where coalesce(metadata ->> 'category', '') = 'religious'
   or slug in ('cultural-district', 'osogbo-central-mosque', 'osogbo-grand-mosque', 'oke-fia-community-church')
   or name ~* '(sacred|grove|shrine|mosque|church|chapel|temple)';

-- The Arts Quarter is fictional recreation, not a sacred or religious location.
update public.locations set
  is_active = true,
  name = 'Arts Quarter',
  tagline = 'Creative work and community events',
  description = 'A fictional arts and recreation district with galleries, studios and event spaces.',
  metadata = (coalesce(metadata, '{}'::jsonb) - 'map_exclusion_reason')
    || jsonb_build_object('origin', 'fictional', 'map_role', 'fictional_destination')
where slug = 'cultural-district';

-- Fictionalize businesses and remove prior disclosures tying them to real operators or addresses.
update public.game_places set
  name = case slug
    when 'osun-mall-supermarket' then 'Palmline Provisions'
    when 'osun-mall-cafe' then 'Canopy Cup Cafe'
    when 'aiyegbaju-textile-stalls' then 'Indigo Loom Stalls'
    when 'aiyegbaju-produce-stalls' then 'Market Basket Produce'
    when 'station-road-community-bank' then 'Cedarline Community Bank'
    else name
  end,
  description = case slug
    when 'osun-mall-supermarket' then 'A fictional in-game grocer for everyday essentials.'
    when 'osun-mall-cafe' then 'A fictional cafe for meals and a break during a shopping trip.'
    when 'aiyegbaju-textile-stalls' then 'Fictional stalls with player-run textiles and clothing.'
    when 'aiyegbaju-produce-stalls' then 'Fictional produce stalls for shopping and trader work.'
    when 'station-road-community-bank' then 'A fictional community bank with in-game finance services.'
    else description
  end,
  origin = 'fictional',
  disclosure = 'Fictional in-game business. No real operator, business, residence or street address is represented.'
where location_id in (select id from public.locations where slug in (
  'osun-mall', 'aiyegbaju-market', 'osogbo-bank-district'
));

update public.jobs set name = 'Palmline Galleria Shop Assistant'
where slug = 'osun_mall_sales_assistant';

-- Existing characters at now-excluded sites return to the fictional city center.
update public.characters as player set
  current_location_id = safe_place.id,
  virtual_latitude = safe_place.latitude,
  virtual_longitude = safe_place.longitude,
  world_x = 7,
  world_y = 6,
  world_building_slug = null,
  movement_state = 'idle',
  world_position_revision = world_position_revision + 1
from public.locations as old_place, public.locations as safe_place
where player.current_location_id = old_place.id
  and old_place.is_active = false
  and old_place.metadata ->> 'map_exclusion_reason' = 'religious_site'
  and safe_place.slug = 'city-centre';

update public.npc_definitions as npc set home_location_id = safe_place.id
from public.locations as old_place, public.locations as safe_place
where npc.home_location_id = old_place.id
  and old_place.metadata ->> 'map_exclusion_reason' = 'religious_site'
  and safe_place.slug = 'residential';

update public.npc_definitions as npc set work_location_id = safe_place.id
from public.locations as old_place, public.locations as safe_place
where npc.work_location_id = old_place.id
  and old_place.metadata ->> 'map_exclusion_reason' = 'religious_site'
  and safe_place.slug = 'business-district';

-- Keep the fictional court activity, but remove worship/tithe actions from the RPC.
create or replace function public.perform_location_activity(
  p_location_id uuid,
  p_action text,
  p_request_id uuid,
  p_amount bigint default 0,
  p_target_character_id uuid default null,
  p_details text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  place public.locations%rowtype;
  player public.characters%rowtype;
  cached jsonb;
  result jsonb;
  case_id uuid;
begin
  if auth.uid() is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'A request id is required'; end if;
  select * into place from public.locations where id = p_location_id and is_active for share;
  if not found then raise exception 'This place is unavailable'; end if;
  if place.slug <> 'osogbo-high-court' or p_action <> 'file_complaint' then
    raise exception 'That activity is not available at this location';
  end if;
  select * into player from public.characters where id = cid for update;
  if player.current_location_id is distinct from place.id then raise exception 'Travel here before taking this action'; end if;

  insert into public.location_activity_requests(character_id, request_id)
    values (cid, p_request_id) on conflict do nothing;
  select response into cached from public.location_activity_requests
    where character_id = cid and request_id = p_request_id for update;
  if cached is not null then return cached; end if;
  if p_target_character_id is null or p_target_character_id = cid then raise exception 'Choose another player for this fictional case'; end if;
  if p_details is null or char_length(trim(p_details)) not between 20 and 500 then raise exception 'Write a summary between 20 and 500 characters'; end if;
  if not exists(select 1 from public.characters where id = p_target_character_id) then raise exception 'That player could not be found'; end if;
  insert into public.city_civic_cases(location_id,claimant_character_id,respondent_character_id,summary,filed_game_day)
    values (place.id,cid,p_target_character_id,trim(p_details),player.game_day) returning id into case_id;
  result := jsonb_build_object('action','file_complaint','case_id',case_id,'message','Your fictional in-game complaint was filed.');
  update public.location_activity_requests set response = result
    where character_id = cid and request_id = p_request_id;
  return result;
end $$;

revoke execute on function public.perform_location_activity(uuid,text,uuid,bigint,uuid,text) from public, anon;
grant execute on function public.perform_location_activity(uuid,text,uuid,bigint,uuid,text) to authenticated;

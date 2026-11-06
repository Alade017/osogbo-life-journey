insert into public.locations
  (slug,name,tagline,description,district_type,map_x,map_y,color,planned_features,sort_order,
   type,latitude,longitude,icon,is_active,level_required,metadata,map_coordinate_mode,
   travel_fare,travel_minutes,canvas_x,canvas_y,map_category,neighbor_slugs,job_contract_slugs,entry_loops)
values
  ('east-transit-terminal','East Transit Terminal','Passenger routes and services',
   'A fictional passenger concourse for waiting, route information and local travel. It is not a real transport operator.',
   'transport',90,25,'blue',array['route information','passenger services'],90,'transport',null,null,'transport',true,0,
   '{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.90,0.25,
   'transport',array['riverside-food-court','eastside-produce-coop','harvest-tech-hub'],array[]::text[],
   array['travel','work','social']),
  ('eastside-produce-coop','Eastside Produce Co-op','Shared produce and local trade',
   'A fictional cooperative market for shared produce displays, buyers and neighborhood traders.',
   'commercial',95,50,'green',array['produce stalls','local trade'],91,'market',null,null,'market',true,0,
   '{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.95,0.50,
   'commercial',array['east-transit-terminal','riverside-food-court','sunrise-health-post','adire-makers-yard'],
   array[]::text[],array['shop','work','social']),
  ('adire-makers-yard','Adire Makers'' Yard','Textile craft and shared learning',
   'A fictional textile workshop with shared maker tables and a community display. It does not represent a specific business.',
   'education',90,75,'purple',array['textile workshop','creative learning'],92,'landmark',null,null,'cultural-landmark',true,0,
   '{"origin":"fictional","map_role":"public_game_venue","category":"cultural_landmark"}'::jsonb,'virtual_game',0,1,0.90,0.75,
   'education',array['eastside-produce-coop','harvest-tech-hub','old-town-library','neighborhood-play-park'],
   array[]::text[],array['study','work','social']),
  ('neighborhood-play-park','Neighbourhood Play Park','Open recreation and community space',
   'A fictional neighborhood park with visitor seating, planted edges and a shared play area.',
   'recreation',98,94,'green',array['recreation','community space'],93,'entertainment',null,null,'park',true,0,
   '{"origin":"fictional","map_role":"public_game_venue","category":"park"}'::jsonb,'virtual_game',0,1,0.98,0.94,
   'recreation',array['adire-makers-yard','old-town-library','rural-outskirts','airport-terminal'],
   array[]::text[],array['explore','social'])
on conflict (slug) do update set
  name=excluded.name,tagline=excluded.tagline,description=excluded.description,
  district_type=excluded.district_type,map_x=excluded.map_x,map_y=excluded.map_y,
  color=excluded.color,planned_features=excluded.planned_features,sort_order=excluded.sort_order,
  type=excluded.type,latitude=null,longitude=null,icon=excluded.icon,is_active=true,
  level_required=excluded.level_required,metadata=excluded.metadata,
  map_coordinate_mode='virtual_game',travel_fare=excluded.travel_fare,
  travel_minutes=excluded.travel_minutes,canvas_x=excluded.canvas_x,canvas_y=excluded.canvas_y,
  map_category=excluded.map_category,neighbor_slugs=excluded.neighbor_slugs,
  job_contract_slugs=excluded.job_contract_slugs,entry_loops=excluded.entry_loops;

insert into public.map_landmarks (id,district_id,location_id,min_age,is_available)
select seed.id,seed.district_id,location.id,0,true
from (values
  ('east-transit-terminal','river-quarter'),
  ('eastside-produce-coop','river-quarter'),
  ('adire-makers-yard','east-gate'),
  ('neighborhood-play-park','east-gate')
) as seed(id,district_id)
join public.locations location on location.slug=seed.id and location.is_active
on conflict (id) do update set
  district_id=excluded.district_id,location_id=excluded.location_id,min_age=0,is_available=true;

insert into public.map_location_districts (location_id,district_id)
select location.id,seed.district_id
from (values
  ('east-transit-terminal','river-quarter'),
  ('eastside-produce-coop','river-quarter'),
  ('adire-makers-yard','east-gate'),
  ('neighborhood-play-park','east-gate')
) as seed(slug,district_id)
join public.locations location on location.slug=seed.slug
on conflict (location_id) do update set district_id=excluded.district_id;

insert into public.map_district_distances (from_district_id,to_district_id,distance_m)
select origin.id,destination.id,
  greatest(500,round(sqrt(power(origin.layout_x-destination.layout_x,2)
    +power(origin.layout_y-destination.layout_y,2))*10)::integer)
from public.map_districts origin cross join public.map_districts destination
on conflict (from_district_id,to_district_id) do update set distance_m=excluded.distance_m;

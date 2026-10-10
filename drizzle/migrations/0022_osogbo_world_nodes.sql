-- Add blueprint presentation and interaction metadata without changing legacy IDs or movement coordinates.
alter table public.locations
  add column canvas_x double precision,
  add column canvas_y double precision,
  add column map_category text not null default 'commercial',
  add column neighbor_slugs text[] not null default '{}',
  add column job_contract_slugs text[] not null default '{}',
  add column entry_loops text[] not null default '{}',
  add constraint locations_canvas_coordinates_check check (
    canvas_x is null or (canvas_x between 0 and 1 and canvas_y between 0 and 1)
  ),
  add constraint locations_map_category_check check (map_category in (
    'residential', 'commercial', 'work_industrial', 'education', 'health',
    'transport', 'government', 'recreation', 'water_nature'
  ));

-- Preserve the existing records and stable slugs that character saves and jobs reference.
update public.locations as l set
  name = seed.name,
  canvas_x = seed.x,
  canvas_y = seed.y,
  map_category = seed.category,
  neighbor_slugs = seed.neighbors,
  job_contract_slugs = seed.contracts,
  entry_loops = seed.loops,
  map_x = round(seed.x * 100),
  map_y = round(seed.y * 100),
  metadata = l.metadata || jsonb_build_object('world_blueprint_version', 1, 'coordinate_space', 'normalized_canvas')
from (values
  ('city-centre','Olaiya',0.50,0.47,'commercial',array['oja-oba','government-area','state-hospital','isale-osun','old-garage','oke-fia'],array['office_assistant','shop_assistant','stock_assistant'],array['shop','social','explore']),
  ('oja-oba','Oja-Oba Market',0.60,0.26,'commercial',array['city-centre','government-area','student-district','isale-osun'],array['market_trader','market_sales_assistant','food_vendor'],array['shop','work','social']),
  ('oke-fia','Oke-Fia',0.07,0.44,'residential',array['city-centre','government-area','student-district','state-hospital'],array[]::text[],array['social','explore']),
  ('old-garage','Transport Hub · Old Garage',0.14,0.60,'transport',array['city-centre','state-hospital','industrial-area','isale-osun'],array['driver_rider','delivery_rider','mechanic','mechanic_assistant','workshop_assistant'],array['travel','work','social']),
  ('student-district','UNIOSUN Campus',0.12,0.24,'education',array['oja-oba','government-area','stadium','oke-fia'],array['junior_frontend_developer','computer_assistant','tech_support_assistant','computer_instructor'],array['study','work','social']),
  ('cultural-district','Sacred Grove · Osun Sacred Forest',0.69,0.07,'water_nature',array['oke-baale','atiku','city-centre'],array[]::text[],array['explore','social']),
  ('rural-outskirts','Outskirts · Farms & Village',0.92,0.66,'water_nature',array['airport-terminal','stadium'],array['farm_assistant'],array['work','explore','social'])
) as seed(slug,name,x,y,category,neighbors,contracts,loops)
where l.slug = seed.slug;

-- Add the blueprint landmarks absent from older saves. Their stable slugs are used in relationships.
insert into public.locations
  (slug,name,tagline,description,district_type,map_x,map_y,color,planned_features,sort_order,
   type,icon,is_active,metadata,map_coordinate_mode,travel_fare,travel_minutes,
   canvas_x,canvas_y,map_category,neighbor_slugs,job_contract_slugs,entry_loops)
values
  ('government-area','Government Area · State Secretariat','Civic work and city services','Administrative offices and civil service opportunities.','civic',38,21,'blue',array['civil service','public services'],20,'government','landmark',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',140,18,0.38,0.21,'government',array['city-centre','oja-oba','student-district','oke-fia'],array[]::text[],array['work','social']),
  ('stadium','Stadium','Sport and community events','A sports ground for training, matches and public events.','recreation',53,73,'green',array['training','sports events'],21,'entertainment','landmark',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',180,22,0.53,0.73,'recreation',array['student-district','industrial-area','airport-terminal','atiku'],array[]::text[],array['work','explore','social']),
  ('state-hospital','State Hospital','Health and recovery','A health centre for care, recovery and healthcare careers.','health',32,44,'red',array['healthcare','recovery'],22,'hospital','hospital',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',100,12,0.32,0.44,'health',array['city-centre','oke-fia','old-garage'],array[]::text[],array['recover','work']),
  ('airport-terminal','Airport · Terminal','Regional travel','The airport terminal for future cross-regional journeys.','transport',75,80,'blue',array['regional travel'],23,'transport','plane',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',450,35,0.75,0.80,'transport',array['stadium','atiku','rural-outskirts'],array[]::text[],array['travel','work']),
  ('oke-baale','Oke-Baale · Hill View','High-ground recreation','A hill-view neighborhood and quiet recreation area.','recreation',48,6,'green',array['hill walks','viewpoint'],24,'landmark','mountain',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',130,16,0.48,0.06,'recreation',array['cultural-district','government-area','atiku'],array[]::text[],array['explore','social']),
  ('isale-osun','Isale-Osun','Neighborhood commerce','Local retail, services and everyday neighborhood businesses.','business',68,56,'amber',array['retail','services'],25,'shop','store',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',120,14,0.68,0.56,'commercial',array['city-centre','oja-oba','old-garage','atiku'],array[]::text[],array['shop','work','social']),
  ('atiku','Atiku Residential','Starter homes and neighbors','A high-density residential neighborhood with courtyard homes.','residential',93,44,'green',array['housing','community'],26,'residential','house',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',200,24,0.93,0.44,'residential',array['cultural-district','oke-baale','isale-osun','stadium','airport-terminal'],array[]::text[],array['social','explore']),
  ('industrial-area','Industrial Area','Workshop and shift work','A work zone for manufacturing and skilled-trade shifts.','industrial',33,75,'purple',array['manufacturing','skilled trades'],27,'workplace','factory',true,'{"world_blueprint_version":1}'::jsonb,'virtual_game',160,20,0.33,0.75,'work_industrial',array['old-garage','stadium','rural-outskirts'],array['factory-worker','skilled-trade'],array['work'])
on conflict (slug) do nothing;

-- Keep re-runs safe and make all rows carry explicit, validated canvas metadata.
update public.locations set
  canvas_x = coalesce(canvas_x, greatest(0, least(1, map_x / 100.0))),
  canvas_y = coalesce(canvas_y, greatest(0, least(1, map_y / 100.0)))
where canvas_x is null or canvas_y is null;

alter table public.locations alter column canvas_x set not null, alter column canvas_y set not null;
create index locations_blueprint_category_idx on public.locations(map_category, sort_order) where is_active;

-- Replace legacy pins with fictional, address-free public game venues.
insert into public.locations
  (slug,name,tagline,description,district_type,map_x,map_y,color,planned_features,sort_order,
   type,latitude,longitude,icon,is_active,level_required,metadata,map_coordinate_mode,
   travel_fare,travel_minutes,canvas_x,canvas_y,map_category,neighbor_slugs,job_contract_slugs,entry_loops)
values
  ('town-market','Town Market','Public shopping and community','A fictional public market with player-facing stalls, local errands and visitor activities.','commercial',20,20,'amber',array['market stalls','community'],60,'market',null,null,'store',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.18,0.16,'commercial',array['civic-court','transit-park'],array[]::text[],array['shop','social']),
  ('civic-court','Civic Court','Public information and civic services','A fictional civic venue for general public-service information and in-game clerk activities. It does not represent a real court or offer legal advice.','civic',40,20,'blue',array['public information','civic careers'],61,'government',null,null,'landmark',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.40,0.16,'government',array['town-market','community-police'],array[]::text[],array['public_services','work']),
  ('community-police','Community Police Station','Community safety information','A fictional public safety information point. It is not a mapped real station or an emergency service.','civic',48,20,'blue',array['safety information','public careers'],62,'government',null,null,'landmark',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.52,0.16,'government',array['civic-court','cedar-bank'],array[]::text[],array['public_services','work']),
  ('cedar-bank','Cedar Bank','Everyday banking and finance careers','A fictional bank for in-game financial literacy activities and career browsing.','commercial',66,20,'green',array['banking information','finance careers'],63,'bank',null,null,'banknote',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.72,0.16,'commercial',array['community-police','meridian-bank'],array[]::text[],array['bank','work']),
  ('meridian-bank','Meridian Bank','Everyday banking and finance careers','A second fictional bank venue for in-game financial literacy activities and career browsing.','commercial',84,60,'green',array['banking information','finance careers'],64,'bank',null,null,'banknote',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.88,0.60,'commercial',array['cedar-bank','sports-ground'],array[]::text[],array['bank','work']),
  ('lantern-club','Lantern Club','An adults-only evening venue','A fictional adults-only social venue. This game destination is not a real business.','recreation',70,70,'purple',array['social activities','evening events'],65,'entertainment',null,null,'music',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.68,0.72,'recreation',array['community-clinic','sports-ground'],array[]::text[],array['social','events']),
  ('community-clinic','Community Clinic','Health information and care careers','A fictional clinic setting for general wellness activities and healthcare career browsing.','health',28,70,'red',array['wellness','care careers'],66,'hospital',null,null,'heart-pulse',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.28,0.72,'health',array['lantern-club','transit-park'],array[]::text[],array['health','work']),
  ('transit-park','Transit Park','Local travel and public routes','A fictional transport park with in-game route information and travel helpers.','transport',14,82,'blue',array['route information','travel helpers'],67,'transport',null,null,'bus',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.14,0.84,'transport',array['town-market','community-clinic'],array[]::text[],array['travel','social']),
  ('sports-ground','Community Sports Ground','Sports and neighborhood events','A fictional public sports ground for community activities, friendly games and exercise.','recreation',56,82,'green',array['fitness','community sport'],68,'entertainment',null,null,'trophy',true,0,'{"origin":"fictional","map_role":"public_game_venue"}'::jsonb,'virtual_game',0,1,0.56,0.84,'recreation',array['meridian-bank','lantern-club'],array[]::text[],array['explore','social'])
on conflict (slug) do update set
  name=excluded.name, tagline=excluded.tagline, description=excluded.description,
  district_type=excluded.district_type, map_x=excluded.map_x, map_y=excluded.map_y,
  type=excluded.type, latitude=null, longitude=null, icon=excluded.icon, is_active=true,
  metadata=excluded.metadata, map_coordinate_mode='virtual_game', canvas_x=excluded.canvas_x,
  canvas_y=excluded.canvas_y, map_category=excluded.map_category,
  neighbor_slugs=excluded.neighbor_slugs, job_contract_slugs=excluded.job_contract_slugs,
  entry_loops=excluded.entry_loops;

-- The visible map uses fictional route districts; these ids intentionally avoid
-- attaching any new public venue to a named real-world neighborhood.
insert into public.map_districts (id,name,layout_x,layout_y) values
  ('market-quarter','Market quarter',0,0),
  ('civic-quarter','Civic quarter',300,0),
  ('commerce-quarter','Commerce quarter',600,0),
  ('central-crossing','Central crossing',0,390),
  ('garden-quarter','Garden quarter',300,390),
  ('learning-quarter','Learning quarter',600,390),
  ('transit-quarter','Transit quarter',0,780),
  ('open-fields','Open fields',600,780)
on conflict (id) do update set name=excluded.name,
  layout_x=excluded.layout_x,layout_y=excluded.layout_y;

insert into public.map_district_distances (from_district_id,to_district_id,distance_m)
select origin.id,destination.id,
  greatest(500,round(sqrt(power(origin.layout_x-destination.layout_x,2)
    +power(origin.layout_y-destination.layout_y,2))*10)::integer)
from public.map_districts origin cross join public.map_districts destination
on conflict (from_district_id,to_district_id) do update set distance_m=excluded.distance_m;

update public.map_landmarks set is_available=false;
insert into public.map_landmarks (id,district_id,location_id,min_age,is_available)
select seed.id,seed.district_id,location.id,seed.min_age,true
from (values
  ('town-market','market-quarter','town-market',0),
  ('civic-court','civic-quarter','civic-court',0),
  ('community-police','civic-quarter','community-police',0),
  ('cedar-bank','commerce-quarter','cedar-bank',0),
  ('meridian-bank','learning-quarter','meridian-bank',0),
  ('lantern-club','garden-quarter','lantern-club',18),
  ('community-clinic','learning-quarter','community-clinic',0),
  ('transit-park','transit-quarter','transit-park',0),
  ('sports-ground','open-fields','sports-ground',0)
) as seed(id,district_id,slug,min_age)
join public.locations location on location.slug=seed.slug and location.is_active
on conflict (id) do update set district_id=excluded.district_id,
  location_id=excluded.location_id,min_age=excluded.min_age,is_available=true;

insert into public.map_location_districts (location_id,district_id)
select location.id,seed.district_id
from (values
  ('town-market','market-quarter'),('civic-court','civic-quarter'),('community-police','civic-quarter'),
  ('cedar-bank','commerce-quarter'),('meridian-bank','learning-quarter'),('lantern-club','garden-quarter'),
  ('community-clinic','learning-quarter'),('transit-park','transit-quarter'),('sports-ground','open-fields')
) as seed(slug,district_id)
join public.locations location on location.slug=seed.slug
on conflict (location_id) do update set district_id=excluded.district_id;

insert into public.activities (slug,name,category,description,location_id,duration_minutes,energy_delta,is_available,metadata)
select seed.slug,seed.name,seed.category,seed.description,location.id,seed.duration,seed.energy,true,
  '{"origin":"fictional","server_action":"map_place_action"}'::jsonb
from (values
  ('town-market-browse','Browse the market stalls','exploration','Explore fictional stalls and neighborhood vendors.','town-market',12,-2),
  ('civic-court-guide','Review the civic visitor guide','study','Read general in-game information about public counters and forms. This is not legal advice.','civic-court',12,-1),
  ('police-safety-guide','Read the community safety guide','study','Review general safety tips for the fictional game town.','community-police',8,0),
  ('cedar-bank-budgeting','Review a budgeting guide','study','Learn about basic budgeting in this fictional game venue.','cedar-bank',12,0),
  ('meridian-bank-budgeting','Review a budgeting guide','study','Learn about basic budgeting in this fictional game venue.','meridian-bank',12,0),
  ('lantern-club-social','Join a social hour','social','Meet adult players during an evening social activity.','lantern-club',30,-4),
  ('community-clinic-wellness','Attend a wellness session','other','Join a general wellness activity in the fictional game.','community-clinic',20,-3),
  ('transit-park-routes','Read the route board','exploration','Review fictional local travel information.','transit-park',5,0),
  ('sports-ground-training','Join open training','exercise','Take part in a fictional community fitness session.','sports-ground',30,-8)
) as seed(slug,name,category,description,location_slug,duration,energy)
join public.locations location on location.slug=seed.location_slug
on conflict (slug) do update set location_id=excluded.location_id,
  name=excluded.name,description=excluded.description,is_available=true;

insert into public.jobs
  (slug,name,description,salary,energy_cost,required_level,cooldown_minutes,xp_reward,stat_bonus,icon,sort_order,category,duration_minutes,hunger_cost,thirst_cost,location_id,is_available)
select seed.slug,seed.name,seed.description,seed.salary,16,1,30,10,'career',seed.icon,seed.sort_order,seed.category,180,5,0,location.id,true
from (values
  ('town_market_assistant','Market Stall Assistant','Help fictional vendors organize stock and assist visitors.',3000,'store',201,'retail','town-market'),
  ('civic_information_assistant','Civic Information Assistant','Help visitors find public information desks in the game town.',3800,'briefcase',202,'services','civic-court'),
  ('community_safety_guide','Community Safety Guide','Share general game-town safety information at a public help desk.',3600,'shield-check',203,'security','community-police'),
  ('cedar_bank_teller','Cedar Bank Teller','Assist visitors at a fictional banking information counter.',4000,'banknote',204,'services','cedar-bank'),
  ('meridian_bank_teller','Meridian Bank Teller','Assist visitors at a fictional banking information counter.',4000,'banknote',205,'services','meridian-bank'),
  ('clinic_support_assistant','Clinic Support Assistant','Help visitors navigate the fictional clinic and its public desk.',4200,'heart-pulse',206,'healthcare','community-clinic'),
  ('transit_park_helper','Transit Park Helper','Help travelers find routes around the fictional town.',3400,'bus',207,'transportation','transit-park'),
  ('sports_ground_coordinator','Sports Ground Coordinator','Help set up friendly games and community activities.',3500,'trophy',208,'entertainment','sports-ground')
) as seed(slug,name,description,salary,icon,sort_order,category,location_slug)
join public.locations location on location.slug=seed.location_slug
on conflict (slug) do update set location_id=excluded.location_id,is_available=true,
  name=excluded.name,description=excluded.description;

notify pgrst, 'reload schema';

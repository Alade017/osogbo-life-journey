-- Add map pins for real-world-inspired destinations. Coordinates are gameplay map
-- anchors; the disclosure records when a pin is approximate rather than a survey point.
insert into public.locations
  (slug, name, tagline, description, district_type, map_x, map_y, color, planned_features,
   sort_order, type, latitude, longitude, icon, is_active, level_required, metadata,
   map_coordinate_mode, travel_fare, travel_minutes, canvas_x, canvas_y, map_category,
   neighbor_slugs, job_contract_slugs, entry_loops)
values
  ('osun-mall', 'Osun Mall', 'Shopping and everyday essentials',
   'A game destination inspired by the Osun Mall site on the Osogbo–Gbongan Road corridor. Browse stores, meet other visitors and shop.',
   'commercial', 54, 48, 'amber', array['supermarket','clothing stores','social visits'], 40,
   'shop', 7.7735, 4.5520, 'store', true, 0,
   '{"category":"shop","neighborhood":"Gbongan Road","coordinate_precision":"approximate gameplay anchor","origin":"real-world-inspired","disclosure":"Inspired by a real Osogbo shopping destination; not an official representation or affiliation.","available_actions":[{"id":"shop","label":"Browse stores","status":"available"},{"id":"social","label":"Meet visitors","status":"available"}]}',
   'virtual_game', 180, 14, 0.54, 0.48, 'commercial', array['city-centre','isale-osun'], array['shop_assistant','stock_assistant'], array['shop','social']),
  ('aiyegbaju-market', 'Aiyegbaju International Market', 'Market trading and local shopping',
   'A real-world-inspired market destination along the Osogbo–Gbongan Road corridor, with stalls and trader work.',
   'commercial', 58, 46, 'amber', array['market stalls','trader work','social visits'], 41,
   'market', 7.7810, 4.5565, 'store', true, 0,
   '{"category":"market","neighborhood":"Gbongan Road","coordinate_precision":"approximate gameplay anchor","origin":"real-world-inspired","disclosure":"Inspired by a real Osogbo market; not an official representation or affiliation.","available_actions":[{"id":"shop","label":"Browse stalls","status":"available"},{"id":"work","label":"Explore market work","status":"available"}]}',
   'virtual_game', 160, 13, 0.58, 0.46, 'commercial', array['city-centre','osun-mall'], array['market_trader','market_sales_assistant'], array['shop','work','social']),
  ('osogbo-high-court', 'Osun State High Court', 'Civic services and legal careers',
   'A civic destination inspired by the High Court complex on Ilobu Road. Explore court services and legal career pathways.',
   'civic', 42, 47, 'blue', array['court services','legal careers'], 42,
   'government', 7.7680, 4.5385, 'landmark', true, 0,
   '{"category":"government","neighborhood":"Ilobu Road","coordinate_precision":"approximate gameplay anchor","origin":"real-world-inspired","disclosure":"Inspired by a public court location; gameplay is fictional and is not legal advice.","available_actions":[{"id":"court_services","label":"Explore court services","status":"available"},{"id":"legal_career","label":"Explore legal careers","status":"available"}]}',
   'virtual_game', 130, 12, 0.42, 0.47, 'government', array['city-centre','state-secretariat'], array['office_assistant'], array['work','social']),
  ('osogbo-central-mosque', 'Osogbo Central Mosque', 'Worship and community',
   'A respectful, fictionalized worship and community destination inspired by the central mosque area near Oja-Oba.',
   'community', 52, 39, 'green', array['worship','community'], 43,
   'landmark', 7.7668, 4.5543, 'landmark', true, 0,
   '{"category":"religious","neighborhood":"Oja-Oba","coordinate_precision":"approximate gameplay anchor","origin":"real-world-inspired","disclosure":"A respectful game destination inspired by a real place; not an official representation or affiliation.","available_actions":[{"id":"worship","label":"Spend time in worship","status":"available"},{"id":"community","label":"Join community gathering","status":"available"}]}',
   'virtual_game', 100, 8, 0.52, 0.39, 'recreation', array['oja-oba','city-centre'], array[]::text[], array['social']),
  ('osogbo-grand-mosque', 'Osogbo Grand Mosque', 'Worship and community',
   'A worship and community destination inspired by the Grand Mosque in central Osogbo.',
   'community', 56, 37, 'green', array['worship','community'], 44,
   'landmark', 7.7690, 4.5572, 'landmark', true, 0,
   '{"category":"religious","neighborhood":"Central Osogbo","coordinate_precision":"approximate gameplay anchor","origin":"real-world-inspired","disclosure":"A respectful game destination inspired by a real place; not an official representation or affiliation.","available_actions":[{"id":"worship","label":"Spend time in worship","status":"available"},{"id":"community","label":"Join community gathering","status":"available"}]}',
   'virtual_game', 110, 9, 0.56, 0.37, 'recreation', array['oja-oba','city-centre'], array[]::text[], array['social']),
  ('bola-ige-secretariat', 'Bola Ige House · State Secretariat', 'Government services and public careers',
   'A civic hub inspired by the Osun State Secretariat at Abere, with public-service career pathways.',
   'civic', 47, 32, 'blue', array['public services','civil service'], 45,
   'government', 7.7820, 4.5510, 'landmark', true, 0,
   '{"category":"government","neighborhood":"Abere","coordinate_precision":"approximate gameplay anchor","origin":"real-world-inspired","disclosure":"Inspired by a public government complex; no government affiliation is implied.","available_actions":[{"id":"public_services","label":"Explore public services","status":"available"},{"id":"work","label":"Explore civil service work","status":"available"}]}',
   'virtual_game', 200, 18, 0.47, 0.32, 'government', array['city-centre','osogbo-high-court'], array['office_assistant'], array['work','social']),
  ('mandela-freedom-park', 'Nelson Mandela Freedom Park', 'Open-air recreation and events',
   'A public park destination for walks, community events and meeting other players.',
   'recreation', 36, 54, 'green', array['walks','community events'], 46,
   'entertainment', 7.778321, 4.545888, 'tree-pine', true, 0,
   '{"category":"park","neighborhood":"Central Osogbo","coordinate_precision":"mapped landmark","origin":"real-world-inspired","disclosure":"Public place shown as a game destination; event activities are fictional.","available_actions":[{"id":"explore","label":"Take a walk","status":"available"},{"id":"social","label":"Meet people","status":"available"}]}',
   'verified', 100, 10, 0.36, 0.54, 'recreation', array['city-centre','state-hospital'], array[]::text[], array['explore','social']),
  ('osogbo-bank-district', 'Station Road Bank District', 'Banking and finance careers',
   'A grouped game destination inspired by central Osogbo bank branches. Use the bank app actions and explore finance work.',
   'commercial', 49, 43, 'green', array['banking','finance careers'], 47,
   'bank', 7.7695, 4.5490, 'banknote', true, 0,
   '{"category":"bank","neighborhood":"Station Road","coordinate_precision":"approximate district anchor","origin":"real-world-inspired","disclosure":"A generalized game district, not a representation or endorsement of any bank.","available_actions":[{"id":"bank","label":"Open banking","status":"available"},{"id":"work","label":"Explore finance careers","status":"available"}]}',
   'virtual_game', 120, 10, 0.49, 0.43, 'commercial', array['city-centre','oja-oba'], array['office_assistant'], array['work','social']),
  ('adire-cloth-market', 'Adire & Cloth Market', 'Local textiles and clothing',
   'A clothing and textile shopping destination inspired by Osogbo craft and market culture.',
   'commercial', 63, 34, 'amber', array['textiles','clothing shops','market work'], 48,
   'shop', 7.7673, 4.5590, 'shopping-bag', true, 0,
   '{"category":"shop","neighborhood":"Oja-Oba","coordinate_precision":"approximate gameplay anchor","origin":"real-world-inspired","disclosure":"A fictionalized collection of local textile shops; no specific seller affiliation is implied.","available_actions":[{"id":"shop","label":"Browse clothing","status":"available"},{"id":"work","label":"Explore retail work","status":"available"}]}',
   'virtual_game', 120, 9, 0.63, 0.34, 'commercial', array['oja-oba','city-centre'], array['shop_assistant','market_sales_assistant'], array['shop','work','social'])
on conflict (slug) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  description = excluded.description,
  type = excluded.type,
  latitude = excluded.latitude,
  longitude = excluded.longitude,
  icon = excluded.icon,
  is_active = true,
  metadata = excluded.metadata,
  map_coordinate_mode = excluded.map_coordinate_mode,
  canvas_x = excluded.canvas_x,
  canvas_y = excluded.canvas_y,
  map_category = excluded.map_category,
  neighbor_slugs = excluded.neighbor_slugs,
  job_contract_slugs = excluded.job_contract_slugs,
  entry_loops = excluded.entry_loops;

insert into public.locations
  (slug,name,tagline,description,district_type,map_x,map_y,color,planned_features,sort_order,
   type,latitude,longitude,icon,is_active,level_required,metadata,map_coordinate_mode,
   travel_fare,travel_minutes,canvas_x,canvas_y,map_category,neighbor_slugs,job_contract_slugs,entry_loops)
values
  ('oke-fia-community-church','Oke-Fia Community Church','Worship and community',
   'A fictional community church for worship, quiet reflection and community gatherings.',
   'community',31,39,'green',array['worship','community'],49,'landmark',7.7728,4.5415,'landmark',true,0,
   '{"category":"religious","neighborhood":"Oke-Fia","coordinate_precision":"fictional gameplay anchor","origin":"fictional","disclosure":"Fictional worship setting; not affiliated with a real congregation.","available_actions":[{"id":"worship","label":"Attend worship","status":"available"},{"id":"community","label":"Join a community gathering","status":"available"}]}',
   'virtual_game',90,8,0.31,0.39,'recreation',array['oke-fia','city-centre'],array[]::text[],array['social'])
on conflict (slug) do nothing;

-- Give existing residents schedules at the new real-world-inspired places and
-- add a fictional court clerk so these venues feel inhabited.
update public.npc_definitions set work_location_id = place.id
from public.locations place
where (npc_definitions.id = 'npc-adeola' and place.slug = 'aiyegbaju-market')
   or (npc_definitions.id = 'npc-kunle' and place.slug = 'osun-mall')
   or (npc_definitions.id = 'npc-bisola' and place.slug = 'mandela-freedom-park');

insert into public.npc_definitions
  (id,name,role,personality,home_location_id,work_location_id,interests,topics,routine)
select 'npc-sade','Sade Oladipo','Court records clerk','thoughtful',home.id,court.id,
  array['public service','local history','reading'],
  array['How court records are organized','Public service careers','A quiet afternoon book'],
  '[{"start":8,"end":16,"place":"work","activity":"organizing fictional court records"},{"start":16,"end":18,"place":"market","activity":"running errands"},{"start":18,"end":24,"place":"home","activity":"unwinding after work"},{"start":0,"end":8,"place":"home","activity":"sleeping"}]'::jsonb
from public.locations home, public.locations court
where home.slug = 'residential' and court.slug = 'osogbo-high-court'
on conflict (id) do update set
  name = excluded.name, role = excluded.role, personality = excluded.personality,
  home_location_id = excluded.home_location_id, work_location_id = excluded.work_location_id,
  interests = excluded.interests, topics = excluded.topics, routine = excluded.routine;

-- Add the named supermarket as an actual place attached to the mall location.
insert into public.game_places
  (slug, location_id, name, category, description, origin, disclosure, meal_price, hunger_restore, happiness_gain, sort_order)
select 'osun-mall-supermarket', id, 'Osun Mall Supermarket', 'supermarket',
  'A game supermarket for everyday groceries and essentials.', 'real-world-inspired',
  'A fictional in-game store inspired by the shopping destination; no operator affiliation is implied.',
  null, 0, 1, 1
from public.locations where slug = 'osun-mall'
on conflict (slug) do nothing;

insert into public.game_places
  (slug, location_id, name, category, description, origin, disclosure, meal_price, hunger_restore, happiness_gain, sort_order)
select 'osun-mall-cafe', id, 'Mall Food Court Café', 'restaurant',
  'A fictional café for a meal and a break during a shopping trip.', 'real-world-inspired',
  'A fictional in-game café; no real restaurant operator is represented.',
  1800, 35, 4, 2
from public.locations where slug = 'osun-mall'
on conflict (slug) do nothing;

insert into public.game_places
  (slug, location_id, name, category, description, origin, disclosure, sort_order)
select seed.slug, loc.id, seed.name, seed.category, seed.description,
  'real-world-inspired', seed.disclosure, seed.sort_order
from (values
  ('aiyegbaju-textile-stalls','aiyegbaju-market','Textile & Clothing Stalls','clothing','Browse locally inspired textiles and clothing.','Fictional stalls inspired by Osogbo market culture.',1),
  ('aiyegbaju-produce-stalls','aiyegbaju-market','Fresh Produce Stalls','market','Shop for produce and meet local traders.','Fictional stalls inspired by the market area.',2),
  ('station-road-community-bank','osogbo-bank-district','Community Bank','bank','Use banking services and explore finance work.','A fictional bank; no real bank is represented.',1)
) as seed(slug,location_slug,name,category,description,disclosure,sort_order)
join public.locations loc on loc.slug = seed.location_slug
on conflict (slug) do nothing;

-- Job listings make the new retail, market, and civic destinations usable by the
-- existing application and server-authoritative work-shift flow.
insert into public.jobs
  (slug,name,description,salary,energy_cost,required_level,cooldown_minutes,xp_reward,stat_bonus,icon,sort_order,location_id,place_id,is_available)
select seed.slug, seed.name, seed.description, seed.salary, seed.energy_cost, 1,
  seed.cooldown, seed.xp, seed.stat_bonus, seed.icon, seed.sort_order, loc.id, place.id, true
from (values
  ('osun_mall_sales_assistant','Osun Mall Sales Assistant','Help shoppers find everyday items and keep store displays tidy.',3200,16,8,24,'social','store',71,'osun-mall','osun-mall-supermarket'),
  ('aiyegbaju_market_trader','Market Stall Assistant','Help a trader arrange goods, serve customers and track daily sales.',3000,18,8,22,'social','store',72,'aiyegbaju-market','aiyegbaju-produce-stalls'),
  ('court_records_assistant','Court Records Assistant','Organize fictional case files and help visitors find the right public counter.',4200,18,12,26,'career','briefcase',73,'osogbo-high-court',null),
  ('community_bank_teller','Community Bank Teller','Assist customers with everyday banking in a fictional community bank.',4000,18,10,25,'career','banknote',74,'osogbo-bank-district','station-road-community-bank')
) as seed(slug,name,description,salary,energy_cost,cooldown,xp,stat_bonus,icon,sort_order,location_slug,place_slug)
join public.locations loc on loc.slug = seed.location_slug
left join public.game_places place on place.slug = seed.place_slug
on conflict (slug) do nothing;

update public.jobs job set place_id = place.id
from public.game_places place
where (job.slug, place.slug) in (
  ('aiyegbaju_market_trader','aiyegbaju-produce-stalls'),
  ('community_bank_teller','station-road-community-bank')
) and job.place_id is distinct from place.id;

create table public.location_activity_requests (
  character_id uuid not null references public.characters(id) on delete cascade,
  request_id uuid not null,
  response jsonb,
  created_at timestamptz not null default now(),
  primary key (character_id, request_id)
);
alter table public.location_activity_requests enable row level security;
revoke all on public.location_activity_requests from public, anon, authenticated;
grant all on public.location_activity_requests to service_role;

create table public.city_civic_cases (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  claimant_character_id uuid not null references public.characters(id) on delete cascade,
  respondent_character_id uuid not null references public.characters(id) on delete cascade,
  summary text not null check (char_length(summary) between 20 and 500),
  filed_game_day integer not null,
  status text not null default 'filed' check (status in ('filed','under_review','resolved','dismissed')),
  created_at timestamptz not null default now(),
  unique (claimant_character_id, respondent_character_id, filed_game_day),
  check (claimant_character_id <> respondent_character_id)
);
alter table public.city_civic_cases enable row level security;
create policy "case parties can read civic cases" on public.city_civic_cases
  for select to authenticated using (
    claimant_character_id = public._my_character_id()
    or respondent_character_id = public._my_character_id()
  );
grant select on public.city_civic_cases to authenticated;
grant all on public.city_civic_cases to service_role;

create table public.location_activity_cooldowns (
  character_id uuid not null references public.characters(id) on delete cascade,
  action text not null check (action = 'worship'),
  last_game_day integer not null,
  primary key (character_id, action)
);
alter table public.location_activity_cooldowns enable row level security;
revoke all on public.location_activity_cooldowns from public, anon, authenticated;
grant all on public.location_activity_cooldowns to service_role;

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
  wallet public.wallets%rowtype;
  cached jsonb;
  result jsonb;
  case_id uuid;
  category text;
begin
  if auth.uid() is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_request_id is null then raise exception 'A request id is required'; end if;
  select * into place from public.locations where id = p_location_id and is_active for share;
  if not found then raise exception 'This place is unavailable'; end if;
  select * into player from public.characters where id = cid for update;
  if player.current_location_id is distinct from place.id then raise exception 'Travel here before taking this action'; end if;
  category := place.metadata ->> 'category';

  insert into public.location_activity_requests(character_id, request_id)
    values (cid, p_request_id) on conflict do nothing;
  select response into cached from public.location_activity_requests
    where character_id = cid and request_id = p_request_id for update;
  if cached is not null then return cached; end if;

  if p_action = 'worship' and category = 'religious' then
    insert into public.location_activity_cooldowns(character_id,action,last_game_day)
      values (cid,'worship',player.game_day)
      on conflict (character_id,action) do update set last_game_day = excluded.last_game_day
        where location_activity_cooldowns.last_game_day < excluded.last_game_day;
    if not found then raise exception 'You have already attended worship today'; end if;
    update public.characters set happiness = least(100, happiness + 2), updated_at = now() where id = cid;
    result := jsonb_build_object('action','worship','message','You spent time in worship and community.','happiness_gained',least(2,100-player.happiness));
  elsif p_action = 'tithe' and category = 'religious' then
    if p_amount < 50 or p_amount > 50000 then raise exception 'Choose a tithe between ₦50 and ₦50,000'; end if;
    select * into wallet from public.wallets where character_id = cid for update;
    if not found or wallet.balance < p_amount then raise exception 'Not enough in-game Naira for that tithe'; end if;
    update public.wallets set balance = balance - p_amount, total_expenses = total_expenses + p_amount,
      updated_at = now() where id = wallet.id returning * into wallet;
    update public.characters set wealth = least(100, 10 + (wallet.balance / 10000)::int) where id = cid;
    insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description)
      values (auth.uid(),wallet.id,cid,p_amount,'expense','tithe','Tithe at ' || place.name);
    result := jsonb_build_object('action','tithe','amount',p_amount,'balance',wallet.balance,'message','Tithe recorded.');
  elsif p_action = 'file_complaint' and place.slug = 'osogbo-high-court' then
    if p_target_character_id is null or p_target_character_id = cid then raise exception 'Choose another player for this fictional case'; end if;
    if p_details is null or char_length(trim(p_details)) not between 20 and 500 then raise exception 'Write a summary between 20 and 500 characters'; end if;
    if not exists(select 1 from public.characters where id = p_target_character_id) then raise exception 'That player could not be found'; end if;
    insert into public.city_civic_cases(location_id,claimant_character_id,respondent_character_id,summary,filed_game_day)
      values (place.id,cid,p_target_character_id,trim(p_details),player.game_day) returning id into case_id;
    result := jsonb_build_object('action','file_complaint','case_id',case_id,'message','Your fictional in-game complaint was filed.');
  else
    raise exception 'That activity is not available at this location';
  end if;

  update public.location_activity_requests set response = result
    where character_id = cid and request_id = p_request_id;
  return result;
end $$;
revoke execute on function public.perform_location_activity(uuid,text,uuid,bigint,uuid,text) from public, anon;
grant execute on function public.perform_location_activity(uuid,text,uuid,bigint,uuid,text) to authenticated;

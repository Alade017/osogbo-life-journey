alter table public.characters drop constraint if exists characters_age_check;
alter table public.characters add constraint characters_age_check check (age between 16 and 60);
alter table public.characters
  add column current_location_id uuid references public.locations(id),
  add column hunger integer not null default 20 check (hunger between 0 and 100),
  add column stress integer not null default 10 check (stress between 0 and 100);

alter table public.locations
  add column travel_fare integer not null default 100 check (travel_fare between 0 and 10000),
  add column travel_minutes integer not null default 5 check (travel_minutes between 1 and 120);

update public.locations set travel_fare = case slug
  when 'city-centre' then 0 when 'oja-oba' then 150 when 'oke-fia' then 250
  when 'old-garage' then 200 when 'student-district' then 300 when 'residential' then 250
  when 'business-district' then 250 when 'cultural-district' then 300 else 500 end;
update public.locations set travel_minutes = case slug
  when 'city-centre' then 1 when 'oja-oba' then 4 when 'oke-fia' then 7
  when 'old-garage' then 5 when 'student-district' then 8 when 'residential' then 7
  when 'business-district' then 7 when 'cultural-district' then 9 else 15 end;

create table public.game_places (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  category text not null,
  description text not null,
  origin text not null default 'fictional' check (origin in ('fictional','real-world-inspired')),
  disclosure text,
  meal_price integer check (meal_price is null or meal_price > 0),
  hunger_restore integer not null default 0 check (hunger_restore between 0 and 100),
  happiness_gain integer not null default 0 check (happiness_gain between 0 and 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, location_id)
);
grant select on public.game_places to authenticated;
grant all on public.game_places to service_role;
alter table public.game_places enable row level security;
create policy "game places readable" on public.game_places for select to authenticated using (true);

alter table public.jobs
  add column location_id uuid references public.locations(id),
  add column place_id uuid references public.game_places(id),
  add column is_available boolean not null default true;

create or replace function public._set_character_start_location() returns trigger
language plpgsql security definer set search_path = public as $$
declare start_location_id uuid;
begin
  if new.current_location_id is null then
    select id into start_location_id from public.locations where slug = 'city-centre';
    new.current_location_id := start_location_id;
  end if;
  return new;
end $$;
create trigger t_character_start_location before insert on public.characters
  for each row execute function public._set_character_start_location();
update public.characters set current_location_id = (select id from public.locations where slug = 'city-centre')
  where current_location_id is null;

insert into public.game_places (slug, location_id, name, category, description, origin, disclosure, sort_order)
select seed.slug, loc.id, seed.name, seed.category, seed.description, seed.origin, seed.disclosure, seed.sort_order
from (values
  ('city-centre-office','city-centre','Central Office','office','A fictional office for entry-level administrative work.','fictional',null,1),
  ('city-centre-market','city-centre','Roundabout Provisions','supermarket','A fictional neighbourhood provisions shop.','fictional',null,2),
  ('oja-oba-market','oja-oba','Oja Oba Market Stalls','market','A fictionalized market setting inspired by the popular Osogbo market area.','fictional',null,1),
  ('oke-fia-eatery','oke-fia','Hilltop Kitchen','restaurant','A fictional local restaurant serving everyday meals.','fictional',null,1),
  ('oke-fia-salon','oke-fia','Fresh Look Salon','salon','A fictional neighbourhood salon.','fictional',null,2),
  ('old-garage-terminal','old-garage','Old Garage Motor Park','transport','A fictionalized transport terminal in the Old Garage district.','fictional',null,1),
  ('old-garage-workshop','old-garage','Wheels & Wrenches Workshop','workshop','A fictional vehicle repair workshop.','fictional',null,2),
  ('student-campus','student-district','Campus Learning Centre','education','A fictional learning centre for lessons and study.','fictional',null,1),
  ('elegance-tech-hub','student-district','Elegance Tech Hub','technology','A real-world-inspired Osogbo technology hub described as teaching technology skills, selling phones and laptops, and repairing phones and laptops.','real-world-inspired','Independent game depiction; OSOGBO LIFE is not affiliated with this business.',2),
  ('student-cyber-cafe','student-district','Campus Cyber Cafe','internet-cafe','A fictional student cyber cafe.','fictional',null,3),
  ('student-library','student-district','Reading Room Library','library','A fictional study library for students.','fictional',null,4),
  ('student-tutorial-centre','student-district','Bright Steps Tutorial Centre','education','A fictional tutorial and study centre.','fictional',null,5),
  ('residential-apartments','residential','Neighbourhood Apartments','residential','A fictional residential area.','fictional',null,1),
  ('residential-gra','residential','Hillview Estate','residential','A fictional GRA-style residential neighbourhood.','fictional',null,2),
  ('residential-laundry','residential','Fresh Fold Laundry','laundry','A fictional neighbourhood laundry service.','fictional',null,3),
  ('business-tech-office','business-district','Northstar Digital','technology','A fictional local technology company.','fictional',null,1),
  ('city-centre-bank','city-centre','Osun Unity Bank','bank','A fictional in-game bank; not a real financial institution.','fictional',null,3),
  ('city-centre-atm','city-centre','Central ATM Point','atm','A fictional ATM location.','fictional',null,4),
  ('city-centre-hospital','city-centre','General Care Clinic','hospital','A fictional public health clinic.','fictional',null,5),
  ('city-centre-police','city-centre','Central Police Station','public-service','A fictional public service location.','fictional',null,6),
  ('city-centre-court','city-centre','Civic Court','public-service','A fictional court location.','fictional',null,7),
  ('city-centre-government','city-centre','City Administration Office','government','A fictional local government office.','fictional',null,8),
  ('city-centre-fire','city-centre','Central Fire Service','public-service','A fictional fire and emergency service location.','fictional',null,9),
  ('city-centre-supermarket','city-centre','Green Basket Supermarket','supermarket','A fictional neighbourhood supermarket.','fictional',null,10),
  ('oja-oba-pos','oja-oba','Market POS Corner','financial-service','A fictional point-of-sale service location.','fictional',null,2),
  ('oja-oba-electronics','oja-oba','Market Electronics Row','electronics','A fictional electronics shop in the market district.','fictional',null,3),
  ('oja-oba-fashion','oja-oba','Indigo Threads Fashion','clothing','A fictional clothing and fashion shop.','fictional',null,4),
  ('oja-oba-foodstuff','oja-oba','Daily Harvest Foodstuff Store','food-market','A fictional foodstuff shop.','fictional',null,5),
  ('oke-fia-suya','oke-fia','Evening Suya Spot','food','A fictional suya stall.','fictional',null,3),
  ('oke-fia-fast-food','oke-fia','Quick Bite Kitchen','restaurant','A fictional shawarma and fast-food spot.','fictional',null,4),
  ('oke-fia-barber','oke-fia','Sharp Line Barbershop','barbershop','A fictional neighbourhood barbershop.','fictional',null,5),
  ('oke-fia-gym','oke-fia','Hilltop Fitness Gym','gym','A fictional neighbourhood gym.','fictional',null,6),
  ('oke-fia-gaming','oke-fia','Level Up Gaming Centre','gaming','A fictional gaming centre.','fictional',null,7),
  ('cultural-photo-studio','cultural-district','Frame & Focus Studio','photography','A fictional photography studio.','fictional',null,1),
  ('cultural-arts-centre','cultural-district','Riverlight Arts Centre','culture','A fictional arts and recreation venue inspired by Osogbo culture.','fictional',null,2),
  ('cultural-football-field','cultural-district','Community Football Field','sports','A fictional community football field.','fictional',null,3),
  ('cultural-park','cultural-district','Riverside Green Park','recreation','A fictional park inspired by the Osun River area.','fictional',null,4),
  ('cultural-event-centre','cultural-district','Festival Grounds','events','A fictional cultural event and festival venue.','fictional',null,5),
  ('old-garage-taxi','old-garage','Garage Taxi Rank','transport','A fictional taxi rank.','fictional',null,3),
  ('old-garage-dealership','old-garage','RoadReady Motors','vehicle-sales','A fictional vehicle dealership.','fictional',null,4),
  ('rural-village','rural-outskirts','Ile-Ayo Village','village','A fictional village on the rural outskirts.','fictional',null,2)
) as seed(slug, location_slug, name, category, description, origin, disclosure, sort_order)
join public.locations loc on loc.slug = seed.location_slug
on conflict (slug) do nothing;

update public.game_places set meal_price = 650, hunger_restore = 25, happiness_gain = 4 where slug = 'oke-fia-eatery';
update public.game_places set meal_price = 400, hunger_restore = 15, happiness_gain = 3 where slug = 'oke-fia-suya';
update public.game_places set meal_price = 850, hunger_restore = 30, happiness_gain = 4 where slug in ('oke-fia-fast-food','oke-fia-shawarma');

update public.jobs j set
  location_id = loc.id,
  place_id = p.id
from (values
  ('shop_assistant','city-centre','city-centre-market'),
  ('delivery_rider','old-garage','old-garage-terminal'),
  ('food_vendor','oja-oba','oja-oba-market'),
  ('photographer','cultural-district','cultural-photo-studio'),
  ('mechanic','old-garage','old-garage-workshop'),
  ('teacher','student-district','student-campus'),
  ('graphic_designer','student-district','elegance-tech-hub'),
  ('web_developer','student-district','elegance-tech-hub')
) as assignment(job_slug, location_slug, place_slug)
join public.locations loc on loc.slug = assignment.location_slug
join public.game_places p on p.slug = assignment.place_slug
where j.slug = assignment.job_slug;

insert into public.jobs
  (slug, name, description, salary, energy_cost, required_level, cooldown_minutes, xp_reward, stat_bonus, icon, sort_order, location_id, place_id)
select seed.slug, seed.name, seed.description, seed.salary, seed.energy_cost, seed.required_level,
  seed.cooldown_minutes, seed.xp_reward, seed.stat_bonus, seed.icon, seed.sort_order, loc.id, p.id
from (values
  ('computer_assistant','Computer Assistant','Help visitors use computers and learn basic digital skills.',4500,18,1,10,25,'intelligence','monitor',20,'student-district','elegance-tech-hub'),
  ('tech_support_assistant','Tech Support Assistant','Assist with everyday device support requests.',6500,24,2,20,35,'career','headset',21,'student-district','elegance-tech-hub'),
  ('junior_developer','Junior Developer','Build and test small features with a local team.',10000,30,3,30,45,'intelligence','code',22,'student-district','elegance-tech-hub'),
  ('graphic_design_assistant','Graphic Design Assistant','Prepare simple visual assets for local projects.',6500,24,2,20,35,'intelligence','palette',23,'student-district','elegance-tech-hub'),
  ('tech_store_assistant','Tech Store Assistant','Help customers compare phones and laptops.',5000,20,1,15,28,'social','smartphone',24,'student-district','elegance-tech-hub'),
  ('device_repair_assistant','Device Repair Assistant','Support phone and laptop repair work under supervision.',6000,24,2,20,35,'career','wrench',25,'student-district','elegance-tech-hub'),
  ('waiter','Waiter','Welcome diners and help serve meals at a local restaurant.',4000,18,1,10,24,'social','utensils',26,'oke-fia','oke-fia-eatery'),
  ('cook','Cook','Prepare meals for the restaurant service.',5000,25,1,15,28,'career','chef-hat',27,'oke-fia','oke-fia-eatery'),
  ('restaurant_cashier','Restaurant Cashier','Handle orders and payments at the counter.',4200,16,1,10,24,'career','receipt',28,'oke-fia','oke-fia-eatery'),
  ('office_assistant','Office Assistant','Help a small office with filing and daily tasks.',4500,16,1,12,25,'career','briefcase',29,'city-centre','city-centre-office'),
  ('stock_assistant','Stock Assistant','Receive and organize provisions at a local shop.',3800,20,1,12,22,'career','package',30,'city-centre','city-centre-market'),
  ('apprentice_barber','Apprentice Barber','Learn the trade while assisting at a neighbourhood salon.',3500,18,1,12,22,'career','scissors',31,'oke-fia','oke-fia-salon'),
  ('photographer_assistant','Photographer Assistant','Prepare equipment and assist with local shoots.',4000,18,1,12,24,'reputation','camera',32,'cultural-district','cultural-photo-studio'),
  ('farm_assistant','Farm Assistant','Help with daily work at a small outskirts farm.',4200,25,1,15,24,'health','sprout',33,'rural-outskirts','rural-farm')
) as seed(slug, name, description, salary, energy_cost, required_level, cooldown_minutes, xp_reward, stat_bonus, icon, sort_order, location_slug, place_slug)
join public.locations loc on loc.slug = seed.location_slug
join public.game_places p on p.slug = seed.place_slug
on conflict (slug) do nothing;

insert into public.game_places (slug, location_id, name, category, description, origin, disclosure, sort_order)
select seed.slug, loc.id, seed.name, seed.category, seed.description, 'fictional', null, seed.sort_order
from (values
  ('market-sales-stall','oja-oba','Market Sales Stall','market','A fictional market stall selling everyday goods.',6),
  ('city-phone-store','city-centre','Pocket Tech Phones','phone-store','A fictional phone shop.',11),
  ('student-computer-shop','student-district','Campus Computer Shop','electronics','A fictional computer and IT shop.',6),
  ('oke-fia-shawarma','oke-fia','Quick Bite Kitchen','restaurant','A fictional shawarma and fast-food spot.',8),
  ('residential-fashion','residential','Everyday Fashion Store','clothing','A fictional clothing shop.',4),
  ('residential-tailor','residential','Needle & Thread Tailoring','tailor','A fictional tailoring and fashion design shop.',5),
  ('old-garage-service-yard','old-garage','Vehicle Service Yard','workshop','A fictional mechanic service and vehicle workshop.',5)
) as seed(slug, location_slug, name, category, description, sort_order)
join public.locations loc on loc.slug = seed.location_slug
on conflict (slug) do nothing;

update public.game_places set meal_price = 850, hunger_restore = 30, happiness_gain = 4 where slug = 'oke-fia-shawarma';

insert into public.jobs
  (slug, name, description, salary, energy_cost, required_level, cooldown_minutes, xp_reward, stat_bonus, icon, sort_order, location_id, place_id)
select seed.slug, seed.name, seed.description, seed.salary, seed.energy_cost, seed.required_level,
  seed.cooldown_minutes, seed.xp_reward, seed.stat_bonus, seed.icon, seed.sort_order, loc.id, p.id
from (values
  ('computer_instructor','Computer Instructor','Guide learners through introductory computer skills.',7000,22,2,20,36,'intelligence','monitor',34,'student-district','elegance-tech-hub'),
  ('market_sales_assistant','Market Sales Assistant','Help serve customers at a market stall.',3500,18,1,10,22,'social','store',35,'oja-oba','market-sales-stall'),
  ('phone_sales_assistant','Phone Sales Assistant','Help customers browse phones at a local shop.',4200,18,1,12,24,'social','smartphone',36,'city-centre','city-phone-store'),
  ('computer_shop_assistant','Computer Shop Assistant','Help organize computer products at a fictional IT shop.',4500,18,1,12,24,'social','monitor',37,'student-district','student-computer-shop'),
  ('tailor_apprentice','Tailor Apprentice','Assist with measurements and garment preparation.',3800,20,1,12,23,'career','scissors',38,'residential','residential-tailor'),
  ('shawarma_cashier','Fast Food Cashier','Take orders and handle counter service.',4000,16,1,10,22,'social','receipt',39,'oke-fia','oke-fia-shawarma'),
  ('workshop_assistant','Workshop Assistant','Support the mechanics with tools and workshop tasks.',4500,24,1,14,25,'career','wrench',40,'old-garage','old-garage-service-yard')
) as seed(slug, name, description, salary, energy_cost, required_level, cooldown_minutes, xp_reward, stat_bonus, icon, sort_order, location_slug, place_slug)
join public.locations loc on loc.slug = seed.location_slug
join public.game_places p on p.slug = seed.place_slug
on conflict (slug) do nothing;

alter table public.jobs add constraint jobs_place_location_fkey
  foreign key (place_id, location_id) references public.game_places(id, location_id);

update public.education_courses set provider = 'Elegance Tech Hub'
  where slug in ('coding-bootcamp','graphic-design');
insert into public.education_courses
  (slug, name, provider, description, tuition, energy_cost, intelligence_gain, career_gain, sort_order)
values
  ('computer-skills','Computer Skills','Elegance Tech Hub','Build confidence with everyday computer use and essential digital skills.',1800,15,4,2,5)
on conflict (slug) do nothing;

insert into public.missions (slug, title, description, target, reward_money, reward_xp, sort_order) values
  ('visit_oja_oba','Visit Oja Oba','Travel to the Oja Oba district.',1,500,10,6),
  ('visit_elegance_tech_hub','Visit the Student District','Explore the Student District and its learning venues.',1,500,10,7),
  ('complete_first_training','Complete your first course','Finish a course at the Student District.',1,1000,20,8)
on conflict (slug) do nothing;

insert into public.player_missions (user_id, character_id, mission_id)
select c.user_id, c.id, m.id from public.characters c cross join public.missions m
on conflict (character_id, mission_id) do nothing;

create or replace function public._recalc_missions(p_char uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r record; v int;
begin
  for r in select pm.id, m.slug, m.target, m.title from public.player_missions pm
           join public.missions m on m.id = pm.mission_id
           where pm.character_id = p_char and pm.status = 'in_progress' loop
    v := case r.slug
      when 'first_job' then (select count(*) from public.character_jobs where character_id = p_char)
      when 'earn_10000' then (select coalesce(sum(amount),0) from public.transactions where character_id = p_char and category = 'job')
      when 'visit_3_locations' then (select count(*) from public.location_visits where character_id = p_char)
      when 'complete_3_jobs' then (select coalesce(sum(times_performed),0) from public.character_jobs where character_id = p_char)
      when 'reach_level_2' then (select level from public.characters where id = p_char)
      when 'visit_oja_oba' then (select count(*) from public.location_visits lv join public.locations l on l.id = lv.location_id where lv.character_id = p_char and l.slug = 'oja-oba')
      when 'visit_elegance_tech_hub' then (select count(*) from public.location_visits lv join public.locations l on l.id = lv.location_id where lv.character_id = p_char and l.slug = 'student-district')
      when 'complete_first_training' then (select count(*) from public.player_courses where character_id = p_char)
      else 0 end;
    update public.player_missions
      set progress = least(v, r.target),
          status = case when v >= r.target then 'completed' else status end,
          completed_at = case when v >= r.target then now() else completed_at end
      where id = r.id;
    if v >= r.target then
      perform public._notify(p_char, 'Mission complete: ' || r.title, 'Open Missions to claim your reward.', 'mission');
    end if;
  end loop;
end $$;

create or replace function public.travel_to_location(p_location_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
  destination public.locations%rowtype;
  payment public.wallets%rowtype;
  first_visit boolean;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid for update;
  select * into destination from public.locations where id = p_location_id;
  if not found then raise exception 'Location not found'; end if;
  if player.current_location_id = destination.id then raise exception 'You are already in this district'; end if;

  if destination.travel_fare > 0 then
    update public.wallets set balance = balance - destination.travel_fare,
      total_expenses = total_expenses + destination.travel_fare
      where character_id = cid and balance >= destination.travel_fare returning * into payment;
    if not found then raise exception 'Not enough in-game Naira for this fare (need %)', destination.travel_fare; end if;
    insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
      values (auth.uid(), payment.id, cid, destination.travel_fare, 'expense', 'travel', 'Travel to ' || destination.name);
    update public.characters set wealth = least(100, 10 + (payment.balance / 10000)::int) where id = cid;
  end if;

  first_visit := not exists (select 1 from public.location_visits where character_id = cid and location_id = destination.id);
  update public.characters set current_location_id = destination.id,
    stress = least(100, stress + case when destination.travel_minutes >= 10 then 2 else 1 end)
    where id = cid;
  insert into public.location_visits(user_id, character_id, location_id)
    values (auth.uid(), cid, destination.id)
    on conflict (character_id, location_id) do update
      set visit_count = location_visits.visit_count + 1, last_visited_at = now();
  if first_visit then
    perform public._grant_xp(cid, 10);
    perform public._notify(cid, 'Discovered ' || destination.name, '+10 XP for exploring a new district.', 'explore');
  end if;
  perform public._recalc_missions(cid);
  return jsonb_build_object('location', destination.name, 'fare', destination.travel_fare,
    'travel_minutes', destination.travel_minutes, 'first_visit', first_visit);
end $$;

create or replace function public.eat_at_place(p_place_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  player public.characters%rowtype;
  venue public.game_places%rowtype;
  payment public.wallets%rowtype;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid for update;
  select * into venue from public.game_places where id = p_place_id;
  if not found then raise exception 'Food place not found'; end if;
  if venue.meal_price is null then raise exception 'This venue does not serve meals'; end if;
  if player.current_location_id <> venue.location_id then raise exception 'Travel to this district before ordering'; end if;
  update public.wallets set balance = balance - venue.meal_price,
    total_expenses = total_expenses + venue.meal_price
    where character_id = cid and balance >= venue.meal_price returning * into payment;
  if not found then raise exception 'Not enough in-game Naira (meal costs %)', venue.meal_price; end if;
  update public.characters set
    hunger = greatest(0, hunger - venue.hunger_restore),
    happiness = least(100, happiness + venue.happiness_gain),
    wealth = least(100, 10 + (payment.balance / 10000)::int)
    where id = cid;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values (auth.uid(), payment.id, cid, venue.meal_price, 'expense', 'food', 'Meal at ' || venue.name);
  return jsonb_build_object('venue', venue.name, 'cost', venue.meal_price,
    'hunger_restored', venue.hunger_restore, 'happiness_gained', venue.happiness_gain);
end $$;

create or replace function public.select_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); j record; player public.characters%rowtype;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into j from public.jobs where id = p_job_id and is_available;
  if not found then raise exception 'Job is unavailable'; end if;
  select * into player from public.characters where id = cid for update;
  if player.level < j.required_level then raise exception 'Requires level %', j.required_level; end if;
  if j.location_id is not null and player.current_location_id <> j.location_id then
    raise exception 'Travel to % to apply for this job', (select name from public.locations where id = j.location_id);
  end if;
  if not public._course_completed(cid, j.required_course_slug) then
    raise exception 'Complete % to qualify for this job', (select name from public.education_courses where slug = j.required_course_slug);
  end if;
  update public.character_jobs set is_current = false where character_id = cid and is_current and job_id <> p_job_id;
  insert into public.character_jobs(user_id, character_id, job_id, is_current)
    values (auth.uid(), cid, p_job_id, true)
    on conflict (character_id, job_id) do update set is_current = true;
  perform public._notify(cid, 'You are now a ' || j.name, 'Perform shifts at ' || coalesce((select name from public.game_places where id = j.place_id), 'your job location') || '.', 'job');
  perform public._recalc_missions(cid);
end $$;

create or replace function public.perform_job() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  cid uuid := public._my_character_id();
  cj record;
  j record;
  player public.characters%rowtype;
  e int;
  lvl int;
  ready_at timestamptz;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into player from public.characters where id = cid for update;
  select * into cj from public.character_jobs where character_id = cid and is_current for update;
  if not found then raise exception 'Select a job first'; end if;
  select * into j from public.jobs where id = cj.job_id and is_available;
  if not found then raise exception 'This job is no longer available'; end if;
  if j.location_id is not null and player.current_location_id <> j.location_id then
    raise exception 'Travel back to % before your next shift', (select name from public.locations where id = j.location_id);
  end if;
  if not public._course_completed(cid, j.required_course_slug) then
    raise exception 'Complete the required course before working this job';
  end if;
  ready_at := cj.last_performed_at + make_interval(mins => j.cooldown_minutes);
  if cj.last_performed_at is not null and now() < ready_at then raise exception 'Still on cooldown'; end if;
  e := public._refresh_energy(cid);
  if e < j.energy_cost then raise exception 'Not enough energy (need %)', j.energy_cost; end if;

  update public.characters set
    energy = energy - j.energy_cost,
    hunger = least(100, hunger + 5),
    stress = least(100, stress + 6),
    happiness = greatest(0, happiness - 1),
    career = least(100, career + 1),
    intelligence = case when j.stat_bonus = 'intelligence' then least(100, intelligence + 1) else intelligence end,
    social = case when j.stat_bonus = 'social' then least(100, social + 1) else social end,
    reputation = case when j.stat_bonus = 'reputation' then least(100, reputation + 1) else reputation end,
    health = case when j.energy_cost >= 30 then greatest(0, health - 1) else health end
  where id = cid;
  update public.character_jobs set times_performed = times_performed + 1, last_performed_at = now() where id = cj.id;
  perform public._credit(cid, j.salary, 'job', 'Completed ' || j.name || ' at ' || coalesce((select name from public.game_places where id = j.place_id), 'your workplace'));
  lvl := public._grant_xp(cid, j.xp_reward);
  perform public._recalc_missions(cid);
  return jsonb_build_object('earned', j.salary, 'xp', j.xp_reward, 'energy_spent', j.energy_cost,
    'hunger_gained', 5, 'stress_gained', 6, 'level', lvl);
end $$;

create or replace function public.create_character(
  p_name text, p_gender text, p_appearance jsonb, p_age int, p_personality text, p_occupation text
) returns uuid language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); cid uuid; wid uuid; appr jsonb; k text;
  b_int int := 10; b_soc int := 10; b_car int := 10; b_hap int := 70;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  if exists (select 1 from public.characters where user_id = uid) then raise exception 'You already have a character'; end if;
  p_name := btrim(p_name);
  if p_name is null or char_length(p_name) < 2 or char_length(p_name) > 24 then raise exception 'Name must be 2-24 characters'; end if;
  if p_age is null or p_age not between 16 and 60 then raise exception 'Age must be between 16 and 60'; end if;
  if p_occupation is not null and not exists (select 1 from public.jobs where slug = p_occupation) then raise exception 'Unknown occupation'; end if;
  appr := '{}'::jsonb;
  foreach k in array array['skin','hair','hairColor','outfit','bottoms','shoes','headwear'] loop
    if p_appearance ? k and jsonb_typeof(p_appearance->k) = 'number' and (p_appearance->>k)::int between 0 and 7 then
      appr := appr || jsonb_build_object(k, (p_appearance->>k)::int);
    else
      appr := appr || jsonb_build_object(k, 0);
    end if;
  end loop;
  case p_personality
    when 'ambitious' then b_car := 15;
    when 'creative' then b_int := 13; b_hap := 72;
    when 'social' then b_soc := 15;
    when 'studious' then b_int := 15;
    when 'easygoing' then b_hap := 75;
    else raise exception 'Unknown personality';
  end case;
  insert into public.profiles(id, display_name) values (uid, p_name) on conflict (id) do nothing;
  insert into public.characters(user_id, name, gender, appearance, age, personality, occupation_preference,
                                intelligence, social, career, happiness)
    values (uid, p_name, p_gender, appr, p_age, p_personality, p_occupation, b_int, b_soc, b_car, b_hap)
    returning id into cid;
  insert into public.wallets(user_id, character_id) values (uid, cid) returning id into wid;
  perform public._credit(cid, 5000, 'starting_grant', 'Welcome to Osogbo starter funds');
  insert into public.player_inventory(user_id, character_id, item_id)
    select uid, cid, id from public.inventory_items where slug in ('phone','backpack','basic_outfit','water_bottle');
  insert into public.player_missions(user_id, character_id, mission_id)
    select uid, cid, id from public.missions on conflict (character_id, mission_id) do nothing;
  perform public._notify(cid, 'Welcome to Osogbo, ' || p_name || '!', 'Head to the Jobs board to find your first job.', 'welcome');
  return cid;
end $$;

update public.jobs set required_course_slug = 'computer-skills' where slug = 'computer_instructor';

create or replace function public._player_course_recalc_missions() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public._recalc_missions(new.character_id);
  return new;
end $$;
create trigger t_player_course_recalc_missions after insert on public.player_courses
  for each row execute function public._player_course_recalc_missions();

revoke execute on function public._set_character_start_location() from public, anon, authenticated;
revoke execute on function public._player_course_recalc_missions() from public, anon, authenticated;
revoke execute on function public.create_character(text, text, jsonb, int, text, text) from public, anon;
grant execute on function public.create_character(text, text, jsonb, int, text, text) to authenticated;
revoke execute on function public.travel_to_location(uuid) from public, anon;
grant execute on function public.travel_to_location(uuid) to authenticated;
revoke execute on function public.eat_at_place(uuid) from public, anon;
grant execute on function public.eat_at_place(uuid) to authenticated;
revoke execute on function public.select_job(uuid) from public, anon;
grant execute on function public.select_job(uuid) to authenticated;
revoke execute on function public.perform_job() from public, anon;
grant execute on function public.perform_job() to authenticated;
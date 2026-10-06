-- ============ CATALOG TABLES ============
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  salary integer not null check (salary > 0),
  energy_cost integer not null check (energy_cost between 1 and 100),
  required_level integer not null default 1,
  cooldown_minutes integer not null default 5,
  xp_reward integer not null default 10,
  stat_bonus text not null default 'career' check (stat_bonus in ('intelligence','social','career','reputation','health','happiness')),
  icon text not null default 'briefcase',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.jobs to authenticated, anon;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "jobs readable" on public.jobs for select to authenticated, anon using (true);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text not null,
  description text not null,
  district_type text not null,
  map_x numeric not null,
  map_y numeric not null,
  color text not null default 'primary',
  planned_features text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.locations to authenticated, anon;
grant all on public.locations to service_role;
alter table public.locations enable row level security;
create policy "locations readable" on public.locations for select to authenticated, anon using (true);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  category text not null default 'gear',
  icon text not null default 'package',
  created_at timestamptz not null default now()
);
grant select on public.inventory_items to authenticated;
grant all on public.inventory_items to service_role;
alter table public.inventory_items enable row level security;
create policy "items readable" on public.inventory_items for select to authenticated using (true);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text not null,
  target integer not null check (target > 0),
  reward_money integer not null default 0,
  reward_xp integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
grant select on public.missions to authenticated;
grant all on public.missions to service_role;
alter table public.missions enable row level security;
create policy "missions readable" on public.missions for select to authenticated using (true);

-- ============ PLAYER TABLES ============
create table public.profiles (
  id uuid primary key,
  display_name text check (display_name is null or char_length(display_name) <= 40),
  reduced_motion boolean not null default false,
  sound_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 24),
  gender text not null check (gender in ('male','female','nonbinary')),
  appearance jsonb not null default '{}'::jsonb,
  age integer not null check (age between 18 and 60),
  personality text not null check (personality in ('ambitious','creative','social','studious','easygoing')),
  occupation_preference text references public.jobs(slug),
  level integer not null default 1,
  xp integer not null default 0,
  energy integer not null default 100,
  energy_updated_at timestamptz not null default now(),
  health integer not null default 100,
  happiness integer not null default 70,
  reputation integer not null default 10,
  intelligence integer not null default 10,
  social integer not null default 10,
  career integer not null default 10,
  wealth integer not null default 10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.characters to authenticated;
grant all on public.characters to service_role;
alter table public.characters enable row level security;
create policy "own character" on public.characters for select to authenticated using (user_id = auth.uid());

create table public.character_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  job_id uuid not null references public.jobs(id),
  is_current boolean not null default true,
  times_performed integer not null default 0,
  last_performed_at timestamptz,
  hired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, job_id)
);
create unique index one_current_job on public.character_jobs(character_id) where is_current;
grant select on public.character_jobs to authenticated;
grant all on public.character_jobs to service_role;
alter table public.character_jobs enable row level security;
create policy "own character_jobs" on public.character_jobs for select to authenticated using (user_id = auth.uid());

create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null unique references public.characters(id) on delete cascade,
  balance bigint not null default 0 check (balance >= 0),
  total_income bigint not null default 0,
  total_expenses bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.wallets to authenticated;
grant all on public.wallets to service_role;
alter table public.wallets enable row level security;
create policy "own wallet" on public.wallets for select to authenticated using (user_id = auth.uid());

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wallet_id uuid not null references public.wallets(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  amount bigint not null,
  kind text not null check (kind in ('income','expense')),
  category text not null,
  description text not null,
  created_at timestamptz not null default now()
);
create index on public.transactions(character_id, created_at desc);
grant select on public.transactions to authenticated;
grant all on public.transactions to service_role;
alter table public.transactions enable row level security;
create policy "own transactions" on public.transactions for select to authenticated using (user_id = auth.uid());

create table public.player_inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id uuid not null references public.inventory_items(id),
  quantity integer not null default 1 check (quantity >= 0),
  acquired_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (character_id, item_id)
);
grant select on public.player_inventory to authenticated;
grant all on public.player_inventory to service_role;
alter table public.player_inventory enable row level security;
create policy "own inventory" on public.player_inventory for select to authenticated using (user_id = auth.uid());

create table public.player_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  mission_id uuid not null references public.missions(id),
  progress integer not null default 0,
  status text not null default 'in_progress' check (status in ('in_progress','completed','claimed')),
  completed_at timestamptz,
  claimed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (character_id, mission_id)
);
grant select on public.player_missions to authenticated;
grant all on public.player_missions to service_role;
alter table public.player_missions enable row level security;
create policy "own missions" on public.player_missions for select to authenticated using (user_id = auth.uid());

create table public.location_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  location_id uuid not null references public.locations(id),
  visit_count integer not null default 1,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  unique (character_id, location_id)
);
grant select on public.location_visits to authenticated;
grant all on public.location_visits to service_role;
alter table public.location_visits enable row level security;
create policy "own visits" on public.location_visits for select to authenticated using (user_id = auth.uid());

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid references public.characters(id) on delete cascade,
  title text not null,
  body text not null,
  kind text not null default 'info',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);
grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;
create trigger t_profiles before update on public.profiles for each row execute function public.touch_updated_at();
create trigger t_characters before update on public.characters for each row execute function public.touch_updated_at();
create trigger t_cjobs before update on public.character_jobs for each row execute function public.touch_updated_at();
create trigger t_wallets before update on public.wallets for each row execute function public.touch_updated_at();
create trigger t_pmissions before update on public.player_missions for each row execute function public.touch_updated_at();

-- ============ INTERNAL HELPERS (not callable by clients) ============
create or replace function public._my_character_id() returns uuid language sql stable security definer set search_path = public as $$
  select id from public.characters where user_id = auth.uid()
$$;

create or replace function public._notify(p_char uuid, p_title text, p_body text, p_kind text default 'info') returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, character_id, title, body, kind)
  select user_id, id, p_title, p_body, p_kind from public.characters where id = p_char;
$$;

create or replace function public._refresh_energy(p_char uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare c record; gained int; new_e int;
begin
  select energy, energy_updated_at into c from public.characters where id = p_char for update;
  if c.energy >= 100 then
    update public.characters set energy_updated_at = now() where id = p_char;
    return c.energy;
  end if;
  gained := floor(extract(epoch from (now() - c.energy_updated_at)) / 120)::int; -- 1 energy / 2 min
  if gained <= 0 then return c.energy; end if;
  new_e := least(100, c.energy + gained);
  update public.characters
    set energy = new_e,
        energy_updated_at = case when new_e >= 100 then now() else c.energy_updated_at + make_interval(secs => gained * 120) end
    where id = p_char;
  return new_e;
end $$;

create or replace function public._credit(p_char uuid, p_amount bigint, p_category text, p_desc text) returns void
language plpgsql security definer set search_path = public as $$
declare w record;
begin
  update public.wallets set balance = balance + p_amount, total_income = total_income + p_amount
    where character_id = p_char returning * into w;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values (w.user_id, w.id, p_char, p_amount, 'income', p_category, p_desc);
  update public.characters set wealth = least(100, 10 + (w.balance / 10000)::int) where id = p_char;
end $$;

create or replace function public._grant_xp(p_char uuid, p_xp int) returns integer
language plpgsql security definer set search_path = public as $$
declare old_lvl int; new_xp int; new_lvl int;
begin
  select level, xp + p_xp into old_lvl, new_xp from public.characters where id = p_char for update;
  new_lvl := 1 + (new_xp / 150);
  update public.characters set xp = new_xp, level = new_lvl,
    happiness = case when new_lvl > old_lvl then least(100, happiness + 5) else happiness end
    where id = p_char;
  if new_lvl > old_lvl then
    perform public._notify(p_char, 'Level up! You reached Level ' || new_lvl, 'New jobs may now be available in the Jobs board.', 'level');
  end if;
  return new_lvl;
end $$;

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

-- ============ PUBLIC GAME RPCs (server-validated actions) ============
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
  if p_occupation is not null and not exists (select 1 from public.jobs where slug = p_occupation) then raise exception 'Unknown occupation'; end if;
  -- whitelist appearance keys, each an integer 0..7
  appr := '{}'::jsonb;
  foreach k in array array['skin','hair','hairColor','outfit','headwear'] loop
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
    select uid, cid, id from public.missions;
  perform public._notify(cid, 'Welcome to Osogbo, ' || p_name || '!', 'Head to the Jobs board to find your first job.', 'welcome');
  return cid;
end $$;

create or replace function public.refresh_my_energy() returns integer
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id();
begin
  if cid is null then raise exception 'No character'; end if;
  return public._refresh_energy(cid);
end $$;

create or replace function public.select_job(p_job_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); j record; lvl int; jname text;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into j from public.jobs where id = p_job_id;
  if not found then raise exception 'Job not found'; end if;
  select level into lvl from public.characters where id = cid;
  if lvl < j.required_level then raise exception 'Requires level %', j.required_level; end if;
  update public.character_jobs set is_current = false where character_id = cid and is_current and job_id <> p_job_id;
  insert into public.character_jobs(user_id, character_id, job_id, is_current)
    values (auth.uid(), cid, p_job_id, true)
    on conflict (character_id, job_id) do update set is_current = true;
  perform public._notify(cid, 'You are now a ' || j.name, 'Perform shifts from the Jobs board to earn ₦.', 'job');
  perform public._recalc_missions(cid);
end $$;

create or replace function public.perform_job() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); cj record; j record; e int; lvl int; ready_at timestamptz;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into cj from public.character_jobs where character_id = cid and is_current for update;
  if not found then raise exception 'Select a job first'; end if;
  select * into j from public.jobs where id = cj.job_id;
  ready_at := cj.last_performed_at + make_interval(mins => j.cooldown_minutes);
  if cj.last_performed_at is not null and now() < ready_at then
    raise exception 'Still on cooldown';
  end if;
  e := public._refresh_energy(cid);
  if e < j.energy_cost then raise exception 'Not enough energy (need %)', j.energy_cost; end if;

  update public.characters set
    energy = energy - j.energy_cost,
    career = least(100, career + 1),
    intelligence = case when j.stat_bonus = 'intelligence' then least(100, intelligence + 1) else intelligence end,
    social = case when j.stat_bonus = 'social' then least(100, social + 1) else social end,
    reputation = case when j.stat_bonus = 'reputation' then least(100, reputation + 1) else reputation end,
    health = case when j.energy_cost >= 30 then greatest(0, health - 1) else health end
  where id = cid;
  update public.character_jobs set times_performed = times_performed + 1, last_performed_at = now() where id = cj.id;
  perform public._credit(cid, j.salary, 'job', 'Shift as ' || j.name);
  lvl := public._grant_xp(cid, j.xp_reward);
  perform public._recalc_missions(cid);
  return jsonb_build_object('earned', j.salary, 'xp', j.xp_reward, 'energy_spent', j.energy_cost, 'level', lvl);
end $$;

create or replace function public.visit_location(p_location_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); first_visit boolean; loc record;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into loc from public.locations where id = p_location_id;
  if not found then raise exception 'Location not found'; end if;
  first_visit := not exists (select 1 from public.location_visits where character_id = cid and location_id = p_location_id);
  insert into public.location_visits(user_id, character_id, location_id) values (auth.uid(), cid, p_location_id)
    on conflict (character_id, location_id) do update set visit_count = location_visits.visit_count + 1, last_visited_at = now();
  if first_visit then
    perform public._grant_xp(cid, 10);
    perform public._notify(cid, 'Discovered ' || loc.name, '+10 XP for exploring a new part of the city.', 'explore');
    perform public._recalc_missions(cid);
  end if;
  return jsonb_build_object('first_visit', first_visit);
end $$;

create or replace function public.claim_mission(p_player_mission_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cid uuid := public._my_character_id(); pm record; m record;
begin
  if cid is null then raise exception 'No character'; end if;
  select * into pm from public.player_missions where id = p_player_mission_id and character_id = cid for update;
  if not found then raise exception 'Mission not found'; end if;
  if pm.status <> 'completed' then raise exception 'Mission not ready to claim'; end if;
  select * into m from public.missions where id = pm.mission_id;
  update public.player_missions set status = 'claimed', claimed_at = now() where id = pm.id;
  if m.reward_money > 0 then perform public._credit(cid, m.reward_money, 'mission_reward', 'Mission reward: ' || m.title); end if;
  if m.reward_xp > 0 then perform public._grant_xp(cid, m.reward_xp); end if;
  perform public._recalc_missions(cid);
  return jsonb_build_object('money', m.reward_money, 'xp', m.reward_xp);
end $$;

create or replace function public.mark_notifications_read(p_id uuid default null) returns void
language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_id is null or id = p_id);
$$;

-- lock down helpers
revoke execute on function public._my_character_id() from public, anon, authenticated;
revoke execute on function public._notify(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public._refresh_energy(uuid) from public, anon, authenticated;
revoke execute on function public._credit(uuid, bigint, text, text) from public, anon, authenticated;
revoke execute on function public._grant_xp(uuid, int) from public, anon, authenticated;
revoke execute on function public._recalc_missions(uuid) from public, anon, authenticated;
revoke execute on function public.create_character(text, text, jsonb, int, text, text) from public, anon;
revoke execute on function public.refresh_my_energy() from public, anon;
revoke execute on function public.select_job(uuid) from public, anon;
revoke execute on function public.perform_job() from public, anon;
revoke execute on function public.visit_location(uuid) from public, anon;
revoke execute on function public.claim_mission(uuid) from public, anon;
revoke execute on function public.mark_notifications_read(uuid) from public, anon;
grant execute on function public.create_character(text, text, jsonb, int, text, text) to authenticated;
grant execute on function public.refresh_my_energy() to authenticated;
grant execute on function public.select_job(uuid) to authenticated;
grant execute on function public.perform_job() to authenticated;
grant execute on function public.visit_location(uuid) to authenticated;
grant execute on function public.claim_mission(uuid) to authenticated;
grant execute on function public.mark_notifications_read(uuid) to authenticated;

-- ============ SEED CATALOG ============
insert into public.jobs (slug, name, description, salary, energy_cost, required_level, cooldown_minutes, xp_reward, stat_bonus, icon, sort_order) values
('shop_assistant','Shop Assistant','Arrange shelves and serve customers at a busy provisions store near City Centre.',2500,15,1,5,20,'social','store',1),
('delivery_rider','Delivery Rider','Zip parcels and food orders across Osogbo on a dispatch bike.',3500,25,1,10,25,'reputation','bike',2),
('food_vendor','Food Vendor','Sell hot amala, ewedu and puff-puff from a roadside stall.',3000,20,1,8,20,'social','utensils',3),
('photographer','Photographer','Shoot owambe parties, portraits and festival moments.',6000,25,2,20,35,'reputation','camera',4),
('mechanic','Mechanic','Fix danfos, okadas and family cars at Old Garage.',7000,35,2,25,35,'career','wrench',5),
('teacher','Teacher','Teach lessons at a secondary school in the Student District.',8000,30,3,30,40,'intelligence','graduation-cap',6),
('graphic_designer','Graphic Designer','Design flyers, logos and church banners for local clients.',10000,30,3,35,45,'intelligence','palette',7),
('web_developer','Web Developer','Build websites and apps for growing Osogbo businesses.',15000,35,4,45,60,'intelligence','code',8);

insert into public.locations (slug, name, tagline, description, district_type, map_x, map_y, color, planned_features, sort_order) values
('city-centre','City Centre','The beating heart of town','Roundabouts, banks and government offices. Everyone passes through here sooner or later.','civic',50,45,'primary','{"Bank","Government office","Transport hub"}',1),
('oja-oba','Oja Oba','The king''s market','A sprawling market beside the palace — fabrics, spices, beads and endless bargaining.','market',36,30,'sun','{"Market stalls","Bargaining","Fabric shop"}',2),
('oke-fia','Oke-Fia','Hilltop neighbourhood','A lively neighbourhood on the rise, with shops, eateries and busy streets.','mixed',66,26,'clay','{"Eateries","Small shops","Gym"}',3),
('old-garage','Old Garage','Motor park and workshops','Buses, mechanics and roadside hustle. The city''s transport and repair hub.','industrial',22,58,'ink','{"Motor park","Workshops","Spare parts"}',4),
('student-district','Student District','Books, hostels and big dreams','Campus life, study groups, cybercafés and late-night suya runs.','education',78,52,'leaf','{"Library","Campus","Cybercafé"}',5),
('residential','Residential District','Home, sweet home','Quiet streets of bungalows and flats where most of Osogbo lives.','residential',38,72,'leaf','{"Housing","Rent","Neighbours"}',6),
('business-district','Business District','Offices and ambition','Glass-front offices, co-working hubs and startups on the rise.','business',62,68,'ink','{"Offices","Co-working","Interviews"}',7),
('cultural-district','Cultural District','Art, shrines and festival grounds','Inspired by Osogbo''s celebrated art scene and sacred grove — galleries, drums and festival days.','culture',16,24,'clay','{"Art gallery","Festival","Museum"}',8),
('rural-outskirts','Rural Outskirts','Farms and open roads','Farmland, palm groves and quiet villages at the edge of the city.','rural',86,82,'sun','{"Farming","Fishing","Village life"}',9);

insert into public.inventory_items (slug, name, description, category, icon) values
('phone','Phone','A trusty Android phone. Future phases will unlock calls and apps.','gadget','smartphone'),
('backpack','Backpack','Holds your essentials as you move around town.','gear','backpack'),
('basic_outfit','Basic Outfit','Clean shirt and trousers — ready for a first day at work.','clothing','shirt'),
('water_bottle','Water Bottle','Stay hydrated under the Osogbo sun.','consumable','glass-water');

insert into public.missions (slug, title, description, target, reward_money, reward_xp, sort_order) values
('first_job','Get your first job','Pick a job on the Jobs board.',1,1000,20,1),
('earn_10000','Earn your first ₦10,000','Earn ₦10,000 in total from job shifts.',10000,2000,40,2),
('visit_3_locations','Visit 3 locations','Explore three different districts on the City Map.',3,1500,30,3),
('complete_3_jobs','Complete 3 jobs','Finish three job shifts.',3,2000,40,4),
('reach_level_2','Reach Level 2','Gain enough XP to reach Level 2.',2,3000,0,5);

-- Server-owned data and atomic operations for map travel API endpoints.
create table public.map_districts (
  id text primary key,
  name text not null,
  layout_x integer not null,
  layout_y integer not null
);

insert into public.map_districts (id, name, layout_x, layout_y) values
  ('oja-oba', 'Oja Oba', 0, 0),
  ('ataoja', 'Ataoja', 300, 0),
  ('aleku-wodo', 'Alekuwodo', 600, 0),
  ('olaiya', 'Olaiya', 900, 0),
  ('oke-fia', 'Oke-Fia', 0, 390),
  ('oke-baale', 'Oke-Baale', 300, 390),
  ('isale-aro', 'Isale-Aro', 600, 390),
  ('ogo-oluwa', 'Ogo-Oluwa', 900, 390);

alter table public.characters
  add column is_adult boolean generated always as (age >= 18) stored,
  add column map_district_id text references public.map_districts(id);

create table public.map_location_districts (
  location_id uuid primary key references public.locations(id) on delete cascade,
  district_id text not null references public.map_districts(id)
);

insert into public.map_location_districts (location_id, district_id)
select location.id, mapping.district_id
from (values
  ('city-centre', 'olaiya'), ('oja-oba', 'oja-oba'), ('oke-fia', 'oke-fia'),
  ('old-garage', 'olaiya'), ('student-district', 'oke-baale'),
  ('residential', 'aleku-wodo'), ('business-district', 'aleku-wodo'),
  ('rural-outskirts', 'ogo-oluwa'), ('government-area', 'ataoja'),
  ('stadium', 'oke-fia'), ('state-hospital', 'oke-baale'),
  ('airport-terminal', 'olaiya'), ('oke-baale', 'oke-baale'),
  ('isale-osun', 'isale-aro'), ('atiku', 'aleku-wodo'),
  ('industrial-area', 'aleku-wodo'), ('osun-mall', 'isale-aro'),
  ('aiyegbaju-market', 'oja-oba'), ('osogbo-high-court', 'ataoja'),
  ('bola-ige-secretariat', 'ataoja'), ('mandela-freedom-park', 'ogo-oluwa'),
  ('osogbo-bank-district', 'ataoja'), ('adire-cloth-market', 'isale-aro')
) as mapping(slug, district_id)
join public.locations location on location.slug = mapping.slug
on conflict (location_id) do update set district_id = excluded.district_id;

update public.characters character
set map_district_id = coalesce(mapping.district_id, 'olaiya')
from (select id, current_location_id from public.characters) player
left join public.map_location_districts mapping on mapping.location_id = player.current_location_id
where character.id = player.id;

alter table public.characters alter column map_district_id set default 'olaiya';
alter table public.characters alter column map_district_id set not null;

create or replace function public._sync_character_map_district()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_location_id is distinct from old.current_location_id then
    new.map_district_id := coalesce(
      (select district_id from public.map_location_districts where location_id = new.current_location_id),
      new.map_district_id,
      'olaiya'
    );
  end if;
  return new;
end;
$$;
create trigger characters_sync_map_district
  before update of current_location_id on public.characters
  for each row execute function public._sync_character_map_district();

create table public.map_landmarks (
  id text primary key,
  district_id text not null references public.map_districts(id),
  location_id uuid references public.locations(id),
  min_age integer not null default 0 check (min_age between 0 and 120),
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.map_landmarks (id, district_id, location_id, is_available)
select seed.id, seed.district_id, location.id,
       coalesce(seed.playable and location.is_active, false)
from (values
  ('oja-oba-market', 'oja-oba', 'aiyegbaju-market', true),
  ('old-garage-park', 'oja-oba', 'old-garage', true),
  ('oja-oba-junction', 'oja-oba', 'oja-oba', true),
  ('ataoja-palace-area', 'ataoja', 'government-area', true),
  ('ataoja-community-school', 'ataoja', 'student-district', true),
  ('ataoja-junction', 'ataoja', 'city-centre', true),
  ('aleku-wodo-school', 'aleku-wodo', 'student-district', true),
  ('aleku-wodo-junction', 'aleku-wodo', 'residential', true),
  ('aleku-wodo-services', 'aleku-wodo', 'business-district', true),
  ('olaiya-junction', 'olaiya', 'city-centre', true),
  ('olaiya-park', 'olaiya', 'old-garage', true),
  ('olaiya-market', 'olaiya', 'aiyegbaju-market', true),
  ('oke-fia-station', 'oke-fia', 'old-garage', true),
  ('oke-fia-sports-ground', 'oke-fia', 'stadium', true),
  ('oke-fia-junction', 'oke-fia', 'oke-fia', true),
  ('oke-baale-school', 'oke-baale', 'student-district', true),
  ('oke-baale-health', 'oke-baale', 'state-hospital', true),
  ('oke-baale-junction', 'oke-baale', 'oke-baale', true),
  ('isale-aro-market', 'isale-aro', 'isale-osun', true),
  ('isale-aro-food', 'isale-aro', 'osun-mall', true),
  ('isale-aro-junction', 'isale-aro', 'isale-osun', true),
  ('ogo-oluwa-worship', 'ogo-oluwa', null, false),
  ('ogo-oluwa-sports-ground', 'ogo-oluwa', 'stadium', true),
  ('ogo-oluwa-junction', 'ogo-oluwa', 'rural-outskirts', true)
) as seed(id, district_id, location_slug, playable)
left join public.locations location on location.slug = seed.location_slug;

create table public.map_district_distances (
  from_district_id text not null references public.map_districts(id),
  to_district_id text not null references public.map_districts(id),
  distance_m integer not null check (distance_m between 1 and 100000),
  primary key (from_district_id, to_district_id)
);

insert into public.map_district_distances (from_district_id, to_district_id, distance_m)
select origin.id, destination.id,
       greatest(500, round(sqrt(power(origin.layout_x - destination.layout_x, 2)
         + power(origin.layout_y - destination.layout_y, 2)) * 10)::integer)
from public.map_districts origin cross join public.map_districts destination;

create table public.map_travels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 128),
  landmark_id text not null references public.map_landmarks(id),
  from_district_id text not null references public.map_districts(id),
  to_district_id text not null references public.map_districts(id),
  distance_m integer not null,
  fare bigint not null check (fare >= 0),
  travel_minutes integer not null check (travel_minutes > 0),
  departed_at timestamptz not null default now(),
  arrival_at timestamptz not null,
  status text not null default 'travelling' check (status in ('travelling', 'completed')),
  response jsonb not null,
  unique (user_id, idempotency_key)
);
create index map_travels_in_progress_idx on public.map_travels(character_id, arrival_at)
  where status = 'travelling';
alter table public.map_districts enable row level security;
alter table public.map_location_districts enable row level security;
alter table public.map_landmarks enable row level security;
alter table public.map_district_distances enable row level security;
alter table public.map_travels enable row level security;
revoke all on public.map_districts, public.map_location_districts,
  public.map_landmarks, public.map_district_distances
  from public, anon, authenticated;
grant select on public.map_districts, public.map_location_districts,
  public.map_landmarks, public.map_district_distances to service_role;
revoke all on public.map_travels from public, anon, authenticated;
grant all on public.map_travels to service_role;

create or replace function public._prevent_map_location_change_in_transit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.current_location_id is distinct from old.current_location_id
     and exists (select 1 from public.map_travels trip
       where trip.character_id = new.id and trip.status = 'travelling'
         and trip.arrival_at > clock_timestamp()) then
    raise exception using message = 'ALREADY_TRAVELLING', errcode = '55000';
  end if;
  return new;
end;
$$;
create trigger characters_prevent_map_location_change_in_transit
  before update of current_location_id on public.characters
  for each row execute function public._prevent_map_location_change_in_transit();

create table public.map_age_check_logs (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.profiles(id) on delete cascade,
  landmark_id text not null,
  checked_at timestamptz not null default now()
);
alter table public.map_age_check_logs enable row level security;
revoke all on public.map_age_check_logs from public, anon, authenticated;
grant all on public.map_age_check_logs to service_role;

create or replace function public.map_start_travel(
  p_user_id uuid,
  p_landmark_id text,
  p_idempotency_key text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  player public.characters%rowtype;
  destination public.map_landmarks%rowtype;
  route public.map_district_distances%rowtype;
  payment public.wallets%rowtype;
  prior public.map_travels%rowtype;
  active_trip public.map_travels%rowtype;
  completed_trip public.map_travels%rowtype;
  trip_fare bigint;
  trip_minutes integer;
  travel_id uuid := gen_random_uuid();
  started_at timestamptz := clock_timestamp();
  arrival timestamptz;
  response_payload jsonb;
begin
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then
    raise exception using message = 'INVALID_IDEMPOTENCY_KEY', errcode = '22023';
  end if;
  select * into player from public.characters where user_id = p_user_id for update;
  if not found then raise exception using message = 'NO_CHARACTER', errcode = 'P0002'; end if;

  select * into prior from public.map_travels
    where user_id = p_user_id and idempotency_key = p_idempotency_key;
  if found then
    if prior.landmark_id <> p_landmark_id then
      raise exception using message = 'IDEMPOTENCY_CONFLICT', errcode = '23505';
    end if;
    update public.map_travels set status = 'completed'
      where id = prior.id and status = 'travelling' and arrival_at <= started_at;
    return prior.response;
  end if;

  select * into completed_trip from public.map_travels
    where character_id = player.id and status = 'travelling' and arrival_at <= started_at
    order by arrival_at desc limit 1;
  if found then
    update public.characters set current_location_id = landmark.location_id,
        map_district_id = landmark.district_id
      from public.map_landmarks landmark
      where public.characters.id = player.id and landmark.id = completed_trip.landmark_id;
    update public.map_travels set status = 'completed'
      where character_id = player.id and status = 'travelling' and arrival_at <= started_at;
  end if;
  select landmark.* into destination from public.map_landmarks landmark
    join public.locations location on location.id = landmark.location_id and location.is_active
    where landmark.id = p_landmark_id and landmark.is_available;
  if not found then raise exception using message = 'UNKNOWN_LANDMARK', errcode = 'P0002'; end if;
  if destination.min_age >= 18 and not player.is_adult then
    raise exception using message = 'AGE_RESTRICTED', errcode = '42501';
  end if;
  select * into active_trip from public.map_travels
    where character_id = player.id and status = 'travelling' and arrival_at > started_at
    order by departed_at desc limit 1;
  if found then raise exception using message = 'ALREADY_TRAVELLING', errcode = '55000'; end if;
  select * into route from public.map_district_distances
    where from_district_id = player.map_district_id and to_district_id = destination.district_id;
  if not found then raise exception using message = 'UNKNOWN_LANDMARK', errcode = 'P0002'; end if;

  trip_minutes := greatest(1, ceil(route.distance_m::numeric / 250)::integer);
  trip_fare := greatest(50, ceil(route.distance_m::numeric / 30)::bigint);
  select * into payment from public.wallets
    where character_id = player.id and user_id = p_user_id for update;
  if not found or payment.balance < trip_fare then
    raise exception using message = 'INSUFFICIENT_FUNDS', errcode = 'P0001';
  end if;
  arrival := started_at + make_interval(mins => trip_minutes);
  update public.wallets set balance = balance - trip_fare,
      total_expenses = total_expenses + trip_fare, updated_at = started_at
    where id = payment.id returning * into payment;
  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description, metadata)
    values (p_user_id, payment.id, player.id, trip_fare, 'expense', 'travel',
      'Travel to map landmark ' || p_landmark_id,
      jsonb_build_object('landmark_id', p_landmark_id, 'distance_m', route.distance_m,
        'travel_minutes', trip_minutes, 'idempotency_key', p_idempotency_key));
  update public.characters set current_location_id = destination.location_id,
      map_district_id = destination.district_id
    where id = player.id;
  response_payload := jsonb_build_object(
    'travel_id', travel_id, 'landmark_id', destination.id,
    'fare', trip_fare, 'distance_m', route.distance_m,
    'travel_minutes', trip_minutes, 'departed_at', started_at,
    'arrival_at', arrival, 'status', 'travelling'
  );
  insert into public.map_travels(
    id, user_id, character_id, idempotency_key, landmark_id, from_district_id,
    to_district_id, distance_m, fare, travel_minutes, departed_at, arrival_at, response
  ) values (
    travel_id, p_user_id, player.id, p_idempotency_key, destination.id, player.map_district_id,
    destination.district_id, route.distance_m, trip_fare, trip_minutes, started_at, arrival, response_payload
  );
  return response_payload;
end;
$$;

create or replace function public.map_get_landmark_details(p_user_id uuid, p_landmark_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  player public.characters%rowtype;
  destination public.map_landmarks%rowtype;
  result jsonb;
begin
  select * into player from public.characters where user_id = p_user_id;
  if not found then raise exception using message = 'NO_CHARACTER', errcode = 'P0002'; end if;
  select landmark.* into destination from public.map_landmarks landmark
    join public.locations location on location.id = landmark.location_id and location.is_active
    where landmark.id = p_landmark_id and landmark.is_available;
  if not found then raise exception using message = 'UNKNOWN_LANDMARK', errcode = 'P0002'; end if;
  if destination.min_age >= 18 and not player.is_adult then
    raise exception using message = 'AGE_RESTRICTED', errcode = '42501';
  end if;
  select jsonb_build_object(
    'landmark', jsonb_build_object('id', destination.id, 'district_id', destination.district_id,
      'location_id', destination.location_id, 'min_age', destination.min_age,
      'name', location.name, 'description', location.description),
    'activities', coalesce((select jsonb_agg(to_jsonb(activity) order by activity.name)
      from public.activities activity where activity.location_id = location.id and activity.is_available), '[]'::jsonb),
    'jobs', coalesce((select jsonb_agg(to_jsonb(job) order by job.sort_order, job.name)
      from public.jobs job where job.location_id = location.id and job.is_available), '[]'::jsonb)
  ) into result
  from public.locations location where location.id = destination.location_id;
  return result;
end;
$$;

create or replace function public.map_log_age_check(p_player_id uuid, p_landmark_id text)
returns void language sql security definer set search_path = public as $$
  insert into public.map_age_check_logs(player_id, landmark_id, checked_at)
  values (p_player_id, p_landmark_id, clock_timestamp())
$$;

revoke all on function public.map_start_travel(uuid, text, text) from public, anon, authenticated;
revoke all on function public.map_get_landmark_details(uuid, text) from public, anon, authenticated;
revoke all on function public.map_log_age_check(uuid, text) from public, anon, authenticated;
revoke all on function public._sync_character_map_district() from public, anon, authenticated;
revoke all on function public._prevent_map_location_change_in_transit() from public, anon, authenticated;
grant execute on function public.map_start_travel(uuid, text, text) to service_role;
grant execute on function public.map_get_landmark_details(uuid, text) to service_role;
grant execute on function public.map_log_age_check(uuid, text) to service_role;
notify pgrst, 'reload schema';

create table if not exists public.osun_towns (
  id text primary key,
  name text not null,
  is_detailed boolean not null default false,
  travel_enabled boolean not null default false
);

insert into public.osun_towns(id,name,is_detailed,travel_enabled) values
  ('osogbo','Osogbo',true,true),
  ('ede','Ede',false,true),
  ('ile-ife','Ile-Ife',false,false),
  ('ilesa','Ilesa',false,false),
  ('iwo','Iwo',false,false),
  ('ikirun','Ikirun',false,false),
  ('ejigbo','Ejigbo',false,false),
  ('ila-orangun','Ila-Orangun',false,false)
on conflict(id) do update set name=excluded.name,is_detailed=excluded.is_detailed,
  travel_enabled=excluded.travel_enabled;

alter table public.osun_towns enable row level security;
revoke all on public.osun_towns from public,anon,authenticated;
grant select on public.osun_towns to service_role;

create table if not exists public.osun_town_routes (
  from_town_id text not null references public.osun_towns(id),
  to_town_id text not null references public.osun_towns(id),
  distance_units integer not null check(distance_units > 0),
  fare_minor bigint not null check(fare_minor >= 0),
  travel_minutes integer not null check(travel_minutes > 0),
  primary key(from_town_id,to_town_id),
  check(from_town_id <> to_town_id)
);
insert into public.osun_town_routes(from_town_id,to_town_id,distance_units,fare_minor,travel_minutes)
values ('osogbo','ede',19,1200,25),('ede','osogbo',19,1200,25)
on conflict(from_town_id,to_town_id) do update set distance_units=excluded.distance_units,
  fare_minor=excluded.fare_minor,travel_minutes=excluded.travel_minutes;
alter table public.osun_town_routes enable row level security;
revoke all on public.osun_town_routes from public,anon,authenticated;
grant select on public.osun_town_routes to service_role;

alter table public.characters add column if not exists current_town_id text
  references public.osun_towns(id) default 'osogbo';
update public.characters set current_town_id='osogbo' where current_town_id is null;
alter table public.characters alter column current_town_id set not null;

create table if not exists public.osun_town_travels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  idempotency_key text not null check(char_length(idempotency_key) between 16 and 128),
  from_town_id text not null references public.osun_towns(id),
  to_town_id text not null references public.osun_towns(id),
  fare_minor bigint not null,
  travel_minutes integer not null,
  departed_at timestamptz not null default now(),
  arrival_at timestamptz not null,
  status text not null default 'travelling' check(status in ('travelling','completed')),
  response jsonb not null,
  unique(user_id,idempotency_key)
);
create index if not exists osun_town_travels_active_idx
  on public.osun_town_travels(character_id,arrival_at) where status='travelling';
alter table public.osun_town_travels enable row level security;
revoke all on public.osun_town_travels from public,anon,authenticated;
grant all on public.osun_town_travels to service_role;

create or replace function public.start_osun_town_travel(
  p_user_id uuid,p_destination_id text,p_idempotency_key text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare player public.characters%rowtype; wallet public.wallets%rowtype;
  route public.osun_town_routes%rowtype; prior jsonb; result jsonb;
  trip_id uuid:=gen_random_uuid(); arrival timestamptz;
begin
  if p_user_id is null then raise exception 'UNAUTHORIZED'; end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 16 and 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  select response into prior from public.osun_town_travels
    where user_id=p_user_id and idempotency_key=p_idempotency_key;
  if found then return prior || jsonb_build_object('duplicate',true); end if;
  select * into player from public.characters where user_id=p_user_id
    order by created_at desc limit 1 for update;
  if not found then raise exception 'NO_CHARACTER'; end if;
  update public.osun_town_travels set status='completed'
    where character_id=player.id and status='travelling' and arrival_at<=clock_timestamp();
  if exists(select 1 from public.osun_town_travels where character_id=player.id
    and status='travelling' and arrival_at>clock_timestamp()) then raise exception 'ALREADY_TRAVELLING'; end if;
  if player.current_town_id=p_destination_id then raise exception 'ALREADY_THERE'; end if;
  select r.* into route from public.osun_town_routes r join public.osun_towns destination
    on destination.id=r.to_town_id and destination.travel_enabled
    where r.from_town_id=player.current_town_id and r.to_town_id=p_destination_id;
  if not found then raise exception 'TOWN_UNAVAILABLE'; end if;
  select * into wallet from public.wallets where character_id=player.id and user_id=p_user_id for update;
  if not found then raise exception 'NO_WALLET'; end if;
  if wallet.balance<route.fare_minor then raise exception 'INSUFFICIENT_FUNDS'; end if;
  arrival:=clock_timestamp()+(route.travel_minutes||' minutes')::interval;
  update public.wallets set balance=balance-route.fare_minor,
    total_expenses=total_expenses+route.fare_minor where id=wallet.id;
  update public.characters set current_town_id=p_destination_id where id=player.id;
  result:=jsonb_build_object('travel_id',trip_id,'from_town_id',route.from_town_id,
    'to_town_id',route.to_town_id,'fare',route.fare_minor,
    'travel_minutes',route.travel_minutes,'arrival_at',arrival,'status','travelling');
  insert into public.osun_town_travels(id,user_id,character_id,idempotency_key,from_town_id,
    to_town_id,fare_minor,travel_minutes,arrival_at,response)
  values(trip_id,p_user_id,player.id,p_idempotency_key,route.from_town_id,route.to_town_id,
    route.fare_minor,route.travel_minutes,arrival,result);
  insert into public.transactions(user_id,wallet_id,character_id,amount,kind,category,description,
    transaction_type,account,source,destination,balance_after,metadata)
  values(p_user_id,wallet.id,player.id,route.fare_minor,'expense','transport',
    'Town travel to '||(select name from public.osun_towns where id=p_destination_id),
    'travel','cash',route.from_town_id,route.to_town_id,wallet.balance-route.fare_minor,
    jsonb_build_object('town_travel_id',trip_id,'request_id',p_idempotency_key));
  return result;
end $$;
revoke all on function public.start_osun_town_travel(uuid,text,text) from public,anon,authenticated;
grant execute on function public.start_osun_town_travel(uuid,text,text) to service_role;

notify pgrst,'reload schema';

alter table public.locations
  add column if not exists map_coordinate_mode text not null default 'verified',
  add constraint locations_map_coordinate_mode_check
    check (map_coordinate_mode in ('verified', 'virtual_game'));

update public.locations
set type = case district_type
      when 'civic' then 'government'
      when 'market' then 'market'
      when 'industrial' then 'transport'
      when 'education' then 'university'
      when 'residential' then 'residential'
      when 'business' then 'workplace'
      when 'culture' then 'landmark'
      else 'custom'
    end,
    map_coordinate_mode = 'virtual_game',
    metadata = metadata || jsonb_build_object(
      'map_note', 'Fictional game placement derived from the original district board; not a verified venue coordinate.'
    )
where slug in (
  'city-centre', 'oja-oba', 'oke-fia', 'old-garage', 'student-district',
  'residential', 'business-district', 'cultural-district', 'rural-outskirts'
);

create table public.game_properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  property_type text not null check (property_type in ('room', 'apartment', 'house', 'land_plot')),
  location_id uuid not null references public.locations(id) on delete restrict,
  image_url text,
  purchase_price bigint check (purchase_price is null or purchase_price >= 0),
  rent_price bigint check (rent_price is null or rent_price >= 0),
  rent_period_days integer not null default 7 check (rent_period_days between 1 and 365),
  level_required integer not null default 0 check (level_required >= 0),
  is_active boolean not null default true,
  metadata jsonb not null default '{"world":"fictional","pricing":"prototype"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (purchase_price is not null or rent_price is not null)
);
create index game_properties_active_location_idx on public.game_properties(location_id, property_type)
  where is_active;
create trigger t_game_properties before update on public.game_properties
  for each row execute function public.touch_updated_at();
alter table public.game_properties enable row level security;
grant select on public.game_properties to authenticated;
grant all on public.game_properties to service_role;
create policy "active fictional properties readable" on public.game_properties
  for select to authenticated using (is_active);

create table public.player_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  property_id uuid not null references public.game_properties(id) on delete restrict,
  tenure text not null check (tenure in ('owned', 'rented')),
  is_active boolean not null default true,
  acquired_at timestamptz not null default now(),
  lease_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((tenure = 'owned' and lease_ends_at is null) or tenure = 'rented')
);
create unique index one_active_property_per_character
  on public.player_properties(character_id, property_id) where is_active;
create unique index one_active_rental_per_character
  on public.player_properties(character_id) where is_active and tenure = 'rented';
create index player_properties_owner_idx on public.player_properties(user_id, character_id, is_active);
create trigger t_player_properties before update on public.player_properties
  for each row execute function public.touch_updated_at();
alter table public.player_properties enable row level security;
grant select on public.player_properties to authenticated;
grant all on public.player_properties to service_role;
create policy "own properties readable" on public.player_properties
  for select to authenticated using (user_id = auth.uid());

create or replace function public.acquire_game_property(p_property_id uuid, p_tenure text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cid uuid := public._my_character_id();
  listing public.game_properties%rowtype;
  player public.characters%rowtype;
  wallet public.wallets%rowtype;
  amount bigint;
  lease_end timestamptz;
  acquired public.player_properties%rowtype;
begin
  if uid is null or cid is null then raise exception 'Sign in and create a character first'; end if;
  if p_tenure not in ('owned', 'rented') then raise exception 'Choose buy or rent'; end if;

  select * into listing from public.game_properties
    where id = p_property_id and is_active for share;
  if not found then raise exception 'Property is no longer available'; end if;
  select * into player from public.characters where id = cid for update;
  if player.level < listing.level_required then
    raise exception 'This property requires level %', listing.level_required;
  end if;

  amount := case when p_tenure = 'owned' then listing.purchase_price else listing.rent_price end;
  if amount is null then
    raise exception 'This listing does not support %', p_tenure;
  end if;

  select * into wallet from public.wallets where character_id = cid for update;
  if not found or wallet.balance < amount then
    raise exception 'Not enough in-game Naira (need ₦%)', amount;
  end if;

  if p_tenure = 'rented' then
    update public.player_properties set is_active = false
      where character_id = cid and is_active and tenure = 'rented';
    lease_end := now() + make_interval(days => listing.rent_period_days);
  else
    update public.player_properties set is_active = false
      where character_id = cid and property_id = listing.id and is_active;
  end if;

  update public.wallets set
    balance = balance - amount,
    total_expenses = total_expenses + amount
    where id = wallet.id returning * into wallet;
  update public.characters set wealth = least(100, 10 + (wallet.balance / 10000)::int)
    where id = cid;

  insert into public.transactions(user_id, wallet_id, character_id, amount, kind, category, description)
    values (
      uid, wallet.id, cid, amount, 'expense',
      case when p_tenure = 'owned' then 'property_purchase' else 'property_rent' end,
      case when p_tenure = 'owned' then 'Bought ' else 'Rented ' end || listing.name
    );

  insert into public.player_properties(user_id, character_id, property_id, tenure, lease_ends_at)
    values (uid, cid, listing.id, p_tenure, lease_end)
    returning * into acquired;
  perform public._notify(
    cid,
    case when p_tenure = 'owned' then 'Property purchased' else 'New rental secured' end,
    listing.name || case when lease_end is null then ' is now yours.' else ' is rented until ' || lease_end::text end,
    'property'
  );

  return jsonb_build_object(
    'property_id', listing.id,
    'name', listing.name,
    'tenure', acquired.tenure,
    'amount', amount,
    'lease_ends_at', acquired.lease_ends_at,
    'balance', wallet.balance
  );
end $$;
revoke execute on function public.acquire_game_property(uuid, text) from public, anon;
grant execute on function public.acquire_game_property(uuid, text) to authenticated;

insert into public.game_properties
  (slug, name, description, property_type, location_id, purchase_price, rent_price, rent_period_days, level_required)
select seed.slug, seed.name, seed.description, seed.property_type, loc.id,
  seed.purchase_price, seed.rent_price, 7, seed.level_required
from (values
  ('courtyard-starter-room', 'Courtyard Starter Room', 'A modest furnished room in a fictional shared courtyard. Prototype weekly rent.', 'room', null::bigint, 450, 0),
  ('garden-court-flat', 'Garden Court Flat', 'A compact fictional flat with room to settle in. Prototype buy or weekly rent prices.', 'apartment', 125000::bigint, 1200::bigint, 1),
  ('family-courtyard-home', 'Family Courtyard Home', 'A spacious fictional home for a growing household. Prototype buy or weekly rent prices.', 'house', 480000::bigint, 4200::bigint, 2),
  ('residential-garden-plot', 'Residential Garden Plot', 'A virtual residential plot for a future home. Prototype purchase price; building is not implemented.', 'land_plot', 180000::bigint, null::bigint, 2)
) as seed(slug, name, description, property_type, purchase_price, rent_price, level_required)
join public.locations loc on loc.slug = 'residential'
on conflict (slug) do nothing;
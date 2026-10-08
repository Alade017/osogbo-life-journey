alter table public.locations
  add column type text not null default 'custom',
  add column latitude double precision,
  add column longitude double precision,
  add column icon text not null default 'map-pin',
  add column image_url text,
  add column is_active boolean not null default true,
  add column level_required integer not null default 0,
  add column metadata jsonb not null default '{}'::jsonb,
  add column updated_at timestamptz not null default now();

alter table public.locations
  alter column tagline set default '',
  alter column description set default '',
  alter column district_type set default 'custom',
  alter column map_x set default 50,
  alter column map_y set default 50;

alter table public.locations
  add constraint locations_type_check
    check (type in (
      'government', 'market', 'shop', 'restaurant', 'bank', 'hospital', 'police',
      'school', 'university', 'entertainment', 'transport', 'residential',
      'workplace', 'landmark', 'custom'
    )),
  add constraint locations_level_required_check check (level_required >= 0),
  add constraint locations_coordinates_check check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and latitude between -90 and 90
      and longitude between -180 and 180
    )
  );

create index locations_active_type_idx on public.locations(type, slug) where is_active;
create index locations_active_geo_idx on public.locations(latitude, longitude)
  where is_active and latitude is not null and longitude is not null;

create trigger t_locations before update on public.locations
  for each row execute function public.touch_updated_at();

grant select on public.locations to authenticated, anon;
grant all on public.locations to service_role;
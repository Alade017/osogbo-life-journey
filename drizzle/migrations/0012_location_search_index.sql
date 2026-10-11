-- Keep map name searches efficient as the active, geocoded location catalog grows.
create extension if not exists pg_trgm with schema extensions;

create index if not exists locations_active_name_trgm_idx
  on public.locations using gin (name extensions.gin_trgm_ops)
  where is_active and latitude is not null and longitude is not null;

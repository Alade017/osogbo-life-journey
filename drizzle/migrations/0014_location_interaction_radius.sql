alter table public.locations
  add column interaction_radius_m integer not null default 50,
  add constraint locations_interaction_radius_check
    check (interaction_radius_m between 1 and 5000);

comment on column public.locations.interaction_radius_m is
  'Virtual gameplay interaction distance in meters; never a GPS radius.';

alter table public.home_items
  add column if not exists room_id text,
  add column if not exists floor smallint not null default 0,
  add column if not exists rotation_deg numeric not null default 0,
  add column if not exists width numeric,
  add column if not exists depth numeric,
  add column if not exists collision_width numeric,
  add column if not exists collision_depth numeric;

alter table public.home_items
  drop constraint if exists home_items_floor_range,
  add constraint home_items_floor_range check (floor >= 0 and floor <= 1),
  drop constraint if exists home_items_rotation_range,
  add constraint home_items_rotation_range check (rotation_deg >= 0 and rotation_deg < 360),
  drop constraint if exists home_items_size_positive,
  add constraint home_items_size_positive check (
    (width is null or width > 0)
    and (depth is null or depth > 0)
    and (collision_width is null or collision_width > 0)
    and (collision_depth is null or collision_depth > 0)
  );

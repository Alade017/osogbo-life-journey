-- Placement coordinates and rotation on house_placements. The live database already has these columns
-- (they were added outside this folder), so this is a no-op there. It exists so a fresh database replays
-- the migrations in an order that matches the live schema, before the room-layout migrations use them.
alter table public.house_placements add column if not exists x numeric not null default 50 check (x between 0 and 100);
alter table public.house_placements add column if not exists y numeric not null default 50 check (y between 0 and 100);
alter table public.house_placements add column if not exists rotation_deg numeric not null default 0;
alter table public.house_placements add column if not exists floor smallint not null default 0;

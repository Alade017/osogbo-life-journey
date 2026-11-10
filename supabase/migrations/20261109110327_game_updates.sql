-- Town News "Game updates": one row per big feature that ships. The phone reads these rows, so a new
-- feature appears in Town News when a row is added here, with no app change.
create table if not exists public.game_updates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  app text not null,
  published_on date not null,
  created_at timestamptz not null default now()
);

alter table public.game_updates enable row level security;
grant select on public.game_updates to authenticated;
grant all on public.game_updates to service_role;
create policy game_updates_read on public.game_updates for select to authenticated using (true);

insert into public.game_updates (slug, title, summary, app, published_on) values
  ('osun-gist', 'Osun Gist', 'Osun State headlines in one place, with links to read more at the source.', 'Osun Gist', '2026-11-09'),
  ('town-map-places', 'Places to explore', 'The map lists the places in town you can explore.', 'Map', '2026-11-09')
on conflict (slug) do nothing;

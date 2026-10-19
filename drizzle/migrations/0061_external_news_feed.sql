-- Cached external headlines for the in-game Nigeria and World news tabs.
-- Publisher articles remain at their original URLs; no article body or image is stored.
create table public.external_news_items (
  id uuid primary key default gen_random_uuid(),
  region text not null check (region in ('nigeria','world')),
  provider text not null check (provider in ('gdelt')),
  source_name text not null check (length(btrim(source_name)) between 1 and 120),
  source_url text not null unique check (source_url ~ '^https?://'),
  title text not null check (length(btrim(title)) between 3 and 300),
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index external_news_items_region_fetched_idx on public.external_news_items(region, fetched_at desc);
alter table public.external_news_items enable row level security;
grant select on public.external_news_items to authenticated;
grant all on public.external_news_items to service_role;
create policy "authenticated read external news" on public.external_news_items for select to authenticated using (expires_at > now());

create table public.external_news_refreshes (
  region text primary key check (region in ('nigeria','world')),
  provider text not null check (provider in ('gdelt')),
  refreshed_at timestamptz,
  failed_at timestamptz,
  failure_message text check (failure_message is null or length(failure_message) <= 300),
  updated_at timestamptz not null default now()
);
alter table public.external_news_refreshes enable row level security;
revoke all on public.external_news_refreshes from public, anon, authenticated;
grant all on public.external_news_refreshes to service_role;

notify pgrst, 'reload schema';

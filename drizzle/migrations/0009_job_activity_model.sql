-- Milestone 5.1: extend the existing job catalog and add data-driven activity definitions.
-- Employment and player state remain in jobs, character_jobs, and characters.

alter table public.jobs
  add column if not exists category text not null default 'services',
  add column if not exists duration_minutes integer not null default 30,
  add column if not exists hunger_cost integer not null default 5,
  add column if not exists thirst_cost integer not null default 0,
  add column if not exists reputation_reward integer not null default 0,
  add column if not exists requirements jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.jobs
set category = case
  when slug like '%developer%' or slug like '%computer%' or slug like '%tech%' then 'technology'
  when slug like '%graphic%' or slug like '%photograph%' then 'design'
  when slug like '%driver%' or slug like '%delivery%' or slug like '%transport%' then 'transportation'
  when slug like '%waiter%' or slug like '%cook%' or slug like '%food%' or slug like '%restaurant%' then 'food_hospitality'
  when slug like '%mechanic%' or slug like '%farm%' then 'construction'
  when slug like '%security%' then 'security'
  when slug like '%health%' or slug like '%clinic%' then 'healthcare'
  when slug like '%teacher%' or slug like '%tutor%' then 'education'
  when slug like '%trader%' or slug like '%vendor%' then 'trading'
  when slug like '%shop%' or slug like '%stock%' or slug like '%cashier%' then 'retail'
  when slug like '%barber%' or slug like '%salon%' then 'services'
  else 'services'
end;

alter table public.jobs drop constraint if exists jobs_category_valid;
alter table public.jobs add constraint jobs_category_valid check (
  category in (
    'technology', 'design', 'retail', 'transportation', 'food_hospitality',
    'construction', 'security', 'services', 'healthcare', 'education',
    'entertainment', 'trading'
  )
);
alter table public.jobs drop constraint if exists jobs_duration_valid;
alter table public.jobs add constraint jobs_duration_valid check (duration_minutes between 1 and 1440);
alter table public.jobs drop constraint if exists jobs_needs_cost_valid;
alter table public.jobs add constraint jobs_needs_cost_valid check (
  hunger_cost between 0 and 100 and thirst_cost between 0 and 100
);
alter table public.jobs drop constraint if exists jobs_reputation_reward_valid;
alter table public.jobs add constraint jobs_reputation_reward_valid check (reputation_reward between 0 and 100);
alter table public.jobs drop constraint if exists jobs_requirements_object;
alter table public.jobs add constraint jobs_requirements_object check (jsonb_typeof(requirements) = 'object');
alter table public.jobs drop constraint if exists jobs_metadata_object;
alter table public.jobs add constraint jobs_metadata_object check (jsonb_typeof(metadata) = 'object');
create index if not exists jobs_available_category_sort_idx
  on public.jobs(category, sort_order, name) where is_available;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  description text not null,
  location_id uuid references public.locations(id) on delete set null,
  duration_minutes integer not null check (duration_minutes between 1 and 1440),
  energy_delta integer not null default 0 check (energy_delta between -100 and 100),
  hunger_delta integer not null default 0 check (hunger_delta between -100 and 100),
  thirst_delta integer not null default 0 check (thirst_delta between -100 and 100),
  xp_reward integer not null default 0 check (xp_reward >= 0),
  requirements jsonb not null default '{}'::jsonb check (jsonb_typeof(requirements) = 'object'),
  rewards jsonb not null default '{}'::jsonb check (jsonb_typeof(rewards) = 'object'),
  cooldown_minutes integer not null default 0 check (cooldown_minutes >= 0),
  is_available boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (category in ('rest', 'study', 'exercise', 'social', 'exploration', 'food', 'culture', 'event', 'other'))
);
create index if not exists activities_available_category_idx
  on public.activities(category, name) where is_available;
create index if not exists activities_available_location_idx
  on public.activities(location_id, category) where is_available;
create trigger t_activities before update on public.activities
  for each row execute function public.touch_updated_at();
alter table public.activities enable row level security;
grant select on public.activities to authenticated;
grant all on public.activities to service_role;
drop policy if exists "available activities readable" on public.activities;
create policy "available activities readable" on public.activities
  for select to authenticated using (is_available);

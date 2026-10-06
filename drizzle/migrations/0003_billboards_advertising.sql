create table public.advertisement_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.advertisement_admins enable row level security;
grant all on public.advertisement_admins to service_role;

create or replace function public.is_advertisement_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.advertisement_admins where user_id = auth.uid())
$$;
revoke execute on function public.is_advertisement_admin() from public, anon;
grant execute on function public.is_advertisement_admin() to authenticated;

create table public.game_billboards (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  location_id uuid not null references public.locations(id) on delete cascade,
  placement text not null,
  size_type text not null check (size_type in ('small','medium','large')),
  billboard_type text not null check (billboard_type in ('roadside','wall','shopfront','digital-screen','transport')),
  status text not null default 'active' check (status in ('active','inactive','maintenance')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index game_billboards_location_idx on public.game_billboards(location_id, status);
create trigger t_game_billboards before update on public.game_billboards
  for each row execute function public.touch_updated_at();
alter table public.game_billboards enable row level security;
grant select, insert, update, delete on public.game_billboards to authenticated;
grant all on public.game_billboards to service_role;
create policy "active billboards readable" on public.game_billboards
  for select to authenticated using (status = 'active' or public.is_advertisement_admin());
create policy "admins insert billboards" on public.game_billboards
  for insert to authenticated with check (public.is_advertisement_admin());
create policy "admins update billboards" on public.game_billboards
  for update to authenticated using (public.is_advertisement_admin()) with check (public.is_advertisement_admin());
create policy "admins delete billboards" on public.game_billboards
  for delete to authenticated using (public.is_advertisement_admin());

create table public.advertisements (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  billboard_id uuid not null references public.game_billboards(id) on delete cascade,
  advertiser_name text not null,
  title text not null,
  description text not null,
  creative_image_url text,
  creative_theme text not null default 'green' check (creative_theme in ('green','ink','sun','clay')),
  call_to_action text,
  destination_action text not null default 'none' check (destination_action in ('none','external_url','internal_route')),
  destination_url text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'draft' check (status in ('draft','pending','active','expired','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at),
  check (
    (destination_action = 'none' and destination_url is null)
    or (destination_action <> 'none' and destination_url is not null)
  )
);
create index advertisements_billboard_schedule_idx on public.advertisements(billboard_id, status, starts_at desc, ends_at);
create trigger t_advertisements before update on public.advertisements
  for each row execute function public.touch_updated_at();
alter table public.advertisements enable row level security;
grant select, insert, update, delete on public.advertisements to authenticated;
grant all on public.advertisements to service_role;
create policy "current ads readable" on public.advertisements
  for select to authenticated using (
    public.is_advertisement_admin()
    or (
      status = 'active'
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
      and exists (
        select 1 from public.game_billboards b
        where b.id = billboard_id and b.status = 'active'
      )
    )
  );
create policy "admins insert ads" on public.advertisements
  for insert to authenticated with check (public.is_advertisement_admin());
create policy "admins update ads" on public.advertisements
  for update to authenticated using (public.is_advertisement_admin()) with check (public.is_advertisement_admin());
create policy "admins delete ads" on public.advertisements
  for delete to authenticated using (public.is_advertisement_admin());

insert into public.game_billboards (slug, name, location_id, placement, size_type, billboard_type, status)
select 'oke-fia-junction-001', 'Oke-Fia Junction Board', id,
  'Roadside board facing the Oke-Fia city route', 'large', 'roadside', 'active'
from public.locations where slug = 'oke-fia'
on conflict (slug) do nothing;

insert into public.advertisements (
  slug, billboard_id, advertiser_name, title, description, creative_theme,
  call_to_action, destination_action, destination_url, starts_at, ends_at, status
)
select
  'aladtech-digital-presence', b.id, 'Aladtech', 'Build your digital presence.',
  'Web Development • Website Design • Graphic Design', 'green',
  'Learn More', 'none', null, now(), '2099-12-31 23:59:59+00'::timestamptz, 'active'
from public.game_billboards b
where b.slug = 'oke-fia-junction-001'
on conflict (slug) do nothing;
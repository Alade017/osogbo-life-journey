-- Username login is resolved only by the server. Browser roles cannot read the
-- mapping, which may point to a private backup email after it is verified.
create table if not exists public.username_accounts (
  username text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint username_accounts_format check (username ~ '^[a-z0-9_]{3,24}$')
);
alter table public.username_accounts enable row level security;
revoke all on public.username_accounts from anon, authenticated;
grant all on public.username_accounts to service_role;

create table if not exists public.username_auth_attempts (
  attempt_key text not null,
  window_start timestamptz not null,
  attempt_count integer not null default 1,
  primary key (attempt_key, window_start)
);
alter table public.username_auth_attempts enable row level security;
revoke all on public.username_auth_attempts from public, anon, authenticated;
grant all on public.username_auth_attempts to service_role;

create or replace function public.record_username_auth_attempt(p_attempt_key text)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_count integer;
begin
  delete from public.username_auth_attempts where window_start < now() - interval '2 hours';
  insert into public.username_auth_attempts(attempt_key, window_start, attempt_count)
  values(p_attempt_key, date_trunc('hour', now()), 1)
  on conflict(attempt_key, window_start) do update
    set attempt_count = public.username_auth_attempts.attempt_count + 1
  returning attempt_count into current_count;
  return current_count <= 12;
end $$;
revoke all on function public.record_username_auth_attempt(text) from public, anon, authenticated;
grant execute on function public.record_username_auth_attempt(text) to service_role;

-- Ludo multiplayer: player profiles with win counts, and a record of each finished match.
-- Clients can read public names and their own matches. Only the server (service role) writes results,
-- through record_ludo_match. NOT APPLIED: review and apply separately.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Player' check (char_length(display_name) between 1 and 24),
  ludo_wins integer not null default 0 check (ludo_wins >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'ludo' check (game = 'ludo'),
  winner_id uuid not null references auth.users (id) on delete set null,
  player_ids uuid[] not null check (cardinality(player_ids) between 2 and 4),
  finished_at timestamptz not null default now()
);

create index if not exists matches_player_ids_idx on public.matches using gin (player_ids);

alter table public.profiles enable row level security;
alter table public.matches enable row level security;

create policy "Profiles are readable by signed-in players"
  on public.profiles for select to authenticated using (true);

create policy "Players update only their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "Players insert only their own profile"
  on public.profiles for insert to authenticated with check (id = auth.uid());

create policy "Players read matches they were in"
  on public.matches for select to authenticated using (auth.uid() = any (player_ids));

-- No insert, update or delete policies on matches or on profiles.ludo_wins: only the service role writes.

create or replace function public.record_ludo_match(p_winner uuid, p_players uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  match_id uuid;
begin
  if not (p_winner = any (p_players)) then
    raise exception 'The winner must be one of the players.';
  end if;

  insert into public.matches (winner_id, player_ids)
  values (p_winner, p_players)
  returning id into match_id;

  update public.profiles
  set ludo_wins = ludo_wins + 1
  where id = p_winner;

  return match_id;
end;
$$;

revoke all on function public.record_ludo_match(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.record_ludo_match(uuid, uuid[]) to service_role;

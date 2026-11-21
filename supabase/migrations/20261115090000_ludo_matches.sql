-- Ludo multiplayer: a win counter on each player's profile, and a record of each finished match.
-- Clients can read public names and their own matches. Only the server (service role) writes results,
-- through record_ludo_match. Every auth user already gets a profiles row from on_auth_user_created, and
-- profiles already has public read and own-row insert/update policies, so only the new column and
-- matches table are added here.

alter table public.profiles add column if not exists ludo_wins integer not null default 0 check (ludo_wins >= 0);

-- Supabase grants table-level INSERT and UPDATE on profiles to anon and authenticated, which would let a
-- player write their own ludo_wins through the existing own-row policies. Take those grants back and
-- re-grant every other column, so only the service role can change ludo_wins.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, display_name, reduced_motion, sound_enabled, created_at, updated_at, username, dashboard_pins, music_enabled, effects_enabled, app_tile_style)
  on public.profiles to anon, authenticated;
grant update (id, display_name, reduced_motion, sound_enabled, created_at, updated_at, username, dashboard_pins, music_enabled, effects_enabled, app_tile_style)
  on public.profiles to anon, authenticated;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  game text not null default 'ludo' check (game = 'ludo'),
  winner_id uuid not null references auth.users (id) on delete set null,
  player_ids uuid[] not null check (cardinality(player_ids) between 2 and 4),
  finished_at timestamptz not null default now()
);

create index if not exists matches_player_ids_idx on public.matches using gin (player_ids);

alter table public.matches enable row level security;
revoke all on public.matches from public, anon, authenticated;
grant select on public.matches to authenticated;
grant all on public.matches to service_role;

create policy "Players read matches they were in"
  on public.matches for select to authenticated using (auth.uid() = any (player_ids));

-- No insert, update or delete policies on matches: only the service role writes.

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

notify pgrst, 'reload schema';

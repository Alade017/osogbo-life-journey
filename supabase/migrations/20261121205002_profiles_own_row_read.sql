-- Profiles held every player's row readable by anyone, including anon. The app only reads a
-- signed-in player's own row (src/lib/game.ts, settings). Other players' names reach the
-- client through security definer functions such as search_player_profiles and
-- get_player_profile, which do not depend on this policy. So reads are limited to the
-- player's own row.

drop policy if exists "Profiles are readable by everyone" on public.profiles;

create policy "Players read their own profile" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

revoke select on public.profiles from anon;

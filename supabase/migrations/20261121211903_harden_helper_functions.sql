-- Supabase advisor fixes.
-- 1. Pin the search path on four pure helpers that had none, so a caller's search path
--    can never change what they resolve to.
-- 2. Take anon's execute off the helpers that only signed-in requests and row-level
--    policies need. Nothing in the app calls them as anon, and the one policy that uses
--    is_advertisement_admin() applies to authenticated only. Authenticated keeps execute,
--    so the policies and definer chains still run.

alter function public._house_error(text) set search_path = public;
alter function public._mini_game_line_winner(text) set search_path = public;
alter function public._housing_accessory_band(bigint) set search_path = public;
alter function public._mini_game_label(text) set search_path = public;

revoke execute on function public._my_character_id() from public, anon;
revoke execute on function public._my_social_character_id() from public, anon;
revoke execute on function public.handle_new_user() from public, anon;
revoke execute on function public.is_advertisement_admin() from public, anon;
grant execute on function public._my_character_id() to authenticated, service_role;
grant execute on function public._my_social_character_id() to authenticated, service_role;
grant execute on function public.handle_new_user() to authenticated, service_role;
grant execute on function public.is_advertisement_admin() to authenticated, service_role;

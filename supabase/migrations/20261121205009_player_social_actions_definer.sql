-- block_player and remove_player_friend were security invoker, so they wrote to
-- player_blocks and player_friendships as the signed-in player. Those tables have no write
-- policy, so the writes were refused. Both functions already work out the caller from
-- _my_social_character_id() and only touch that caller's own rows, so they can run as
-- security definer. Revoke anon and public execute while here.

alter function public.block_player(uuid) security definer;
alter function public.remove_player_friend(uuid) security definer;

revoke all on function public.block_player(uuid) from public, anon;
revoke all on function public.remove_player_friend(uuid) from public, anon;
grant execute on function public.block_player(uuid) to authenticated, service_role;
grant execute on function public.remove_player_friend(uuid) to authenticated, service_role;

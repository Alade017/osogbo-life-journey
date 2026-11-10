-- Hardening for mini-game tables: anonymous visitors cannot call the game RPCs, and players cannot read
-- user_id on seats. The table-level select grant is replaced by a column grant that omits user_id.
revoke all on function public.mini_game_create_table(bigint), public.mini_game_join_table(uuid),
  public.mini_game_leave_table(uuid), public.mini_game_play_move(uuid, int), public.mini_game_heartbeat(uuid),
  public.mini_game_claim_forfeit(uuid) from anon;
revoke select on public.mini_game_seats from authenticated, anon;
grant select (table_id, character_id, seat, paid, last_active_at) on public.mini_game_seats to authenticated;
notify pgrst, 'reload schema';

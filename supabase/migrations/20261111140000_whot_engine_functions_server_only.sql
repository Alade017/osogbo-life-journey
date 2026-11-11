-- The Whot engine functions load, start and settle a table. Only the server may call them, so
-- players cannot commit a game state or a winner directly. The earlier migration did not revoke
-- authenticated, which Supabase grants by default; this removes it.
revoke all on function public.mini_game_whot_load(uuid), public.mini_game_whot_init(uuid, jsonb),
  public.mini_game_whot_commit(uuid, uuid, int, jsonb, smallint) from authenticated;
grant execute on function public.mini_game_whot_load(uuid), public.mini_game_whot_init(uuid, jsonb),
  public.mini_game_whot_commit(uuid, uuid, int, jsonb, smallint) to service_role;

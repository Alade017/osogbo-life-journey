revoke all on function public.mini_game_whot_load(uuid), public.mini_game_whot_init(uuid, jsonb),
  public.mini_game_whot_commit(uuid, uuid, int, jsonb, smallint) from authenticated;
grant execute on function public.mini_game_whot_load(uuid), public.mini_game_whot_init(uuid, jsonb),
  public.mini_game_whot_commit(uuid, uuid, int, jsonb, smallint) to service_role;

-- Browsers talk to tables through the Data API as anon or authenticated. Most public
-- tables have no write policy, so RLS already refuses their inserts, updates and deletes.
-- The Supabase default grants still allow TRUNCATE, REFERENCES and TRIGGER, and TRUNCATE
-- skips RLS entirely. Remove every write privilege from anon and authenticated, then give
-- back only what the write policies need: advertisements and game_billboards (admin
-- policies) and the player's own profile columns (see 20261115090000_ludo_matches).

do $$
declare
  t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  loop
    execute format(
      'revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated',
      t.relname
    );
  end loop;
end $$;

-- Admin-only write policies on these tables check is_advertisement_admin().
grant insert, update, delete on public.advertisements, public.game_billboards to authenticated;

-- Revoking a table-level privilege can also clear column-level grants on profiles, and anon
-- kept column-level insert/update there. Clear anon's column grants and set the player's
-- columns again, leaving ludo_wins out so only the service role can change it.
revoke insert (id, display_name, reduced_motion, sound_enabled, created_at, updated_at, username, dashboard_pins, music_enabled, effects_enabled, app_tile_style),
  update (id, display_name, reduced_motion, sound_enabled, created_at, updated_at, username, dashboard_pins, music_enabled, effects_enabled, app_tile_style)
  on public.profiles from anon;
grant insert (id, display_name, reduced_motion, sound_enabled, created_at, updated_at, username, dashboard_pins, music_enabled, effects_enabled, app_tile_style),
  update (id, display_name, reduced_motion, sound_enabled, created_at, updated_at, username, dashboard_pins, music_enabled, effects_enabled, app_tile_style)
  on public.profiles to authenticated;

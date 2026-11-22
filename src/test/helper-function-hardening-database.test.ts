// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, expect, it } from "vitest";

const migration = "supabase/migrations/20261121211903_harden_helper_functions.sql";
let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table public.characters (id uuid primary key, user_id uuid);
    create table public.advertisement_admins (user_id uuid primary key);
    -- Stubs with the live signatures; the migration only changes their privileges and config.
    create function public._house_error(p_code text) returns jsonb language sql immutable as $$
      select jsonb_build_object('ok', false, 'code', p_code)
    $$;
    create function public._mini_game_line_winner(p_cells text) returns text language sql immutable as $$ select null::text $$;
    create function public._housing_accessory_band(p_budget_minor bigint) returns text language sql immutable as $$ select 'basic'::text $$;
    create function public._mini_game_label(p_game text) returns text language sql immutable as $$ select p_game $$;
    create function public._my_character_id() returns uuid language sql stable security definer set search_path = public as $$
      select id from public.characters where user_id = null
    $$;
    create function public._my_social_character_id() returns uuid language sql stable security definer set search_path = '' as $$
      select null::uuid
    $$;
    create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
    begin return new; end $$;
    create function public.is_advertisement_admin() returns boolean language sql stable security definer set search_path = '' as $$
      select false
    $$;
    -- Supabase grants execute on new functions to PUBLIC by default, which is what anon inherits.
  `);
  await db.exec(readFileSync(migration, "utf8"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

it("pins a fixed search path on the four pure helpers", async () => {
  const { rows } = await db.query<{ name: string; config: string[] | null }>(
    `select p.proname as name, p.proconfig as config from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in ('_house_error','_mini_game_line_winner','_housing_accessory_band','_mini_game_label')`,
  );
  expect(rows).toHaveLength(4);
  for (const row of rows) {
    expect(row.config ?? []).toContain("search_path=public");
  }
});

it("keeps the helpers executable by signed-in players and closes them to anon", async () => {
  const signature = (name: string) =>
    ({
      _my_character_id: "public._my_character_id()",
      _my_social_character_id: "public._my_social_character_id()",
      handle_new_user: "public.handle_new_user()",
      is_advertisement_admin: "public.is_advertisement_admin()",
    })[name] as string;
  for (const name of [
    "_my_character_id",
    "_my_social_character_id",
    "handle_new_user",
    "is_advertisement_admin",
  ]) {
    const { rows } = await db.query<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon', '${signature(name)}', 'EXECUTE') as anon,
              has_function_privilege('authenticated', '${signature(name)}', 'EXECUTE') as authenticated`,
    );
    expect(rows[0], name).toEqual({ anon: false, authenticated: true });
  }
});

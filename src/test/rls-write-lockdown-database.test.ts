// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const migrations = [
  "supabase/migrations/20261115090000_ludo_matches.sql",
  "supabase/migrations/20261121210000_lock_direct_table_writes.sql",
  "supabase/migrations/20261121211000_mini_game_seat_visibility.sql",
  "supabase/migrations/20261121212000_profiles_own_row_read.sql",
  "supabase/migrations/20261121213000_player_social_actions_definer.sql",
];

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";
const aliceChar = "c1111111-1111-4111-8111-111111111111";
const bobChar = "c2222222-2222-4222-8222-222222222222";
const carolChar = "c3333333-3333-4333-8333-333333333333";
const openTable = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const playingTable = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: PGlite;

async function asUser(userId: string, characterId: string, sql: string) {
  await db.exec(
    `set role authenticated; select set_config('test.user_id', '${userId}', false); select set_config('test.character_id', '${characterId}', false);`,
  );
  try {
    return await db.query<Record<string, unknown>>(sql);
  } finally {
    await db.exec(
      "reset role; select set_config('test.user_id', '', false); select set_config('test.character_id', '', false);",
    );
  }
}

async function asAnon(sql: string) {
  await db.exec("set role anon");
  try {
    return await db.query<Record<string, unknown>>(sql);
  } finally {
    await db.exec("reset role");
  }
}

async function rejects(run: () => Promise<unknown>, pattern: RegExp) {
  let message = "";
  try {
    await run();
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  expect(message).toMatch(pattern);
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    create function public._my_character_id() returns uuid language sql stable as $$
      select nullif(current_setting('test.character_id', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    grant usage on schema public to anon, authenticated, service_role;

    create table auth.users (id uuid primary key);
    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade,
      display_name text, username text, reduced_motion boolean not null default false,
      sound_enabled boolean not null default true, music_enabled boolean not null default true,
      effects_enabled boolean not null default true, dashboard_pins jsonb not null default '[]'::jsonb,
      app_tile_style text not null default 'rounded',
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    alter table public.profiles enable row level security;
    create policy "Profiles are readable by everyone" on public.profiles for select using (true);
    create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
    create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

    create table public.wallets (character_id uuid primary key, user_id uuid, balance bigint not null default 0);
    create table public.advertisements (id uuid primary key, title text);
    create table public.game_billboards (id uuid primary key, title text);
    create table public.mini_game_tables (
      id uuid primary key, game text not null default 'ludo', status text not null, stake bigint not null default 500
    );
    create table public.mini_game_seats (
      table_id uuid not null references public.mini_game_tables (id), character_id uuid not null,
      user_id uuid not null, seat smallint not null, paid bigint not null default 500,
      last_active_at timestamptz not null default now(), primary key (table_id, seat)
    );
    alter table public.mini_game_seats enable row level security;
    alter table public.mini_game_tables enable row level security;
    create policy mini_game_tables_read on public.mini_game_tables for select to authenticated using (true);
    create policy mini_game_seats_read on public.mini_game_seats for select to authenticated using (true);

    -- Stubs for the two social functions; the migration changes how they run, not their body.
    create function public.block_player(p_target_character_id uuid) returns jsonb language sql as $$
      select '{}'::jsonb
    $$;
    create function public.remove_player_friend(p_target_character_id uuid) returns jsonb language sql as $$
      select '{}'::jsonb
    $$;

    -- Supabase grants all privileges on public tables to anon and authenticated by default.
    grant all on all tables in schema public to anon, authenticated, service_role;
    -- Seats are readable only in these columns (see 20261109153119_mini_game_hardening).
    revoke select on public.mini_game_seats from anon, authenticated;
    grant select (table_id, character_id, seat, paid, last_active_at) on public.mini_game_seats to authenticated;

    insert into auth.users(id) values ('${alice}'), ('${bob}'), ('${carol}');
    insert into public.profiles(id, display_name) values ('${alice}', 'Alice'), ('${bob}', 'Bob'), ('${carol}', 'Carol');
    insert into public.wallets(character_id, user_id, balance) values ('${aliceChar}', '${alice}', 1000);
    insert into public.mini_game_tables(id, status) values ('${openTable}', 'open'), ('${playingTable}', 'playing');
    insert into public.mini_game_seats(table_id, character_id, user_id, seat) values
      ('${openTable}', '${aliceChar}', '${alice}', 1),
      ('${playingTable}', '${aliceChar}', '${alice}', 1),
      ('${playingTable}', '${bobChar}', '${bob}', 2);
  `);
  for (const file of migrations) {
    await db.exec(readFileSync(file, "utf8"));
  }
}, 60_000);

afterAll(async () => {
  await db?.close();
});

it("refuses direct inserts, updates, deletes and truncates on wallets from a signed-in player", async () => {
  await rejects(
    () =>
      asUser(
        alice,
        aliceChar,
        `insert into public.wallets(character_id, balance) values ('${carolChar}', 99999)`,
      ),
    /permission denied/,
  );
  await rejects(
    () => asUser(alice, aliceChar, `update public.wallets set balance = 99999`),
    /permission denied/,
  );
  await rejects(() => asUser(alice, aliceChar, `delete from public.wallets`), /permission denied/);
  await rejects(() => asUser(alice, aliceChar, `truncate public.wallets`), /permission denied/);
});

it("keeps the admin-managed tables writable at the privilege level, with their policies deciding", async () => {
  const { rows } = await db.query<{ insert: boolean; update: boolean; del: boolean }>(
    `select has_table_privilege('authenticated','public.advertisements','INSERT') as insert,
            has_table_privilege('authenticated','public.game_billboards','UPDATE') as update,
            has_table_privilege('authenticated','public.game_billboards','DELETE') as del`,
  );
  expect(rows[0]).toEqual({ insert: true, update: true, del: true });
  const { rows: wallet } = await db.query<{ insert: boolean }>(
    `select has_table_privilege('authenticated','public.wallets','INSERT') as insert`,
  );
  expect(wallet[0]?.insert).toBe(false);
});

it("lets an anonymous visitor read no profiles at all", async () => {
  await rejects(() => asAnon(`select id from public.profiles`), /permission denied/);
});

it("shows a signed-in player only their own profile row", async () => {
  const { rows } = await asUser(alice, aliceChar, `select id from public.profiles`);
  expect(rows.map((row) => row["id"])).toEqual([alice]);
});

it("still lets a player edit their own display name, but not their win count", async () => {
  await asUser(
    alice,
    aliceChar,
    `update public.profiles set display_name = 'Alicia' where id = '${alice}'`,
  );
  await rejects(
    () =>
      asUser(alice, aliceChar, `update public.profiles set ludo_wins = 99 where id = '${alice}'`),
    /permission denied/,
  );
});

it("shows seats of an open table to everyone, and seats of a table in play only to the players at it", async () => {
  const waiting = await asUser(
    carol,
    carolChar,
    `select table_id, character_id from public.mini_game_seats where table_id = '${openTable}'`,
  );
  expect(waiting.rows).toHaveLength(1);

  const outsider = await asUser(
    carol,
    carolChar,
    `select table_id, character_id from public.mini_game_seats where table_id = '${playingTable}'`,
  );
  expect(outsider.rows).toHaveLength(0);

  const seated = await asUser(
    alice,
    aliceChar,
    `select table_id, character_id from public.mini_game_seats where table_id = '${playingTable}'`,
  );
  expect(seated.rows).toHaveLength(2);
});

it("does not let a signed-in player read the user id behind a seat", async () => {
  await rejects(
    () => asUser(alice, aliceChar, `select user_id from public.mini_game_seats`),
    /permission denied/,
  );
});

it("runs the friend and block actions as their owner, closed to anonymous visitors", async () => {
  const { rows } = await db.query<{ definer: boolean }>(
    `select prosecdef as definer from pg_proc where proname = 'block_player'`,
  );
  expect(rows[0]?.definer).toBe(true);
  const { rows: privileges } = await db.query<{ anon: boolean; authenticated: boolean }>(
    `select has_function_privilege('anon','public.block_player(uuid)','EXECUTE') as anon,
            has_function_privilege('authenticated','public.block_player(uuid)','EXECUTE') as authenticated`,
  );
  expect(privileges[0]).toEqual({ anon: false, authenticated: true });
});

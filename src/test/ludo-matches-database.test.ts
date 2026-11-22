// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const matchesMigration = "supabase/migrations/20261115090000_ludo_matches.sql";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";
let db: PGlite;

async function asUser(userId: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('test.user_id', '${userId}', false);`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec("reset role; select set_config('test.user_id', '', false);");
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
    create role anon;
    create role authenticated;
    create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    grant usage on schema public to anon, authenticated, service_role;

    create table auth.users (id uuid primary key);
    -- Same column names as the live profiles table; the migration only adds ludo_wins.
    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade,
      display_name text, username text, reduced_motion boolean not null default false,
      sound_enabled boolean not null default true, music_enabled boolean not null default true,
      effects_enabled boolean not null default true, dashboard_pins jsonb not null default '[]'::jsonb,
      app_tile_style text not null default 'rounded',
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    -- Supabase grants full table access to anon and authenticated by default; reproduce that here.
    grant select, insert, update, delete on public.profiles to anon, authenticated;
    alter table public.profiles enable row level security;
    create policy "Profiles are readable by everyone" on public.profiles for select using (true);
    create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
    create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

    insert into auth.users(id) values ('${alice}'), ('${bob}'), ('${carol}');
    insert into public.profiles(id, display_name) values ('${alice}', 'Alice'), ('${bob}', 'Bob'), ('${carol}', 'Carol');
  `);
  await db.exec(readFileSync(matchesMigration, "utf8"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

it("records a finished match and counts the win on the winner's profile", async () => {
  await db.exec(`select public.record_ludo_match('${alice}', array['${alice}','${bob}']::uuid[])`);
  const [profile] = (
    await db.query<{ ludo_wins: number }>(
      `select ludo_wins from public.profiles where id = '${alice}'`,
    )
  ).rows;
  const [match] = (await db.query<{ n: number }>(`select count(*)::int as n from public.matches`))
    .rows;
  expect(profile?.ludo_wins).toBe(1);
  expect(match?.n).toBe(1);
});

it("rejects a winner who was not one of the players", async () => {
  await rejects(
    () =>
      db.exec(`select public.record_ludo_match('${carol}', array['${alice}','${bob}']::uuid[])`),
    /winner must be one of the players/,
  );
});

it("does not let a signed-in player call the result function", async () => {
  await rejects(
    () =>
      asUser(
        alice,
        `select public.record_ludo_match('${alice}', array['${alice}','${bob}']::uuid[])`,
      ),
    /permission denied/,
  );
});

it("does not let a player change their own win count", async () => {
  await rejects(
    () => asUser(alice, `update public.profiles set ludo_wins = 99 where id = '${alice}'`),
    /permission denied/,
  );
  await rejects(
    () => asUser(alice, `insert into public.profiles(id, ludo_wins) values ('${carol}', 5)`),
    /permission denied/,
  );
});

it("still lets a player edit their own display name", async () => {
  await asUser(alice, `update public.profiles set display_name = 'Alicia' where id = '${alice}'`);
  const [row] = (
    await db.query<{ display_name: string }>(
      `select display_name from public.profiles where id = '${alice}'`,
    )
  ).rows;
  expect(row?.display_name).toBe("Alicia");
});

it("shows a player only the matches they were in", async () => {
  await db.exec(`select public.record_ludo_match('${bob}', array['${bob}','${carol}']::uuid[])`);
  const rows = (await asUser(alice, `select player_ids from public.matches`)).rows;
  expect(rows).toHaveLength(1);
});

it("does not let a player write to matches directly", async () => {
  await rejects(
    () =>
      asUser(
        alice,
        `insert into public.matches(winner_id, player_ids) values ('${alice}', array['${alice}','${bob}']::uuid[])`,
      ),
    /permission denied/,
  );
});

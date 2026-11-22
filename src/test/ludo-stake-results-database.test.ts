// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, expect, it } from "vitest";

const matchesMigration = "supabase/migrations/20261115090000_ludo_matches.sql";
const resultsMigration = "supabase/migrations/20261121203000_ludo_stake_results.sql";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carol = "33333333-3333-4333-8333-333333333333";
const table = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const seatedTable = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: PGlite;

/** Each call is a single statement, so a refused call leaves nothing behind. */
async function outcome(
  sql: string,
): Promise<{ ok: true; value: unknown } | { ok: false; message: string }> {
  try {
    const { rows } = await db.query<{ value: unknown }>(sql);
    return { ok: true, value: rows[0]?.value };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id', true), '')::uuid
    $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create table auth.users (id uuid primary key);
    -- Same columns as the live profiles table, so the grants in the matches migration apply.
    create table public.profiles (
      id uuid primary key references auth.users (id) on delete cascade,
      display_name text, username text, reduced_motion boolean not null default false,
      sound_enabled boolean not null default true, music_enabled boolean not null default true,
      effects_enabled boolean not null default true, dashboard_pins jsonb not null default '[]'::jsonb,
      app_tile_style text not null default 'rounded',
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table public.mini_game_tables (
      id uuid primary key, game text not null, status text not null, stake bigint not null,
      pot bigint not null, ludo_mode smallint, finished_at timestamptz, result text, winner_character_id uuid
    );
    create table public.mini_game_seats (
      table_id uuid not null references public.mini_game_tables (id), character_id uuid not null,
      user_id uuid not null, seat smallint not null, paid bigint not null, primary key (table_id, seat)
    );
    -- Stub: the real settlement pays wallets, and has its own tests. This one records the outcome.
    create function public._mini_game_settle(p_table uuid, p_result text, p_winner_seat smallint)
    returns void language plpgsql as $$
    begin
      update public.mini_game_tables set status = 'finished', result = p_result where id = p_table;
    end $$;

    insert into auth.users(id) values ('${alice}'), ('${bob}'), ('${carol}');
    insert into public.profiles(id) values ('${alice}'), ('${bob}'), ('${carol}');
    insert into public.mini_game_tables(id, game, status, stake, pot, ludo_mode)
      values ('${table}', 'ludo', 'playing', 500, 1000, 1), ('${seatedTable}', 'ludo', 'playing', 500, 1000, 1);
    insert into public.mini_game_seats(table_id, character_id, user_id, seat, paid) values
      ('${table}', 'c1111111-1111-4111-8111-111111111111', '${alice}', 1, 500),
      ('${table}', 'c2222222-2222-4222-8222-222222222222', '${bob}', 2, 500),
      ('${seatedTable}', 'c1111111-1111-4111-8111-111111111111', '${alice}', 1, 500),
      ('${seatedTable}', 'c2222222-2222-4222-8222-222222222222', '${bob}', 2, 500);
  `);
  await db.exec(readFileSync(matchesMigration, "utf8"));
  await db.exec(readFileSync(resultsMigration, "utf8"));
}, 60_000);

afterAll(async () => {
  await db?.close();
});

it("returns the seats of a Ludo stake table for the room", async () => {
  const result = await outcome(`select public.ludo_stake_table_for_room('${table}') as value`);
  expect(result.ok).toBe(true);
  const value = (result as { value: { status: string; seats: { user_id: string }[] } }).value;
  expect(value.status).toBe("playing");
  expect(value.seats.map((seat) => seat.user_id)).toEqual([alice, bob]);
});

it("settles a win for a seated winner and records the match", async () => {
  const result = await outcome(
    `select public.ludo_stake_settle('${table}', '${alice}', array['${alice}','${bob}']::uuid[]) as value`,
  );
  expect(result.ok).toBe(true);
  const [profile] = (
    await db.query<{ ludo_wins: number }>(
      `select ludo_wins from public.profiles where id='${alice}'`,
    )
  ).rows;
  const [match] = (await db.query<{ n: number }>(`select count(*)::int as n from public.matches`))
    .rows;
  expect(profile?.ludo_wins).toBe(1);
  expect(match?.n).toBe(1);
});

it("refuses a table that is no longer in play, so a win cannot be paid twice", async () => {
  const again = await outcome(
    `select public.ludo_stake_settle('${table}', '${alice}', array['${alice}','${bob}']::uuid[]) as value`,
  );
  expect(again.ok).toBe(false);
});

it("refuses a winner who is not seated at the table", async () => {
  const result = await outcome(
    `select public.ludo_stake_settle('${seatedTable}', '${carol}', array['${alice}','${bob}']::uuid[]) as value`,
  );
  expect(result.ok).toBe(false);
  expect((result as { message: string }).message).toMatch(/seated at this table/);
});

it("refuses a player list that differs from the seated players", async () => {
  const result = await outcome(
    `select public.ludo_stake_settle('${seatedTable}', '${alice}', array['${alice}','${carol}']::uuid[]) as value`,
  );
  expect(result.ok).toBe(false);
  expect((result as { message: string }).message).toMatch(/seated players/);
});

it("does not let a signed-in player call the settlement or seat lookup", async () => {
  await db.exec("set role authenticated");
  const settle = await outcome(
    `select public.ludo_stake_settle('${seatedTable}', '${alice}', array['${alice}','${bob}']::uuid[]) as value`,
  );
  const seats = await outcome(`select public.ludo_stake_table_for_room('${table}') as value`);
  await db.exec("reset role");
  expect(settle.ok).toBe(false);
  expect(seats.ok).toBe(false);
});

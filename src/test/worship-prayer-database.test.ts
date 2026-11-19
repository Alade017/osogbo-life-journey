// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const migration = "supabase/migrations/20261119130000_worship_prayer_bonus.sql";
const alice = "11111111-1111-4111-8111-111111111111";
const aliceCharacter = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mosqueId = "99999999-aaaa-4aaa-8aaa-999999999999";
const marketId = "98888888-aaaa-4aaa-8aaa-888888888888";
let db: PGlite;

async function query<T>(sql: string, params: unknown[] = []) {
  await db.exec("savepoint prayer_call");
  try {
    const response = await db.query<T>(sql, params);
    await db.exec("release savepoint prayer_call");
    return response.rows;
  } catch (error) {
    await db.exec("rollback to savepoint prayer_call;release savepoint prayer_call");
    throw error;
  }
}

async function value<T>(sql: string, params: unknown[] = []) {
  return (await query<{ result: T }>(`select ${sql} as result`, params))[0]!.result;
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
    grant usage on schema public to authenticated;

    create table public.characters (
      id uuid primary key, user_id uuid not null,
      current_location_id uuid, game_day integer not null default 1
    );
    create table public.locations (id uuid primary key, slug text not null, is_active boolean not null default true);
    create table public.worship_places (
      slug text primary key, bonus_minor bigint not null, active boolean not null default true
    );
    create table public.wallets (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null, character_id uuid not null,
      balance bigint not null, total_income bigint not null default 0, total_expenses bigint not null default 0
    );
    create table public.transactions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null, wallet_id uuid not null, character_id uuid not null,
      amount bigint not null, kind text not null, category text not null, description text not null,
      transaction_type text not null, account text not null, source text not null,
      destination text not null, balance_after bigint not null, metadata jsonb not null
    );
    create table public.economy_request_results (
      character_id uuid not null, request_id uuid not null, operation text not null,
      result jsonb not null, primary key(character_id, request_id, operation)
    );
    create function public._my_character_id() returns uuid
      language sql stable security definer set search_path = public as $$
      select id from public.characters where user_id = auth.uid() order by id limit 1
    $$;

    insert into public.worship_places(slug, bonus_minor) values ('osogbo-central-mosque', 2000);
    insert into public.locations(id, slug) values
      ('${mosqueId}', 'osogbo-central-mosque'), ('${marketId}', 'town-market');
    insert into public.characters(id, user_id, current_location_id, game_day)
      values ('${aliceCharacter}', '${alice}', '${mosqueId}', 3);
    insert into public.wallets(user_id, character_id, balance) values ('${alice}', '${aliceCharacter}', 500);
  `);
  await db.exec(readFileSync(migration, "utf8"));
}, 60_000);

beforeEach(async () => {
  await db.exec("begin");
  await db.query("select set_config('test.user_id', $1, true)", [alice]);
});

afterEach(async () => {
  await db.exec("rollback;reset role");
});

afterAll(async () => {
  await db?.close();
});

it("pays the prayer bonus once at a worship place", async () => {
  const result = await value<{ bonus: number; cash: number }>(
    "public.complete_worship_prayer($1, $2)",
    ["osogbo-central-mosque", "11111111-aaaa-4aaa-8aaa-111111111111"],
  );
  expect(result).toMatchObject({ bonus: 2000, cash: 2500 });
  expect(await query("select balance, total_income from public.wallets")).toEqual([
    { balance: 2500, total_income: 2000 },
  ]);
});

it("returns the same result when the same request is sent again", async () => {
  const id = "22222222-aaaa-4aaa-8aaa-222222222222";
  await value("public.complete_worship_prayer($1, $2)", ["osogbo-central-mosque", id]);
  const again = await value<{ cash: number }>("public.complete_worship_prayer($1, $2)", [
    "osogbo-central-mosque",
    id,
  ]);
  expect(again.cash).toBe(2500);
  expect(await query("select balance from public.wallets")).toEqual([{ balance: 2500 }]);
});

it("refuses a second prayer at the same place on the same game day", async () => {
  await value("public.complete_worship_prayer($1, $2)", [
    "osogbo-central-mosque",
    "33333333-aaaa-4aaa-8aaa-333333333333",
  ]);
  await expect(
    value("public.complete_worship_prayer($1, $2)", [
      "osogbo-central-mosque",
      "44444444-aaaa-4aaa-8aaa-444444444444",
    ]),
  ).rejects.toThrow("You have already prayed here today");
});

it("refuses prayer when the visitor is not at that place", async () => {
  await query("update public.characters set current_location_id = $1", [marketId]);
  await expect(
    value("public.complete_worship_prayer($1, $2)", [
      "osogbo-central-mosque",
      "55555555-aaaa-4aaa-8aaa-555555555555",
    ]),
  ).rejects.toThrow("Go to this place to pray");
});

it("refuses prayer at a place that is not a worship place", async () => {
  await query("update public.characters set current_location_id = $1", [marketId]);
  await expect(
    value("public.complete_worship_prayer($1, $2)", [
      "town-market",
      "66666666-aaaa-4aaa-8aaa-666666666666",
    ]),
  ).rejects.toThrow("Prayers are not held at this place");
});

// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const prayerMigration = "supabase/migrations/20261119130000_worship_prayer_bonus.sql";
const scheduleMigration = "supabase/migrations/20261119133000_worship_prayer_schedule.sql";
const alice = "11111111-1111-4111-8111-111111111111";
const aliceCharacter = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const mosqueId = "99999999-aaaa-4aaa-8aaa-999999999999";
const churchId = "97777777-aaaa-4aaa-8aaa-777777777777";
const marketId = "98888888-aaaa-4aaa-8aaa-888888888888";
const MOSQUE = "osogbo-central-mosque";
const CHURCH = "oke-fia-community-church";
const WEDNESDAY = 2;
const THURSDAY = 3;
const MONDAY = 0;
const SUNDAY = 6;
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

/** Sets where the visitor is and what the game clock says, inside the open transaction. */
async function setClock(locationId: string, weekday: number, hour: number, minute: number) {
  await query(
    `update public.characters
     set current_location_id = $1, game_weekday = $2, game_time_hour = $3, game_time_minute = $4`,
    [locationId, weekday, hour, minute],
  );
}

async function pray(slug: string, prayer: string, requestId: string) {
  return value<{ bonus: number; cash: number; prayer: string }>(
    "public.complete_worship_prayer($1, $2, $3)",
    [slug, prayer, requestId],
  );
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
      current_location_id uuid,
      game_day integer not null default 1,
      game_weekday integer not null default 0,
      game_time_hour integer not null default 8,
      game_time_minute integer not null default 0
    );
    create table public.locations (id uuid primary key, slug text not null, is_active boolean not null default true);
    create table public.town_service_prices (
      service text primary key, amount_minor bigint not null, active boolean not null default true
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

    insert into public.locations(id, slug) values
      ('${mosqueId}', '${MOSQUE}'), ('${churchId}', '${CHURCH}'), ('${marketId}', 'town-market');
    insert into public.characters(id, user_id, current_location_id)
      values ('${aliceCharacter}', '${alice}', '${mosqueId}');
    insert into public.wallets(user_id, character_id, balance) values ('${alice}', '${aliceCharacter}', 500);
  `);
  await db.exec(readFileSync(prayerMigration, "utf8"));
  await db.exec(readFileSync(scheduleMigration, "utf8"));
}, 60_000);

beforeEach(async () => {
  await db.exec("begin");
  await db.query("select set_config('test.user_id', $1, true)", [alice]);
  await setClock(mosqueId, THURSDAY, 13, 10);
});

afterEach(async () => {
  await db.exec("rollback;reset role");
});

afterAll(async () => {
  await db?.close();
});

it("pays the ₦5000 bonus for a prayer that is due", async () => {
  const result = await pray(MOSQUE, "dhuhr", "11111111-aaaa-4aaa-8aaa-111111111111");
  expect(result).toMatchObject({ bonus: 500000, cash: 500500, prayer: "dhuhr" });
  expect(await query("select balance, total_income from public.wallets")).toEqual([
    { balance: 500500, total_income: 500000 },
  ]);
});

it("returns the same result when the same request is sent again", async () => {
  const id = "22222222-aaaa-4aaa-8aaa-222222222222";
  await pray(MOSQUE, "dhuhr", id);
  const again = await pray(MOSQUE, "dhuhr", id);
  expect(again.cash).toBe(500500);
  expect(await query("select balance from public.wallets")).toEqual([{ balance: 500500 }]);
});

it("refuses the same prayer twice on the same game day", async () => {
  await pray(MOSQUE, "dhuhr", "33333333-aaaa-4aaa-8aaa-333333333333");
  await expect(pray(MOSQUE, "dhuhr", "44444444-aaaa-4aaa-8aaa-444444444444")).rejects.toThrow(
    "You have already prayed this prayer today",
  );
});

it("allows a different prayer the same day when it is due", async () => {
  await pray(MOSQUE, "dhuhr", "55555555-aaaa-4aaa-8aaa-555555555555");
  await setClock(mosqueId, THURSDAY, 16, 30);
  const asr = await pray(MOSQUE, "asr", "66666666-aaaa-4aaa-8aaa-666666666666");
  expect(asr.prayer).toBe("asr");
  expect(asr.cash).toBe(1000500);
});

it("refuses a prayer outside its window", async () => {
  await setClock(mosqueId, THURSDAY, 15, 0);
  await expect(pray(MOSQUE, "dhuhr", "77777777-aaaa-4aaa-8aaa-777777777777")).rejects.toThrow(
    "This prayer is not due right now",
  );
});

it("refuses a prayer at the exact end of its window", async () => {
  await setClock(mosqueId, THURSDAY, 14, 0);
  await expect(pray(MOSQUE, "dhuhr", "88888888-aaaa-4aaa-8aaa-888888888888")).rejects.toThrow(
    "This prayer is not due right now",
  );
});

it("accepts the church's midweek and Sunday services at any hour", async () => {
  await setClock(churchId, WEDNESDAY, 3, 5);
  expect((await pray(CHURCH, "service", "99999999-aaaa-4aaa-8aaa-999999999991")).prayer).toBe(
    "service",
  );
});

it("refuses a church service on a day without one", async () => {
  await setClock(churchId, MONDAY, 10, 0);
  await expect(pray(CHURCH, "service", "99999999-aaaa-4aaa-8aaa-999999999992")).rejects.toThrow(
    "This prayer is not due right now",
  );
});

it("accepts a Sunday service", async () => {
  await setClock(churchId, SUNDAY, 10, 0);
  expect((await pray(CHURCH, "service", "99999999-aaaa-4aaa-8aaa-999999999993")).prayer).toBe(
    "service",
  );
});

it("refuses a prayer name the place does not hold", async () => {
  await setClock(churchId, WEDNESDAY, 10, 0);
  await expect(pray(CHURCH, "dhuhr", "99999999-aaaa-4aaa-8aaa-999999999994")).rejects.toThrow(
    "This prayer is not held at this place",
  );
});

it("refuses prayer when the visitor is not at that place", async () => {
  await setClock(marketId, THURSDAY, 13, 10);
  await expect(pray(MOSQUE, "dhuhr", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1")).rejects.toThrow(
    "Go to this place to pray",
  );
});

it("refuses prayer at a place that is not a worship place", async () => {
  await setClock(marketId, THURSDAY, 13, 10);
  await expect(
    pray("town-market", "dhuhr", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"),
  ).rejects.toThrow("Prayers are not held at this place");
});

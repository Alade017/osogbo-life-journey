// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const fixMigration = "supabase/migrations/20261119054601_okada_ride_request_fix.sql";
const presenceMigration = "supabase/migrations/20261119114738_osun_mall_presence.sql";
const alice = "11111111-1111-4111-8111-111111111111";
const aliceCharacter = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const existingRequestId = "44444444-aaaa-4aaa-8aaa-444444444444";
const existingRideId = "22222222-aaaa-4aaa-8aaa-222222222222";
let db: PGlite;

async function query<T>(sql: string, params: unknown[] = []) {
  await db.exec("savepoint presence_call");
  try {
    const response = await db.query<T>(sql, params);
    await db.exec("release savepoint presence_call");
    return response.rows;
  } catch (error) {
    await db.exec("rollback to savepoint presence_call;release savepoint presence_call");
    throw error;
  }
}

async function value<T>(sql: string, params: unknown[] = []) {
  return (await query<{ result: T }>(`select ${sql} as result`, params))[0]!.result;
}

async function setZone(zone: string, ageSeconds = 0) {
  await query(
    `insert into public.osun_mall_presence(character_id, user_id, zone, updated_at)
     values ($1, $2, $3, now() - make_interval(secs => $4))
     on conflict (character_id) do update
     set zone = excluded.zone, updated_at = excluded.updated_at`,
    [aliceCharacter, alice, zone, ageSeconds],
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

    create table public.characters (id uuid primary key, user_id uuid not null);
    create table public.locations (id uuid primary key default gen_random_uuid(), name text not null);
    create table public.town_service_prices (
      service text primary key, amount_minor bigint not null, active boolean not null default true
    );
    create table public.wallets (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      character_id uuid not null,
      balance bigint not null,
      total_expenses bigint not null default 0
    );
    create table public.transactions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null, wallet_id uuid not null, character_id uuid not null,
      amount bigint not null, kind text not null, category text not null,
      description text not null, transaction_type text not null, account text not null,
      source text not null, destination text not null, balance_after bigint not null,
      metadata jsonb not null
    );
    create table public.okada_ride_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      character_id uuid not null,
      destination text not null,
      fare_minor bigint not null,
      status text not null check (status in ('requested', 'assigned', 'completed', 'cancelled')),
      assigned_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table public.economy_request_results (
      character_id uuid not null, request_id uuid not null, operation text not null,
      result jsonb not null, primary key(character_id, request_id, operation)
    );
    create function public._my_character_id() returns uuid
      language sql stable security definer set search_path = public as $$
      select id from public.characters where user_id = auth.uid() order by id limit 1
    $$;

    insert into public.characters values ('${aliceCharacter}', '${alice}');
    insert into public.locations(name) values ('Town market');
    insert into public.town_service_prices values ('okada_ride', 100, true);
    insert into public.wallets(user_id, character_id, balance, total_expenses)
      values ('${alice}', '${aliceCharacter}', 500, 0);
    insert into public.okada_ride_requests(id, user_id, character_id, destination, fare_minor, status)
      values ('${existingRideId}', '${alice}', '${aliceCharacter}', 'Town market', 100, 'requested');
    insert into public.economy_request_results(character_id, request_id, operation, result) values
      ('${aliceCharacter}', '${existingRequestId}', 'okada_ride',
        jsonb_build_object('rideId', '${existingRideId}', 'fare', 100, 'cash', 500, 'status', 'requested'));
  `);
  await db.exec(readFileSync(fixMigration, "utf8"));
  await db.exec(readFileSync(presenceMigration, "utf8"));
}, 60_000);

beforeEach(async () => {
  await db.exec("begin");
  await db.query("select set_config('test.user_id', $1, true)", [alice]);
  await setZone("street");
});

afterEach(async () => {
  await db.exec("rollback;reset role");
});

afterAll(async () => {
  await db?.close();
});

it("accepts a ride ordered from the street", async () => {
  const result = await value<{ status: string }>("public.request_okada_ride($1, $2)", [
    "Town market",
    "55555555-aaaa-4aaa-8aaa-555555555555",
  ]);
  expect(result.status).toBe("requested");
});

it("refuses a ride ordered from inside the mall", async () => {
  await setZone("mall");
  await expect(
    value("public.request_okada_ride($1, $2)", [
      "Town market",
      "66666666-aaaa-4aaa-8aaa-666666666666",
    ]),
  ).rejects.toThrow("Go outside to the street to order a ride");
});

it("refuses a ride when the visitor's last report is stale", async () => {
  await setZone("street", 60);
  await expect(
    value("public.request_okada_ride($1, $2)", [
      "Town market",
      "77777777-aaaa-4aaa-8aaa-777777777777",
    ]),
  ).rejects.toThrow("Go outside to the street to order a ride");
});

it("refuses a ride when there is no presence report at all", async () => {
  await query("delete from public.osun_mall_presence where character_id = $1", [aliceCharacter]);
  await expect(
    value("public.request_okada_ride($1, $2)", [
      "Town market",
      "88888888-aaaa-4aaa-8aaa-888888888888",
    ]),
  ).rejects.toThrow("Go outside to the street to order a ride");
});

it("still returns the original result when an old request is replayed from the mall", async () => {
  await setZone("mall");
  const result = await value<{ rideId: string }>("public.request_okada_ride($1, $2)", [
    "Town market",
    existingRequestId,
  ]);
  expect(result.rideId).toBe(existingRideId);
});

it("records the visitor's place and moves it when they change", async () => {
  await value("public.set_osun_mall_presence($1)", ["mall"]);
  expect(
    await query("select zone from public.osun_mall_presence where character_id = $1", [
      aliceCharacter,
    ]),
  ).toEqual([{ zone: "mall" }]);
});

it("rejects a place that is not in the mall", async () => {
  await expect(value("public.set_osun_mall_presence($1)", ["market"])).rejects.toThrow(
    "Unknown place in the Osun Mall",
  );
});

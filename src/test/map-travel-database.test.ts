// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const characterId = "22222222-2222-4222-8222-222222222222";
const walletId = "33333333-3333-4333-8333-333333333333";
const ojaLocationId = "44444444-4444-4444-8444-444444444444";
let db: PGlite;

describe("map travel database actions", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.profiles(id uuid primary key);
      create table public.locations(
        id uuid primary key, slug text unique not null, name text not null,
        description text not null default '', is_active boolean not null default true
      );
      create table public.characters(
        id uuid primary key, user_id uuid not null references public.profiles(id),
        age integer not null, current_location_id uuid references public.locations(id)
      );
      create table public.wallets(
        id uuid primary key, user_id uuid not null references public.profiles(id),
        character_id uuid not null references public.characters(id), balance bigint not null,
        total_expenses bigint not null default 0, updated_at timestamptz not null default now()
      );
      create table public.transactions(
        id uuid primary key default gen_random_uuid(), user_id uuid not null,
        wallet_id uuid not null, character_id uuid not null, amount bigint not null,
        kind text not null, category text not null, description text not null,
        metadata jsonb not null default '{}'::jsonb
      );
      create table public.activities(
        id uuid primary key default gen_random_uuid(), name text not null,
        description text not null default '', location_id uuid, is_available boolean not null default true
      );
      create table public.jobs(
        id uuid primary key default gen_random_uuid(), name text not null,
        salary bigint not null default 0, location_id uuid, is_available boolean not null default true,
        sort_order integer not null default 0
      );
    `);
    const locations = [
      "city-centre",
      "oja-oba",
      "oke-fia",
      "old-garage",
      "student-district",
      "residential",
      "business-district",
      "rural-outskirts",
      "government-area",
      "stadium",
      "state-hospital",
      "airport-terminal",
      "oke-baale",
      "isale-osun",
      "atiku",
      "industrial-area",
      "osun-mall",
      "aiyegbaju-market",
      "osogbo-high-court",
      "bola-ige-secretariat",
      "mandela-freedom-park",
      "osogbo-bank-district",
      "adire-cloth-market",
    ];
    for (const [index, slug] of locations.entries()) {
      const id =
        index === 1
          ? ojaLocationId
          : `55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`;
      await db.query("insert into public.locations(id,slug,name) values($1,$2,$3)", [
        id,
        slug,
        slug,
      ]);
    }
    await db.exec(`
      insert into public.profiles(id) values ('${userId}');
      insert into public.characters(id,user_id,age,current_location_id)
        values ('${characterId}','${userId}',16,
          (select id from public.locations where slug='city-centre'));
      insert into public.wallets(id,user_id,character_id,balance)
        values ('${walletId}','${userId}','${characterId}',5000);
    `);
    await db.exec(readFileSync("drizzle/migrations/0037_map_api_travel.sql", "utf8"));
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("blocks a player under 18 through the stored adult flag", async () => {
    await db.exec("update public.map_landmarks set min_age=18 where id='oja-oba-market'");
    const character = await db.query<{ is_adult: boolean }>(
      "select is_adult from public.characters where id=$1",
      [characterId],
    );
    expect(character.rows[0]?.is_adult).toBe(false);
    await expect(
      db.query("select public.map_start_travel($1,'oja-oba-market',$2)", [
        userId,
        "age-block-request-0001",
      ]),
    ).rejects.toThrow(/AGE_RESTRICTED/);
    await db.exec("update public.map_landmarks set min_age=0 where id='oja-oba-market'");
  });

  it("returns the saved receipt on an offline retry and debits once", async () => {
    const key = "offline-retry-request-0001";
    const first = await db.query<{ result: Record<string, unknown> }>(
      "select public.map_start_travel($1,'oja-oba-market',$2) as result",
      [userId, key],
    );
    const retry = await db.query<{ result: Record<string, unknown> }>(
      "select public.map_start_travel($1,'oja-oba-market',$2) as result",
      [userId, key],
    );
    expect(retry.rows[0]?.result).toEqual(first.rows[0]?.result);
    const wallet = await db.query<{ balance: number | string }>(
      "select balance from public.wallets where id=$1",
      [walletId],
    );
    const trips = await db.query<{ count: number }>(
      "select count(*)::int as count from public.map_travels where user_id=$1",
      [userId],
    );
    const transactions = await db.query<{ count: number }>(
      "select count(*)::int as count from public.transactions where user_id=$1",
      [userId],
    );
    expect(Number(wallet.rows[0]?.balance)).toBe(4700);
    expect(trips.rows[0]?.count).toBe(1);
    expect(transactions.rows[0]?.count).toBe(1);
  });

  it("returns UNKNOWN_LANDMARK for an old landmark id", async () => {
    await expect(
      db.query("select public.map_start_travel($1,'removed-place',$2)", [
        userId,
        "stale-landmark-request-001",
      ]),
    ).rejects.toThrow(/UNKNOWN_LANDMARK/);
  });
});

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
        age integer not null, current_location_id uuid references public.locations(id),
        created_at timestamptz not null default now()
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
        transaction_type text, account text, source text, destination text, balance_after bigint,
        metadata jsonb not null default '{}'::jsonb
      );
      create table public.activities(
        id uuid primary key default gen_random_uuid(), name text not null,
        description text not null default '', location_id uuid, is_available boolean not null default true
      );
      create table public.map_landmark_actions(
        landmark_id text not null, id text not null, definition jsonb not null,
        sort_order integer not null default 0, is_active boolean not null default true,
        primary key(landmark_id,id)
      );
      create table public.map_place_action_receipts(
        character_id uuid not null, request_id uuid not null, landmark_id text not null,
        action_id text not null, response jsonb, created_at timestamptz not null default now(),
        primary key(character_id,request_id)
      );
      create table public.character_jobs(
        character_id uuid not null, job_id uuid not null, is_current boolean not null default false
      );
      create table public.game_places(id uuid primary key, location_id uuid);

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
    await db.exec(readFileSync("supabase/migrations/20261101145505_map_activity_schedules.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/202610170014_ede_town_travel.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/202610170015_town_travel_arrival.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261109160000_bind_travel_to_canonical_character.sql", "utf8"));
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

  it("binds travel to the newest character when an account has multiple characters", async () => {
    const newestCharacterId = "99999999-9999-4999-8999-999999999999";
    const newestWalletId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    await db.query(
      `insert into public.characters(id,user_id,age,current_location_id,created_at)
       values($1,$2,30,(select id from public.locations where slug='city-centre'),now()+interval '1 minute')`,
      [newestCharacterId, userId],
    );
    await db.query(
      "insert into public.wallets(id,user_id,character_id,balance) values($1,$2,$3,5000)",
      [newestWalletId,userId,newestCharacterId],
    );
    const result = await db.query<{ character_id: string }>(
      `select character_id from public.map_travels
       where user_id=$1 order by departed_at desc limit 1`,
      [userId],
    );
    expect(result.rows[0]?.character_id).toBe(characterId);
    await expect(
      db.query(
        "select public.map_start_travel($1,'oja-oba-market',$2)",
        [userId,"offline-retry-request-0001"],
      ),
    ).rejects.toThrow(/CHARACTER_CHANGED/);
    await db.query(
      "select public.map_start_travel($1,'oja-oba-market',$2)",
      [userId,"newest-character-travel-0001"],
    );
    const trip = await db.query<{ character_id: string }>(
      "select character_id from public.map_travels where idempotency_key=$1",
      ["newest-character-travel-0001"],
    );
    expect(trip.rows[0]?.character_id).toBe(newestCharacterId);
    const balances = await db.query<{ balance: number; character_id: string }>(
      "select balance,character_id from public.wallets where id in ($1,$2) order by character_id",
      [walletId,newestWalletId],
    );
    expect(balances.rows.find((row) => row.character_id === newestCharacterId)?.balance).toBe(4700);
    expect(balances.rows.find((row) => row.character_id === characterId)?.balance).toBe(4700);
  });

  it("binds inter-town travel to the newest character", async () => {
    await db.query(
      "select public.start_osun_town_travel($1,'ede',$2)",
      [userId,"old-character-town-trip-01"],
    );
    const newestCharacterId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const newestWalletId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await db.query(
      `insert into public.characters(id,user_id,age,current_location_id,created_at)
       values($1,$2,30,(select id from public.locations where slug='city-centre'),now()+interval '2 minutes')`,
      [newestCharacterId, userId],
    );
    await db.query(
      "insert into public.wallets(id,user_id,character_id,balance) values($1,$2,$3,5000)",
      [newestWalletId,userId,newestCharacterId],
    );
    await expect(
      db.query(
        "select public.start_osun_town_travel($1,'ede',$2)",
        [userId,"old-character-town-trip-01"],
      ),
    ).rejects.toThrow(/CHARACTER_CHANGED/);
    const result = await db.query<{ result: Record<string, unknown> }>(
      "select public.start_osun_town_travel($1,'ede',$2) as result",
      [userId,"newest-character-town-trip-01"],
    );
    const replay = await db.query<{ result: Record<string, unknown> }>(
      "select public.start_osun_town_travel($1,'ede',$2) as result",
      [userId,"newest-character-town-trip-01"],
    );
    expect(replay.rows[0]?.result).toMatchObject({ duplicate: true, to_town_id: "ede" });
    await expect(
      db.query(
        "select public.start_osun_town_travel($1,'osogbo',$2)",
        [userId,"newest-character-town-trip-01"],
      ),
    ).rejects.toThrow(/IDEMPOTENCY_CONFLICT/);
    const trip = await db.query<{ character_id: string }>(
      "select character_id from public.osun_town_travels where idempotency_key=$1",
      ["newest-character-town-trip-01"],
    );
    expect(trip.rows[0]?.character_id).toBe(newestCharacterId);
    expect(result.rows[0]?.result).toMatchObject({
      from_town_id: "osogbo",
      to_town_id: "ede",
      fare: 1200,
      status: "travelling",
    });
    const balances = await db.query<{ balance: number; character_id: string }>(
      "select balance,character_id from public.wallets where id in ($1,$2) order by character_id",
      [walletId,newestWalletId],
    );
    expect(balances.rows.find((row) => row.character_id === newestCharacterId)?.balance).toBe(3800);
    expect(balances.rows.find((row) => row.character_id === characterId)?.balance).toBe(3500);
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

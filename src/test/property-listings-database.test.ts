// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const SALE_MIGRATION = "supabase/migrations/20261123020000_property_sales_to_npc.sql";
const LISTING_MIGRATION = "supabase/migrations/20261123030000_property_listings_for_players.sql";
const SELLER_USER = "11111111-1111-4111-8111-111111111111";
const BUYER_USER = "22222222-2222-4222-8222-222222222222";
const HOMED_USER = "33333333-3333-4333-8333-333333333333";
const POOR_USER = "44444444-4444-4444-8444-444444444444";
const SELLER = "a1111111-1111-4111-8111-111111111111";
const BUYER = "a2222222-2222-4222-8222-222222222222";
const HOMED = "a3333333-3333-4333-8333-333333333333";
const POOR = "a4444444-4444-4444-8444-444444444444";
const HOUSE_TYPE = "ht-1";
const H_OWNED = "b1111111-1111-4111-8111-111111111111"; // owned house, price 1,000,000
const H_RENT = "b2222222-2222-4222-8222-222222222222"; // rented room
const P_SELL = "c1111111-1111-4111-8111-111111111111";
const P_RENT = "c2222222-2222-4222-8222-222222222222";
const P_SELL_2 = "c3333333-3333-4333-8333-333333333333";
const P_HOMED = "c4444444-4444-4444-8444-444444444444";
const HOUSE = "d1111111-1111-4111-8111-111111111111";

let db: PGlite;

async function asUser(uid: string) {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
}
async function balance(character: string) {
  const { rows } = await db.query<{ balance: string }>(
    "select balance::text as balance from public.wallets where character_id = $1",
    [character],
  );
  return Number(rows[0]!.balance);
}
async function call(sql: string, params: unknown[]) {
  const { rows } = await db.query<{ result: Record<string, unknown> }>(
    `select ${sql} as result`,
    params,
  );
  return rows[0]!.result;
}

describe("player listings for owned homes", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('test.uid', true), '')::uuid $$;
      create table public.characters(id uuid primary key, user_id uuid unique, name text);
      create function public._my_character_id() returns uuid language sql stable as $$
        select id from public.characters where user_id = auth.uid() $$;
      create table public.wallets(id uuid primary key default gen_random_uuid(), character_id uuid unique,
        balance bigint not null, total_income bigint not null default 0,
        total_expenses bigint not null default 0, updated_at timestamptz);
      create table public.transactions(id uuid primary key default gen_random_uuid(), user_id uuid,
        wallet_id uuid, character_id uuid, amount bigint, kind text, category text, description text,
        transaction_type text, account text, source text, destination text, balance_after bigint,
        metadata jsonb);
      create table public.economy_request_results(character_id uuid, request_id uuid,
        operation text, result jsonb, primary key (character_id, request_id));
      create table public.game_properties(id uuid primary key, name text, property_type text,
        purchase_price bigint, rent_price bigint, house_type_id text);
      create table public.player_properties(id uuid primary key, user_id uuid, character_id uuid,
        property_id uuid, tenure text, is_active boolean, is_home boolean default false, updated_at timestamptz);
      create table public.property_rent_cycles(id uuid primary key default gen_random_uuid(),
        player_property_id uuid, character_id uuid, status text, paid_at timestamptz);
      create table public.player_houses(id uuid primary key, player_id uuid, house_type_id text,
        status text, player_property_id uuid);
      create table public.player_homes(id uuid primary key default gen_random_uuid(),
        character_id uuid, user_id uuid, house_type_id text);
      create table public.house_placements(id uuid primary key default gen_random_uuid(),
        player_house_id uuid, item_id text);
      create table public.player_stalls(id uuid primary key, character_id uuid unique, is_open boolean);
      create table public.stall_items(id uuid primary key default gen_random_uuid(), stall_id uuid,
        item_id uuid, quantity integer);
      create table public.player_inventory(id uuid primary key default gen_random_uuid(), user_id uuid,
        character_id uuid, item_id uuid, quantity integer, unique (character_id, item_id));
    `);
    await db.exec(readFileSync(SALE_MIGRATION, "utf8"));
    await db.exec(readFileSync(LISTING_MIGRATION, "utf8"));
    await db.exec(`
      insert into auth.users(id) values ('${SELLER_USER}'), ('${BUYER_USER}'), ('${HOMED_USER}'), ('${POOR_USER}');
      insert into public.characters(id, user_id, name) values
        ('${SELLER}', '${SELLER_USER}', 'Adebayo'), ('${BUYER}', '${BUYER_USER}', 'Ngozi'),
        ('${HOMED}', '${HOMED_USER}', 'Tunde'), ('${POOR}', '${POOR_USER}', 'Femi');
      insert into public.wallets(character_id, balance, updated_at) values
        ('${SELLER}', 0, now()), ('${BUYER}', 2000000, now()), ('${HOMED}', 5000000, now()), ('${POOR}', 100, now());
      insert into public.game_properties(id, name, property_type, purchase_price, rent_price, house_type_id) values
        ('${H_OWNED}', 'Adeola House', 'house', 1000000, null, '${HOUSE_TYPE}'),
        ('${H_RENT}', 'Shared Room', 'room', null, 50000, '${HOUSE_TYPE}');
      insert into public.player_properties(id, user_id, character_id, property_id, tenure, is_active) values
        ('${P_SELL}', '${SELLER_USER}', '${SELLER}', '${H_OWNED}', 'owned', true),
        ('${P_RENT}', '${SELLER_USER}', '${SELLER}', '${H_RENT}', 'rented', true),
        ('${P_SELL_2}', '${SELLER_USER}', '${SELLER}', '${H_OWNED}', 'owned', true),
        ('${P_HOMED}', '${HOMED_USER}', '${HOMED}', '${H_OWNED}', 'owned', true);
      insert into public.player_houses values ('${HOUSE}', '${SELLER_USER}', '${HOUSE_TYPE}', 'active', '${P_SELL}');
      insert into public.house_placements(player_house_id, item_id) values ('${HOUSE}', 'sofa');
      insert into public.player_homes(character_id, user_id, house_type_id) values ('${SELLER}', '${SELLER_USER}', '${HOUSE_TYPE}');
    `);
  });

  afterAll(async () => {
    await db?.close();
  });

  let listingId = "";

  it("lists an owned home at a price, and refuses a second listing of it", async () => {
    await asUser(SELLER_USER);
    const listed = await call("public.list_property_for_sale($1, $2)", [P_SELL, 900000]);
    expect(listed).toMatchObject({ ok: true, askingMinor: 900000 });
    listingId = String(listed["listingId"]);
    await expect(call("public.list_property_for_sale($1, $2)", [P_SELL, 900000])).rejects.toThrow(
      "ALREADY_LISTED",
    );
  });

  it("refuses rented homes, prices above the cap, and zero prices", async () => {
    await asUser(SELLER_USER);
    await expect(call("public.list_property_for_sale($1, $2)", [P_RENT, 1000])).rejects.toThrow(
      "ONLY_OWNED_HOMES_CAN_BE_LISTED",
    );
    await expect(
      call("public.list_property_for_sale($1, $2)", [P_SELL_2, 3000001]),
    ).rejects.toThrow("PRICE_OUT_OF_RANGE");
    await expect(call("public.list_property_for_sale($1, $2)", [P_SELL_2, 0])).rejects.toThrow(
      "INVALID_PRICE",
    );
  });

  it("shows open listings to other players, and marks the seller's own", async () => {
    await asUser(BUYER_USER);
    const { rows } = await db.query<{
      market: Array<{ listingId: string; isMine: boolean; sellerName: string }>;
    }>("select public.property_market_listings() as market");
    const listing = rows[0]!.market.find((row) => row.listingId === listingId);
    expect(listing).toMatchObject({ isMine: false, sellerName: "Adebayo" });
    await asUser(SELLER_USER);
    const mine = await db.query<{ market: Array<{ listingId: string; isMine: boolean }> }>(
      "select public.property_market_listings() as market",
    );
    expect(mine.rows[0]!.market.find((row) => row.listingId === listingId)?.isMine).toBe(true);
  });

  it("refuses a buyer who already has a home, and the seller buying their own listing", async () => {
    await asUser(HOMED_USER);
    await expect(
      call("public.buy_property_listing($1, $2)", [
        listingId,
        "20000000-0000-4000-8000-000000000001",
      ]),
    ).rejects.toThrow("ALREADY_HAS_HOME");
    await asUser(SELLER_USER);
    await expect(
      call("public.buy_property_listing($1, $2)", [
        listingId,
        "20000000-0000-4000-8000-000000000002",
      ]),
    ).rejects.toThrow("CANNOT_BUY_OWN_LISTING");
  });

  it("refuses a buyer who cannot afford the asking price", async () => {
    await asUser(POOR_USER);
    await expect(
      call("public.buy_property_listing($1, $2)", [
        listingId,
        "20000000-0000-4000-8000-000000000003",
      ]),
    ).rejects.toThrow("INSUFFICIENT_FUNDS");
  });

  it("moves the home and its furniture to a player buyer, and pays the seller", async () => {
    await asUser(BUYER_USER);
    const buyerBefore = await balance(BUYER);
    const sellerBefore = await balance(SELLER);
    const bought = await call("public.buy_property_listing($1, $2)", [
      listingId,
      "20000000-0000-4000-8000-000000000004",
    ]);
    expect(bought).toMatchObject({ ok: true, amountMinor: 900000, duplicate: false });
    expect(await balance(BUYER)).toBe(buyerBefore - 900000);
    expect(await balance(SELLER)).toBe(sellerBefore + 900000);

    const home = await db.query<{ character_id: string; user_id: string; is_active: boolean }>(
      "select character_id, user_id, is_active from public.player_properties where id = $1",
      [P_SELL],
    );
    expect(home.rows[0]).toMatchObject({
      character_id: BUYER,
      user_id: BUYER_USER,
      is_active: true,
    });
    const house = await db.query<{ player_id: string; status: string }>(
      "select player_id, status from public.player_houses where id = $1",
      [HOUSE],
    );
    expect(house.rows[0]).toMatchObject({ player_id: BUYER_USER, status: "active" });
    const placements = await db.query(
      "select 1 from public.house_placements where player_house_id = $1",
      [HOUSE],
    );
    expect(placements.rows).toHaveLength(1);
    const sold = await db.query<{ status: string; buyer_character_id: string }>(
      "select status, buyer_character_id from public.property_listings where id = $1",
      [listingId],
    );
    expect(sold.rows[0]).toMatchObject({ status: "sold", buyer_character_id: BUYER });
  });

  it("replays the same purchase request without charging twice", async () => {
    await asUser(BUYER_USER);
    const buyerBefore = await balance(BUYER);
    const again = await call("public.buy_property_listing($1, $2)", [
      listingId,
      "20000000-0000-4000-8000-000000000004",
    ]);
    expect(again).toMatchObject({ ok: true, duplicate: true });
    expect(await balance(BUYER)).toBe(buyerBefore);
  });

  it("cancelled listings cannot be bought", async () => {
    await asUser(SELLER_USER);
    const listed = await call("public.list_property_for_sale($1, $2)", [P_SELL_2, 500000]);
    await call("public.cancel_property_listing($1)", [listed["listingId"]]);
    await asUser(BUYER_USER);
    await expect(
      call("public.buy_property_listing($1, $2)", [
        listed["listingId"],
        "20000000-0000-4000-8000-000000000005",
      ]),
    ).rejects.toThrow("LISTING_NOT_OPEN");
  });
});

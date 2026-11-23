// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const MIGRATION = "supabase/migrations/20261123020000_property_sales_to_npc.sql";
const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";
const C1 = "a1111111-1111-4111-8111-111111111111";
const C2 = "a2222222-2222-4222-8222-222222222222";
const HOUSE_TYPE = "ht-1";
const H_OWNED = "b1111111-1111-4111-8111-111111111111"; // owned house, 1,000,000
const H_RENT = "b2222222-2222-4222-8222-222222222222"; // rented room, 50,000 a week
const S_STALL = "b3333333-3333-4333-8333-333333333333"; // market stall, 2,000 a week
const P_HOME = "c1111111-1111-4111-8111-111111111111";
const P_RENTED_HOME = "c2222222-2222-4222-8222-222222222222";
const P_STALL = "c3333333-3333-4333-8333-333333333333";
const P_OTHER = "c4444444-4444-4444-8444-444444444444";
const P_OVERDUE = "c5555555-5555-4555-8555-555555555555";
const HOUSE = "d1111111-1111-4111-8111-111111111111";
const STALL = "e1111111-1111-4111-8111-111111111111";
const ITEM = "f1111111-1111-4111-8111-111111111111";
const WALLET = "99999999-9999-4999-8999-999999999999";

let db: PGlite;

async function asUser(uid: string) {
  await db.query("select set_config('test.uid', $1, false)", [uid]);
}

async function balanceOf(character: string) {
  const { rows } = await db.query<{ balance: string }>(
    "select balance::text as balance from public.wallets where character_id = $1",
    [character],
  );
  return Number(rows[0]!.balance);
}

async function sell(property: string, request: string) {
  const { rows } = await db.query<{ result: Record<string, unknown> }>(
    "select public.sell_property_to_npc($1, $2) as result",
    [property, request],
  );
  return rows[0]!.result;
}

describe("selling properties to an NPC buyer", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key, is_anonymous boolean default false);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('test.uid', true), '')::uuid $$;
      create function public._my_character_id() returns uuid language sql stable as $$
        select null::uuid $$;
      create table public.characters(id uuid primary key, user_id uuid unique);
      create table public.wallets(id uuid primary key, character_id uuid unique,
        balance bigint not null, total_income bigint not null default 0, updated_at timestamptz);
      create table public.transactions(id uuid primary key default gen_random_uuid(), user_id uuid,
        wallet_id uuid, character_id uuid, amount bigint, kind text, category text, description text,
        transaction_type text, account text, source text, destination text, balance_after bigint,
        metadata jsonb);
      create table public.economy_request_results(character_id uuid, request_id uuid,
        operation text, result jsonb, primary key (character_id, request_id));
      create table public.game_properties(id uuid primary key, name text, property_type text,
        purchase_price bigint, rent_price bigint, house_type_id text);
      create table public.player_properties(id uuid primary key, character_id uuid, property_id uuid,
        tenure text, is_active boolean, is_home boolean default false, updated_at timestamptz);
      create table public.property_rent_cycles(id uuid primary key default gen_random_uuid(),
        player_property_id uuid, status text, paid_at timestamptz);
      create table public.player_houses(id uuid primary key, player_id uuid, house_type_id text,
        status text, player_property_id uuid);
      create table public.player_homes(id uuid primary key default gen_random_uuid(),
        character_id uuid, house_type_id text);
      create table public.house_placements(id uuid primary key default gen_random_uuid(),
        player_house_id uuid, item_id text);
      create table public.player_stalls(id uuid primary key, character_id uuid unique, is_open boolean);
      create table public.stall_items(id uuid primary key default gen_random_uuid(), stall_id uuid,
        item_id uuid, quantity integer);
      create table public.player_inventory(id uuid primary key default gen_random_uuid(), user_id uuid,
        character_id uuid, item_id uuid, quantity integer, unique (character_id, item_id));
    `);
    await db.exec(readFileSync(MIGRATION, "utf8"));
    await db.exec(`
      insert into auth.users(id) values ('${U1}'), ('${U2}');
      insert into public.characters values ('${C1}', '${U1}'), ('${C2}', '${U2}');
      insert into public.wallets values ('${WALLET}', '${C1}', 100, 0, now());
      insert into public.game_properties values
        ('${H_OWNED}', 'Adeola House', 'house', 1000000, null, '${HOUSE_TYPE}'),
        ('${H_RENT}', 'Shared Room', 'room', null, 50000, '${HOUSE_TYPE}'),
        ('${S_STALL}', 'Oja-Oba Stall', 'market_stall', null, 2000, null);
      insert into public.player_properties(id, character_id, property_id, tenure, is_active) values
        ('${P_HOME}', '${C1}', '${H_OWNED}', 'owned', true),
        ('${P_RENTED_HOME}', '${C1}', '${H_RENT}', 'rented', true),
        ('${P_STALL}', '${C1}', '${S_STALL}', 'rented', true),
        ('${P_OTHER}', '${C2}', '${H_OWNED}', 'owned', true),
        ('${P_OVERDUE}', '${C2}', '${H_OWNED}', 'owned', true);
      insert into public.property_rent_cycles(player_property_id, status) values ('${P_OVERDUE}', 'due');
      insert into public.player_houses values ('${HOUSE}', '${U1}', '${HOUSE_TYPE}', 'active', '${P_HOME}');
      insert into public.house_placements(player_house_id, item_id) values ('${HOUSE}', 'sofa');
      insert into public.player_homes(character_id, house_type_id) values ('${C1}', '${HOUSE_TYPE}');
      insert into public.player_stalls values ('${STALL}', '${C1}', true);
      insert into public.stall_items(stall_id, item_id, quantity) values ('${STALL}', '${ITEM}', 4);
    `);
  });

  afterAll(async () => {
    await db?.close();
  });

  it("pays 75% of an owned home's price, and the home sells with its furniture", async () => {
    await asUser(U1);
    const before = await balanceOf(C1);
    const result = await sell(P_HOME, "10000000-0000-4000-8000-000000000001");
    expect(result).toMatchObject({ ok: true, kind: "home", amountMinor: 750000, duplicate: false });
    expect(await balanceOf(C1)).toBe(before + 750000);

    const home = await db.query<{ is_active: boolean }>(
      "select is_active from public.player_properties where id = $1",
      [P_HOME],
    );
    expect(home.rows[0]!.is_active).toBe(false);
    const placements = await db.query(
      "select 1 from public.house_placements where player_house_id = $1",
      [HOUSE],
    );
    expect(placements.rows).toHaveLength(0);
    const house = await db.query<{ status: string }>(
      "select status from public.player_houses where id = $1",
      [HOUSE],
    );
    expect(house.rows[0]!.status).toBe("ended");
    const sale = await db.query<{ amount: string }>(
      "select amount::text as amount from public.transactions where category = 'property_sale' and character_id = $1",
      [C1],
    );
    expect(sale.rows.map((row) => Number(row.amount))).toContain(750000);
  });

  it("replays the same request without paying twice", async () => {
    await asUser(U1);
    const before = await balanceOf(C1);
    const again = await sell(P_HOME, "10000000-0000-4000-8000-000000000001");
    expect(again).toMatchObject({ ok: true, amountMinor: 750000, duplicate: true });
    expect(await balanceOf(C1)).toBe(before);
  });

  it("refuses a rented home, which can only be moved out of", async () => {
    await asUser(U1);
    await expect(sell(P_RENTED_HOME, "10000000-0000-4000-8000-000000000002")).rejects.toThrow(
      "RENTED_HOME_CANNOT_BE_SOLD",
    );
  });

  it("refuses to sell a property the player does not own", async () => {
    await asUser(U1);
    await expect(sell(P_OTHER, "10000000-0000-4000-8000-000000000003")).rejects.toThrow(
      "NOT_OWNED",
    );
  });

  it("requires overdue rent to be paid before a sale", async () => {
    await asUser(U2);
    await expect(sell(P_OVERDUE, "10000000-0000-4000-8000-000000000004")).rejects.toThrow(
      "PAY_OVERDUE_RENT_FIRST",
    );
  });

  it("sells a stall for 75% of one week's rent and returns its stock to the bag", async () => {
    await asUser(U1);
    const before = await balanceOf(C1);
    const result = await sell(P_STALL, "10000000-0000-4000-8000-000000000005");
    expect(result).toMatchObject({ ok: true, kind: "stall", amountMinor: 1500, duplicate: false });
    expect(await balanceOf(C1)).toBe(before + 1500);

    const bag = await db.query<{ quantity: number }>(
      "select quantity from public.player_inventory where character_id = $1 and item_id = $2",
      [C1, ITEM],
    );
    expect(bag.rows[0]!.quantity).toBe(4);
    const stock = await db.query("select 1 from public.stall_items where stall_id = $1", [STALL]);
    expect(stock.rows).toHaveLength(0);
    const stall = await db.query<{ is_open: boolean }>(
      "select is_open from public.player_stalls where id = $1",
      [STALL],
    );
    expect(stall.rows[0]!.is_open).toBe(false);
  });
});

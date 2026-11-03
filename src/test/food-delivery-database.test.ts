// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from "vitest";

const migrationPath = "supabase/migrations/20261103060644_food_delivery_lifecycle.sql";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const aliceCharacter = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bobCharacter = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const aliceHome = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const bobHome = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const vendorId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const menuId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const existingOrderId = "11111111-aaaa-4aaa-8aaa-111111111111";
const existingRideId = "22222222-aaaa-4aaa-8aaa-222222222222";
const existingFoodRequestId = "33333333-aaaa-4aaa-8aaa-333333333333";
const existingRideRequestId = "44444444-aaaa-4aaa-8aaa-444444444444";
let db: PGlite;

async function query<T>(sql: string, params: unknown[] = []) {
  await db.exec("savepoint delivery_call");
  try {
    const response = await db.query<T>(sql, params);
    await db.exec("release savepoint delivery_call");
    return response.rows;
  } catch (error) {
    await db.exec("rollback to savepoint delivery_call;release savepoint delivery_call");
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
      id uuid primary key,
      user_id uuid not null,
      inside_home_property_id uuid,
      current_location_id uuid not null
    );
    create table public.game_properties (
      id uuid primary key,
      house_type_id uuid,
      location_id uuid not null
    );
    create table public.player_properties (
      id uuid primary key,
      property_id uuid not null,
      character_id uuid not null,
      user_id uuid not null,
      is_active boolean not null,
      is_home boolean not null
    );
    create table public.player_houses (
      player_property_id uuid not null,
      player_id uuid not null,
      status text not null
    );
    create table public.food_vendors (
      id uuid primary key,
      name text not null,
      active boolean not null default true
    );
    create table public.food_menu_items (
      id uuid primary key,
      vendor_id uuid not null,
      name text not null,
      price_minor bigint not null,
      active boolean not null default true
    );
    create table public.food_orders (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      character_id uuid not null,
      vendor_id uuid not null,
      total_minor bigint not null,
      status text not null check (status in ('requested', 'preparing', 'delivered', 'cancelled')),
      created_at timestamptz not null default now()
    );
    create table public.food_order_items (
      order_id uuid not null,
      menu_item_id uuid not null,
      quantity integer not null,
      unit_price_minor bigint not null,
      primary key(order_id, menu_item_id)
    );
    create table public.okada_ride_requests (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null,
      character_id uuid not null,
      destination text not null,
      fare_minor bigint not null,
      status text not null check (status in ('requested', 'assigned', 'completed', 'cancelled')),
      created_at timestamptz not null default now()
    );
    create table public.town_service_prices (
      service text primary key,
      amount_minor bigint not null,
      active boolean not null default true
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
      user_id uuid not null,
      wallet_id uuid not null,
      character_id uuid not null,
      amount bigint not null,
      kind text not null,
      category text not null,
      description text not null,
      transaction_type text not null,
      account text not null,
      source text not null,
      destination text not null,
      balance_after bigint not null,
      metadata jsonb not null
    );
    create table public.economy_request_results (
      character_id uuid not null,
      request_id uuid not null,
      operation text not null,
      result jsonb not null,
      primary key(character_id, request_id, operation)
    );
    create function public._my_character_id() returns uuid
      language sql stable security definer set search_path = public as $$
      select id from public.characters where user_id = auth.uid() order by id limit 1
    $$;

    insert into public.characters values
      ('${aliceCharacter}', '${alice}', '${aliceHome}', '33333333-3333-4333-8333-333333333333'),
      ('${bobCharacter}', '${bob}', '${bobHome}', '44444444-4444-4444-8444-444444444444');
    insert into public.game_properties values
      ('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666', '33333333-3333-4333-8333-333333333333'),
      ('77777777-7777-4777-8777-777777777777', '88888888-8888-4888-8888-888888888888', '44444444-4444-4444-8444-444444444444');
    insert into public.player_properties values
      ('${aliceHome}', '55555555-5555-4555-8555-555555555555', '${aliceCharacter}', '${alice}', true, true),
      ('${bobHome}', '77777777-7777-4777-8777-777777777777', '${bobCharacter}', '${bob}', true, true);
    insert into public.player_houses values
      ('${aliceHome}', '${alice}', 'active'),
      ('${bobHome}', '${bob}', 'active');
    insert into public.food_vendors values ('${vendorId}', 'Iya Mufu Kitchen', true);
    insert into public.food_menu_items values ('${menuId}', '${vendorId}', 'Jollof rice', 125, true);
    insert into public.wallets(user_id, character_id, balance, total_expenses) values
      ('${alice}', '${aliceCharacter}', 500, 300),
      ('${bob}', '${bobCharacter}', 500, 0);
    insert into public.food_orders(id, user_id, character_id, vendor_id, total_minor, status)
      values ('${existingOrderId}', '${alice}', '${aliceCharacter}', '${vendorId}', 250, 'requested');
    insert into public.food_order_items values ('${existingOrderId}', '${menuId}', 2, 125);
    insert into public.okada_ride_requests(id, user_id, character_id, destination, fare_minor, status)
      values ('${existingRideId}', '${alice}', '${aliceCharacter}', 'Town market', 100, 'requested');
    insert into public.town_service_prices values ('okada_ride', 100, true);
    insert into public.economy_request_results(character_id, request_id, operation, result) values
      ('${aliceCharacter}', '${existingFoodRequestId}', 'food_delivery',
        jsonb_build_object('orderId', '${existingOrderId}', 'total', 250, 'cash', 500, 'status', 'requested')),
      ('${aliceCharacter}', '${existingRideRequestId}', 'okada_ride',
        jsonb_build_object('rideId', '${existingRideId}', 'fare', 100, 'cash', 500, 'status', 'requested'));
  `);
  await db.exec(readFileSync(migrationPath, "utf8"));
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

it("approves old food and ride requests without charging their owners again", async () => {
  expect(
    await query("select status from public.food_orders where id = $1", [existingOrderId]),
  ).toEqual([{ status: "preparing" }]);
  expect(
    await query("select status from public.okada_ride_requests where id = $1", [existingRideId]),
  ).toEqual([{ status: "assigned" }]);
  expect(
    await query("select balance, total_expenses from public.wallets where user_id = $1", [alice]),
  ).toEqual([{ balance: 500, total_expenses: 300 }]);

  await db.exec("set local role authenticated");
  await expect(
    value("public.request_food_delivery($1, $2::jsonb, $3)", [
      vendorId,
      JSON.stringify([{ menu_item_id: menuId, quantity: 2 }]),
      existingFoodRequestId,
    ]),
  ).resolves.toMatchObject({ status: "preparing" });
  await expect(
    value("public.request_okada_ride($1, $2)", ["Town market", existingRideRequestId]),
  ).resolves.toMatchObject({ status: "assigned" });
});

it("charges new food and ride requests once and records their approved status", async () => {
  await db.exec("set local role authenticated");
  const foodRequestId = "99999999-9999-4999-8999-999999999999";
  await expect(
    value("public.request_food_delivery($1, $2::jsonb, $3)", [
      vendorId,
      JSON.stringify({ not: "an item list" }),
      foodRequestId,
    ]),
  ).rejects.toThrow("Choose menu items");
  const foodResult = await value<{ status: string }>(
    "public.request_food_delivery($1, $2::jsonb, $3)",
    [vendorId, JSON.stringify([{ menu_item_id: menuId, quantity: 1 }]), foodRequestId],
  );
  const replayedFoodResult = await value<{ status: string }>(
    "public.request_food_delivery($1, $2::jsonb, $3)",
    [vendorId, JSON.stringify([{ menu_item_id: menuId, quantity: 1 }]), foodRequestId],
  );
  expect(foodResult.status).toBe("preparing");
  expect(replayedFoodResult).toEqual(foodResult);

  const rideRequestId = "aaaaaaaa-9999-4999-8999-999999999999";
  const rideResult = await value<{ status: string }>("public.request_okada_ride($1, $2)", [
    "Town market",
    rideRequestId,
  ]);
  expect(rideResult.status).toBe("assigned");
  await db.exec("reset role");
  expect(
    await query("select balance, total_expenses from public.wallets where user_id = $1", [alice]),
  ).toEqual([{ balance: 275, total_expenses: 525 }]);
  expect(
    await query("select id from public.transactions where user_id = $1", [alice]),
  ).toHaveLength(2);
});

it("keeps the courier at the owner's home until a single handoff and package collection", async () => {
  await db.exec("reset role");
  await query("update public.characters set inside_home_property_id = null where id = $1", [
    aliceCharacter,
  ]);
  await db.exec("set local role authenticated");
  expect(await value("public.process_home_food_deliveries()")).toEqual([]);
  await expect(
    value("public.respond_to_home_food_delivery($1, $2)", [existingOrderId, null]),
  ).rejects.toThrow("Choose whether to invite the courier inside");

  await db.exec("reset role");
  await query("update public.characters set inside_home_property_id = $1 where id = $2", [
    aliceHome,
    aliceCharacter,
  ]);
  await db.exec("set local role authenticated");
  const arriving = await value<Array<{ id: string; deliveryState: string; vendorName: string }>>(
    "public.process_home_food_deliveries()",
  );
  expect(arriving).toMatchObject([
    { id: existingOrderId, deliveryState: "awaiting_response", vendorName: "Iya Mufu Kitchen" },
  ]);

  await expect(
    value("public.respond_to_home_food_delivery($1, $2)", [existingOrderId, "outside"]),
  ).resolves.toMatchObject({ deliveryState: "approaching", deliveryChoice: "outside" });
  await expect(
    value("public.respond_to_home_food_delivery($1, $2)", [existingOrderId, "inside"]),
  ).rejects.toThrow("no longer waiting for a response");

  await db.exec("reset role");
  await query(
    "update public.food_orders set handoff_due_at = now() - interval '1 second' where id = $1",
    [existingOrderId],
  );
  await db.exec("set local role authenticated");
  const packageWaiting = await value<
    Array<{ id: string; deliveryState: string; items: Array<{ name: string; quantity: number }> }>
  >("public.process_home_food_deliveries()");
  expect(packageWaiting).toMatchObject([
    {
      id: existingOrderId,
      deliveryState: "package_waiting",
      items: [{ name: "Jollof rice", quantity: 2 }],
    },
  ]);

  await expect(
    value("public.collect_home_food_delivery($1)", [existingOrderId]),
  ).resolves.toMatchObject({ deliveryState: "collected" });
  await expect(
    value("public.collect_home_food_delivery($1)", [existingOrderId]),
  ).resolves.toMatchObject({ deliveryState: "collected" });
});

it("does not expose or hand off another player's order", async () => {
  await db.exec("set local role authenticated");
  await db.query("select set_config('test.user_id', $1, true)", [bob]);
  await expect(
    value("public.respond_to_home_food_delivery($1, $2)", [existingOrderId, "inside"]),
  ).rejects.toThrow("no longer waiting for a response");
  expect(await value("public.process_home_food_deliveries()")).toEqual([]);
});

it("keeps lifecycle RPCs authenticated-only and order writes server-side", async () => {
  await db.exec("set local role anon");
  await expect(value("public.process_home_food_deliveries()")).rejects.toThrow("permission denied");

  await db.exec("reset role;set local role authenticated");
  await expect(
    query("update public.food_orders set delivery_state = 'collected' where id = $1", [
      existingOrderId,
    ]),
  ).rejects.toThrow("permission denied");
});

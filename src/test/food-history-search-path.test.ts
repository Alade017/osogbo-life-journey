// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";

const originalMigration = "supabase/migrations/20261106040000_food_history_delivery_choice.sql";
const pinMigration = "supabase/migrations/20261106120100_food_history_search_path.sql";
const USER = "11111111-1111-1111-1111-111111111111";
const CHARACTER = "22222222-2222-2222-2222-222222222222";

let db: PGlite;

describe("food delivery history function", () => {
  beforeAll(async () => {
    db = new PGlite();
    // Minimal stand-ins for the Supabase auth schema and the tables the function reads.
    await db.exec(`
      create schema auth;
      create function auth.uid() returns uuid language sql stable as $$
        select '${USER}'::uuid
      $$;
      create function public._my_character_id() returns uuid language sql stable as $$
        select '${CHARACTER}'::uuid
      $$;
      create table public.food_vendors (id uuid primary key, name text not null);
      create table public.food_menu_items (id uuid primary key, name text not null);
      create table public.food_orders (
        id uuid primary key, user_id uuid not null, character_id uuid not null,
        vendor_id uuid not null references public.food_vendors(id), total_minor bigint not null,
        status text not null, delivery_state text not null default 'pending', delivery_choice text,
        created_at timestamptz not null default now()
      );
      create table public.food_order_items (
        order_id uuid not null references public.food_orders(id),
        menu_item_id uuid not null references public.food_menu_items(id), quantity integer not null
      );
      insert into public.food_vendors values ('33333333-3333-3333-3333-333333333333', 'Town kitchen');
      insert into public.food_menu_items values ('44444444-4444-4444-4444-444444444444', 'Rice');
      insert into public.food_orders (id, user_id, character_id, vendor_id, total_minor, status)
        values ('55555555-5555-5555-5555-555555555555', '${USER}', '${CHARACTER}',
                '33333333-3333-3333-3333-333333333333', 1000, 'preparing');
      insert into public.food_order_items values
        ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', 2);
    `);
    await db.exec(readFileSync(originalMigration, "utf8"));
    await db.exec(readFileSync(pinMigration, "utf8"));
  }, 180_000);

  it("pins the search path to the empty path", async () => {
    const result = await db.query<{ config: string[] | null }>(
      `select proconfig as config from pg_proc where proname = 'get_food_delivery_history'`,
    );
    expect(result.rows[0]?.config).toEqual([`search_path=""`]);
  });

  it("still returns the caller's orders with vendor and item details", async () => {
    const result = await db.query<{ history: unknown }>(
      `select public.get_food_delivery_history() as history`,
    );
    expect(result.rows[0]?.history).toEqual([
      {
        id: "55555555-5555-5555-5555-555555555555",
        totalMinor: 1000,
        status: "preparing",
        deliveryState: "pending",
        deliveryChoice: null,
        createdAt: expect.any(String),
        vendorName: "Town kitchen",
        items: [{ name: "Rice", quantity: 2 }],
      },
    ]);
  });
});

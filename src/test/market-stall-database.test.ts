// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const seller = "11111111-1111-4111-8111-111111111111";
const buyer = "22222222-2222-4222-8222-222222222222";
const noLease = "33333333-3333-4333-8333-333333333333";
const requestId = (n: number) => `00000000-0000-4000-8000-${n.toString().padStart(12, "0")}`;

async function call<T>(sql: string, params: unknown[] = []) {
  return (await db.query<{ value: T }>(`select ${sql} as value`, params)).rows[0]!.value;
}

async function asUser(userId: string) {
  await db.query("select set_config('test.user_id',$1,false)", [userId]);
}

async function deny(sql: string, params: unknown[], reason: string) {
  await db.exec("savepoint expected_failure");
  await expect(db.query(sql, params)).rejects.toThrow(reason);
  await db.exec("rollback to expected_failure;release expected_failure");
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema extensions;create schema realtime;
    create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('test.user_id',true),'')::uuid
    $$;
    create function realtime.topic() returns text language sql stable as $$select ''::text$$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement)
      returns void language plpgsql as $$begin return;end$$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;`);

  const migrationFiles = readdirSync("drizzle/migrations")
    .filter(
      (file) =>
        file.endsWith(".sql") &&
        !file.startsWith("0075_") &&
        file !== "0077_market_stall_rent_categories_sales.sql",
    )
    .sort();
  for (const file of migrationFiles) {
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8").replace(/^\uFEFF/, ""));
  }
  await db.exec(
    readFileSync("supabase/migrations/20261027104102_stall_passive_income.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261028143246_public_player_stall_discovery.sql", "utf8"),
  );
  await db.exec(`insert into auth.users(id) values ('${seller}'),('${buyer}'),('${noLease}');
    insert into public.profiles(id) values ('${seller}'),('${buyer}'),('${noLease}');
    insert into public.characters(user_id,name,gender,age,personality) values
      ('${seller}','Ade','male',24,'creative'),
      ('${buyer}','Bisi','female',23,'ambitious'),
      ('${noLease}','Tayo','male',25,'ambitious');
    insert into public.wallets(user_id,character_id,balance)
      select user_id,id,10000 from public.characters;
    insert into public.player_stalls(user_id,character_id,name,goods,is_open)
      select user_id,id,'Ade Fabric Corner','Adire and Ankara',true
      from public.characters where user_id='${seller}';
    insert into public.player_inventory(user_id,character_id,item_id,quantity)
      select '${seller}',character.id,item.id,3
      from public.characters character
      cross join public.inventory_items item
      where character.user_id='${seller}' and item.slug='meat_pie';`);
  await db.exec(
    readFileSync("drizzle/migrations/0077_market_stall_rent_categories_sales.sql", "utf8"),
  );
}, 180_000);

beforeEach(async () => {
  await db.exec("begin");
  await asUser(seller);
});

afterEach(async () => {
  await db.exec("rollback;reset role;");
});

afterAll(async () => {
  await db?.close();
});

describe("market stall rental, categories and sales", () => {
  it("charges the first week once, enforces rental gating and validates categories", async () => {
    expect(
      (
        await db.query("select stall_category,is_open from player_stalls where user_id=$1", [
          seller,
        ])
      ).rows[0],
    ).toEqual({ stall_category: "fabrics", is_open: false });
    const first = await call<{ duplicate: boolean; weeklyRentMinor: number }>(
      "public.rent_market_stall($1::uuid)",
      [requestId(1)],
    );
    expect(first).toMatchObject({ duplicate: false, weeklyRentMinor: 2000 });
    expect(
      await call("public.rent_market_stall($1::uuid)", [requestId(1)]),
    ).toMatchObject({ duplicate: true, weeklyRentMinor: 2000 });
    expect(
      (await db.query("select balance from wallets where user_id=$1", [seller])).rows[0]?.balance,
    ).toBe(8000);
    await deny(
      "select public.rent_market_stall($1::uuid)",
      [requestId(2)],
      "ALREADY_RENTING",
    );
    await asUser(noLease);
    await deny(
      "select public.save_player_stall('Unrented','Crafts',true)",
      [],
      "Rent a current stall before saving",
    );
    await asUser(seller);
    await deny(
      "select public.save_player_stall('Invalid category','unmapped goods',false)",
      [],
      "Choose a valid stall category",
    );
    await call("public.save_player_stall('Ade Fabric Corner','fabrics',true)");
    const category = await db.query<{ stall_category: string; is_open: boolean }>(
      "select stall_category,is_open from player_stalls where user_id=$1",
      [seller],
    );
    expect(category.rows[0]).toEqual({ stall_category: "fabrics", is_open: true });
  });

  it("keeps price and stock server-authoritative and settles an idempotent sale atomically", async () => {
    await call("public.rent_market_stall($1::uuid)", [requestId(3)]);
    await call("public.save_player_stall('Ade Fabric Corner','fabrics',true)");
    const meatPie = await db.query<{ id: string }>(
      "select id from inventory_items where slug='meat_pie'",
    );
    const stock = await call<{ id: string; quantity: number; priceMinor: number }>(
      "public.manage_my_stall_stock('add',$1::uuid,3,1400)",
      [meatPie.rows[0]!.id],
    );
    expect(stock).toMatchObject({ quantity: 3, priceMinor: 1400 });
    await deny(
      "select public.manage_my_stall_stock('add',$1::uuid,1,6001)",
      [meatPie.rows[0]!.id],
      "PRICE_OUT_OF_RANGE",
    );
    await asUser(buyer);
    const stalls = await call<{ items: { id: string; category: string }[] }>(
      "public.get_public_player_stalls(null,20,'fabrics')",
    );
    expect(stalls.items).toHaveLength(1);
    expect(stalls.items[0]?.category).toBe("fabrics");
    const publicStock = await call<{ id: string; quantity: number; priceMinor: number }[]>(
      "public.get_public_stall_stock($1::uuid)",
      [stalls.items[0]!.id],
    );
    expect(publicStock).toEqual([
      expect.objectContaining({ id: stock.id, quantity: 3, priceMinor: 1400 }),
    ]);
    const sale = await call<{
      duplicate: boolean;
      totalMinor: number;
      remainingStock: number;
    }>("public.purchase_player_stall_item($1::uuid,$2::uuid,2)", [requestId(4), stock.id]);
    expect(sale).toMatchObject({ duplicate: false, totalMinor: 2800, remainingStock: 1 });
    expect(
      await call("public.purchase_player_stall_item($1::uuid,$2::uuid,2)", [
        requestId(4),
        stock.id,
      ]),
    ).toMatchObject({ duplicate: true, totalMinor: 2800 });
    expect(
      (await db.query("select balance from wallets where user_id=$1", [buyer])).rows[0]?.balance,
    ).toBe(7200);
    expect(
      (await db.query("select balance from wallets where user_id=$1", [seller])).rows[0]?.balance,
    ).toBe(10800);
    expect(
      (
        await db.query(
          "select quantity from player_inventory where user_id=$1 and item_id=$2",
          [buyer, meatPie.rows[0]!.id],
        )
      ).rows[0]?.quantity,
    ).toBe(2);
    expect(
      (
        await db.query(
          "select count(*)::int as count from transactions where category in ('player_stall_purchase','player_stall_sale')",
        )
      ).rows[0]?.count,
    ).toBe(2);
    await deny(
      "select public.purchase_player_stall_item($1::uuid,$2::uuid,2)",
      [requestId(5), stock.id],
      "STALL_STOCK_UNAVAILABLE",
    );
  });

  it("closes and stops a stall at the rent boundary, while overdue payment reuses the housing cycle", async () => {
    await call("public.rent_market_stall($1::uuid)", [requestId(6)]);
    await call("public.save_player_stall('Ade Fabric Corner','fabrics',true)");
    await db.query(
      `update property_rent_cycles set due_at=now()-interval '1 second',
        grace_ends_at=now()+interval '3 days',rescue_ends_at=now()+interval '4 days'
        where character_id=(select id from characters where user_id=$1) and status='current'`,
      [seller],
    );
    await call("public._advance_property_rent_cycles()");
    expect(
      (
        await db.query("select is_open from player_stalls where user_id=$1", [seller])
      ).rows[0]?.is_open,
    ).toBe(false);
    expect(
      (await db.query("select is_open from stall_income_state where user_id=$1", [seller])).rows[0]
        ?.is_open,
    ).toBe(false);
    const paid = await call<{ status: string; weeklyRentMinor: number }>(
      "public.pay_market_stall_rent($1::uuid)",
      [requestId(7)],
    );
    expect(paid).toMatchObject({ status: "current", weeklyRentMinor: 2000 });
    expect(
      await call("public.pay_market_stall_rent($1::uuid)", [requestId(7)]),
    ).toMatchObject({ duplicate: true, status: "current", weeklyRentMinor: 2000 });
    expect(
      (await db.query("select balance from wallets where user_id=$1", [seller])).rows[0]
        ?.balance,
    ).toBe(6000);
    expect(
      (await db.query("select is_open from player_stalls where user_id=$1", [seller])).rows[0]
        ?.is_open,
    ).toBe(false);
  });

  it("repossesses a stall after the rescue deadline and requires a new rental", async () => {
    await call("public.rent_market_stall($1::uuid)", [requestId(9)]);
    await call("public.save_player_stall('Ade Fabric Corner','fabrics',true)");
    await db.query(
      `update property_rent_cycles set due_at=now()-interval '5 days',
        grace_ends_at=now()-interval '2 days',rescue_ends_at=now()-interval '1 second'
        where character_id=(select id from characters where user_id=$1) and status='current'`,
      [seller],
    );
    await call("public._advance_property_rent_cycles()");
    expect(
      (
        await db.query(
          `select tenancy.is_active,cycle.status from player_properties tenancy
           join property_rent_cycles cycle on cycle.player_property_id=tenancy.id
           where tenancy.character_id=(select id from characters where user_id=$1)
           order by cycle.period_start_at desc limit 1`,
          [seller],
        )
      ).rows[0],
    ).toEqual({ is_active: false, status: "repossessed" });
    expect(
      (await db.query("select is_open from player_stalls where user_id=$1", [seller])).rows[0]
        ?.is_open,
    ).toBe(false);
    await deny(
      "select public.save_player_stall('Ade Fabric Corner','fabrics',true)",
      [],
      "Rent a current stall before saving",
    );
    const newRental = await call<{ duplicate: boolean; weeklyRentMinor: number }>(
      "public.rent_market_stall($1::uuid)",
      [requestId(10)],
    );
    expect(newRental).toMatchObject({ duplicate: false, weeklyRentMinor: 2000 });
  });

  it("limits raw stall visibility to the owner and validates the discovery filter", async () => {
    await call("public.rent_market_stall($1::uuid)", [requestId(8)]);
    await call("public.save_player_stall('Ade Fabric Corner','fabrics',true)");
    await asUser(buyer);
    await deny(
      "select public.get_public_player_stalls(null,20,'unknown')",
      [],
      "INVALID_STALL_CATEGORY",
    );
    await db.exec("set role authenticated");
    expect(
      (await db.query("select id from player_stalls")).rows,
    ).toEqual([]);
    await db.exec("reset role");
  });
});

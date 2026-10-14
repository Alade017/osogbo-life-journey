// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const userId = "81111111-1111-4111-8111-111111111111";
let db: PGlite;

describe("housing onboarding database actions", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    for (const { tag } of journal.entries)
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8"));
    await db.query("insert into auth.users(id) values($1)", [userId]);
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(
      "reset role; delete from public.profiles where id='" +
        userId +
        "'; delete from auth.users where id='" +
        userId +
        "';",
    );
    await db.query("insert into auth.users(id) values($1)", [userId]);
    await db.query("insert into public.profiles(id,display_name) values($1,'Tenant')", [userId]);
    await db.query(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('housing-test-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary",
    );
    await db.query(
      "insert into public.characters(user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,'Tenant','female',22,'ambitious','housing-test-job','housing')",
      [userId],
    );
    await db.query(
      "insert into public.wallets(user_id,character_id,balance) select $1,id,5000 from public.characters where user_id=$1",
      [userId],
    );
  });

  it("computes eligibility from authoritative cash and 20 shifts of job pay", async () => {
    const result = await db.query<{
      result: { monthly_income: number; houses: { id: string; eligible: boolean }[] };
    }>("select public.housing_eligible_houses($1) as result", [userId]);
    expect(result.rows[0]?.result.monthly_income).toBe(200000);
    expect(
      result.rows[0]?.result.houses.find((house) => house.id === "studio-flat")?.eligible,
    ).toBe(false);
  });

  it("creates the home, charges rent and deposit once, and returns the same receipt on retry", async () => {
    const key = "housing-idempotency-key-0001";
    const first = await db.query<{ result: Record<string, unknown> }>(
      "select public.housing_choose($1,'single-room',$2) as result",
      [userId, key],
    );
    const second = await db.query<{ result: Record<string, unknown> }>(
      "select public.housing_choose($1,'single-room',$2) as result",
      [userId, key],
    );
    expect(second.rows[0]?.result).toEqual(first.rows[0]?.result);
    const wallet = await db.query<{ balance: number }>(
      "select balance from public.wallets where user_id=$1",
      [userId],
    );
    const homes = await db.query<{ count: number }>(
      "select count(*)::int as count from public.player_homes where user_id=$1",
      [userId],
    );
    const charges = await db.query<{ count: number }>(
      "select count(*)::int as count from public.transactions where user_id=$1 and category in ('housing_deposit','housing_rent')",
      [userId],
    );
    const step = await db.query<{ onboarding_step: string }>(
      "select onboarding_step from public.characters where user_id=$1",
      [userId],
    );
    const ledger = await db.query<{ category: string; amount: number; balance_after: number }>(
      "select category,amount,balance_after from public.transactions where user_id=$1 and category in ('housing_deposit','housing_rent') order by created_at,category",
      [userId],
    );
    expect(wallet.rows[0]?.balance).toBe(2000);
    expect(homes.rows[0]?.count).toBe(1);
    expect(charges.rows[0]?.count).toBe(2);
    expect(step.rows[0]?.onboarding_step).toBe("done");
    expect(ledger.rows).toEqual([
      { category: "housing_deposit", amount: 1500, balance_after: 3500 },
      { category: "housing_rent", amount: 1500, balance_after: 2000 },
    ]);
  });

  it("rechecks the rent ratio when choosing, even if the client asks directly", async () => {
    await db.query("update public.jobs set salary=100 where slug='housing-test-job'");
    await expect(
      db.query("select public.housing_choose($1,'shared-room','housing-rent-recheck-0001')", [
        userId,
      ]),
    ).rejects.toThrow(/RENT_TOO_HIGH/);
  });

  it("makes placement and removal retries idempotent", async () => {
    await db.query("select public.housing_choose($1,'single-room','housing-item-move-in-0001')", [
      userId,
    ]);
    const key = "housing-item-remove-retry-01";
    const first = await db.query<{ result: unknown }>(
      "select public.home_item_mutate($1,'remove','starter-bed',null,$2) as result",
      [userId, key],
    );
    const retry = await db.query<{ result: unknown }>(
      "select public.home_item_mutate($1,'remove','starter-bed',null,$2) as result",
      [userId, key],
    );
    expect(retry.rows[0]?.result).toEqual(first.rows[0]?.result);
    const item = await db.query<{ placed: boolean }>(
      "select placed from public.home_items where character_id=(select id from public.characters where user_id=$1) and item_id='starter-bed'",
      [userId],
    );
    expect(item.rows[0]?.placed).toBe(false);
  });
});

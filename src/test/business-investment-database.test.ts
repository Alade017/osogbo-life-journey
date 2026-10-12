// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const investor = "22222222-2222-4222-8222-222222222222";
const characterA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const characterB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
let db: PGlite;

async function asUser(userId: string) {
  await db.query("select set_config('test.user_id',$1,false)", [userId]);
}

describe("business and investment RPCs", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    for (const file of readdirSync("drizzle/migrations")
      .filter((name) => name.endsWith(".sql"))
      .sort()) {
      try {
        await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${String(error)}`);
      }
    }
    await db.exec(`insert into auth.users(id) values ('${owner}'),('${investor}');
      insert into public.profiles(id,display_name) values ('${owner}','Ade'),('${investor}','Bisi');
      insert into public.characters(id,user_id,name,gender,age,personality) values
        ('${characterA}','${owner}','Ade','male',24,'ambitious'),('${characterB}','${investor}','Bisi','female',22,'creative');
      insert into public.wallets(user_id,character_id,balance) values
        ('${owner}','${characterA}',20000000),('${investor}','${characterB}',1000000);`);
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  it("debits business purchase, constrains pricing, transfers shares, pays dividends, and prevents replay", async () => {
    await asUser(owner);
    const purchase = await db.query<{ result: { companyId: string; paid: number } }>(
      "select public.buy_player_company('oke-fia-digital-studio',$1) as result",
      ["33333333-3333-4333-8333-333333333333"],
    );
    const companyId = purchase.rows[0]!.result.companyId;
    expect(Number(purchase.rows[0]!.result.paid)).toBe(500000);
    await expect(
      db.query("select public.configure_player_company($1,'{\"web-design\":1}'::jsonb)", [
        companyId,
      ]),
    ).rejects.toThrow();
    await db.query("select public.offer_player_company_shares($1,1000)", [companyId]);

    await asUser(investor);
    const investArgs = [companyId, 1000, "44444444-4444-4444-8444-444444444444"];
    const bought = await db.query<{ result: { paid: number; duplicate: boolean } }>(
      "select public.invest_in_player_company($1,$2,$3) as result",
      investArgs,
    );
    expect(Number(bought.rows[0]!.result.paid)).toBe(50000);
    expect(
      (
        await db.query<{ result: { duplicate: boolean } }>(
          "select public.invest_in_player_company($1,$2,$3) as result",
          investArgs,
        )
      ).rows[0]!.result.duplicate,
    ).toBe(true);

    await asUser(owner);
    await db.query(
      "update public.player_companies set accrued_at=now()-interval '3 hours' where id=$1",
      [companyId],
    );
    await db.query("select public.claim_player_company_earnings($1)", [companyId]);
    const investorCash = await db.query<{ balance: number }>(
      "select balance from public.wallets where character_id=$1",
      [characterB],
    );
    expect(Number(investorCash.rows[0]!.balance)).toBeGreaterThan(950000);
    const dividends = await db.query<{ count: number }>(
      "select count(*)::int as count from public.transactions where character_id=$1 and category='company_dividend'",
      [characterB],
    );
    expect(dividends.rows[0]!.count).toBe(1);
  });

  it("keeps fixed-term investments locked until maturity and pays them once", async () => {
    await asUser(owner);
    const opened = await db.query<{ result: { investmentId: string } }>(
      "select public.create_fixed_term_investment('susu-7-day',10000,$1) as result",
      ["55555555-5555-4555-8555-555555555555"],
    );
    const investmentId = opened.rows[0]!.result.investmentId;
    await expect(
      db.query("select public.claim_fixed_term_investment($1)", [investmentId]),
    ).rejects.toThrow(/not matured/);
    await db.query(
      "update public.player_fixed_investments set opened_at=now()-interval '8 days', matures_at=now()-interval '1 second' where id=$1",
      [investmentId],
    );
    const paid = await db.query<{ result: { paid: number } }>(
      "select public.claim_fixed_term_investment($1) as result",
      [investmentId],
    );
    expect(Number(paid.rows[0]!.result.paid)).toBe(10200);
    await expect(
      db.query("select public.claim_fixed_term_investment($1)", [investmentId]),
    ).rejects.toThrow(/already been claimed/);
  });
});

// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const owner = "11111111-1111-4111-8111-111111111111";
const investor = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
async function asUser(id: string) {
  await db.query("select set_config('test.user_id',$1,false)", [id]);
}
async function call(sql: string, args: unknown[] = []) {
  const result = await db.query<{
    result: {
      companyId?: string;
      investmentId?: string;
      advertisementId?: string;
      duplicate?: boolean;
      totalEarnings?: number;
      paid?: number;
    };
  }>(`select ${sql} as result`, args);
  return result.rows[0]!.result;
}
async function buy() {
  return call("public.buy_player_company('oke-fia-digital-studio',$1)", [randomUUID()]);
}
async function balance(id: string) {
  return Number(
    (
      await db.query<{ balance: number }>("select balance from public.wallets where user_id=$1", [
        id,
      ])
    ).rows[0]!.balance,
  );
}
describe("authoritative business and investment database", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    for (const { tag } of journal.entries)
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8"));
    for (const id of [owner, investor]) {
      await db.query("insert into auth.users values($1)", [id]);
      await db.query("insert into public.profiles(id) values($1)", [id]);
      await db.query(
        "insert into public.characters(user_id,name,gender,age,personality) values($1,$2,'male',21,'ambitious')",
        [id, id === owner ? "Owner" : "Investor"],
      );
      await db.query(
        "insert into public.wallets(user_id,character_id,balance) select $1,id,20000000 from public.characters where user_id=$1 on conflict(character_id) do update set balance=20000000",
        [id],
      );
    }
  }, 180_000);
  afterAll(async () => {
    await db?.close();
  });
  beforeEach(async () => {
    await db.exec(
      "reset role; delete from public.player_advertisements; delete from public.player_fixed_investments; delete from public.player_company_shares; delete from public.player_companies; delete from public.economy_request_results; delete from public.transactions; update public.wallets set balance=20000000,total_income=0,total_expenses=0;",
    );
    await asUser(owner);
  });
  it("purchases exactly once and binds receipts to their inputs", async () => {
    const request = randomUUID();
    const first = await call("public.buy_player_company('oke-fia-digital-studio',$1)", [request]);
    const duplicate = await call("public.buy_player_company('oke-fia-digital-studio',$1)", [
      request,
    ]);
    expect(duplicate["companyId"]).toBe(first["companyId"]);
    expect(duplicate["duplicate"]).toBe(true);
    expect(await balance(owner)).toBe(19500000);
    await expect(
      call("public.buy_player_company('oja-oba-grocery',$1)", [request]),
    ).rejects.toThrow(/different inputs/);
    await expect(buy()).rejects.toThrow(/already own/);
  });
  it("rejects insufficient funds and unauthorized writes", async () => {
    await db.query("update public.wallets set balance=1 where user_id=$1", [owner]);
    await expect(buy()).rejects.toThrow(/Insufficient/);
    await db.exec("set role authenticated");
    await expect(
      db.exec(
        "insert into public.player_companies(business_id,owner_user_id,owner_character_id) select id,auth.uid(),public._my_character_id() from public.business_catalog limit 1",
      ),
    ).rejects.toThrow();
    await expect(
      call("public._settle_player_company_earnings($1)", [randomUUID()]),
    ).rejects.toThrow(/permission/);
  });
  it("settles old prices before changing rates and limits offline accrual", async () => {
    const company = await buy();
    await db.query(
      "update public.player_companies set accrued_at=now()-interval '8 days' where id=$1",
      [company["companyId"]],
    );
    const cash = await balance(owner);
    await call("public.configure_player_company($1,$2)", [
      company["companyId"],
      { "web-design": 60000, graphics: 22000 },
    ]);
    const expected = Math.floor((8 * 18000 + 20 * 6500) * 7 * 0.7);
    expect(await balance(owner)).toBe(cash + expected);
    await expect(
      call("public.claim_player_company_earnings($1)", [company["companyId"]]),
    ).rejects.toThrow(/not ready/);
    await asUser(investor);
    await expect(
      call("public.configure_player_company($1,$2)", [company["companyId"], {}]),
    ).rejects.toThrow();
  });
  it("preserves total shares and distributes exactly the declared earnings", async () => {
    const company = await buy();
    await call("public.offer_player_company_shares($1,3000)", [company["companyId"]]);
    await asUser(investor);
    const request = randomUUID();
    await call("public.invest_in_player_company($1,2000,$2)", [company["companyId"], request]);
    await call("public.invest_in_player_company($1,2000,$2)", [company["companyId"], request]);
    await expect(
      call("public.invest_in_player_company($1,1000,$2)", [company["companyId"], request]),
    ).rejects.toThrow(/different inputs/);
    await expect(
      call("public.invest_in_player_company($1,2000,$2)", [company["companyId"], randomUUID()]),
    ).rejects.toThrow(/enough shares/);
    const competing = await Promise.allSettled([
      call("public.invest_in_player_company($1,1000,$2)", [company["companyId"], randomUUID()]),
      call("public.invest_in_player_company($1,1000,$2)", [company["companyId"], randomUUID()]),
    ]);
    expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      Number(
        (
          await db.query<{ total: number }>(
            "select sum(shares) as total from public.player_company_shares where company_id=$1",
            [company["companyId"]],
          )
        ).rows[0]!.total,
      ),
    ).toBe(10000);
    await asUser(owner);
    await expect(
      call("public.offer_player_company_shares($1,2000)", [company["companyId"]]),
    ).rejects.toThrow(/70 percent/);
    await db.query(
      "update public.player_companies set accrued_at=now()-interval '2 hours' where id=$1",
      [company["companyId"]],
    );
    const beforeOwner = await balance(owner),
      beforeInvestor = await balance(investor);
    const earnings = await call("public.claim_player_company_earnings($1)", [company["companyId"]]);
    const deltaOwner = (await balance(owner)) - beforeOwner,
      deltaInvestor = (await balance(investor)) - beforeInvestor;
    expect(deltaOwner + deltaInvestor).toBe(Number(earnings["totalEarnings"]));
    expect(deltaInvestor).toBe(Math.floor(Number(earnings["totalEarnings"]) * 0.3));
    await expect(
      call("public.claim_player_company_earnings($1)", [company["companyId"]]),
    ).rejects.toThrow(/not ready/);
  });
  it("does not give a new investor historical dividends", async () => {
    const company = await buy();
    await call("public.offer_player_company_shares($1,3000)", [company["companyId"]]);
    await db.query(
      "update public.player_companies set accrued_at=now()-interval '24 hours' where id=$1",
      [company["companyId"]],
    );
    const before = await balance(owner);
    await asUser(investor);
    await call("public.invest_in_player_company($1,1000,$2)", [company["companyId"], randomUUID()]);
    expect(await balance(investor)).toBe(19950000);
    expect(await balance(owner)).toBeGreaterThan(before + 50000);
  });
  it("freezes investment terms and rejects early and duplicate claims", async () => {
    const request = randomUUID();
    const investment = await call("public.create_fixed_term_investment('susu-7-day',10000,$1)", [
      request,
    ]);
    await call("public.create_fixed_term_investment('susu-7-day',10000,$1)", [request]);
    expect(await balance(owner)).toBe(19990000);
    await expect(
      call("public.create_fixed_term_investment('susu-7-day',20000,$1)", [request]),
    ).rejects.toThrow(/different inputs/);
    await expect(
      call("public.claim_fixed_term_investment($1)", [investment["investmentId"]]),
    ).rejects.toThrow(/not matured/);
    await asUser(investor);
    await expect(
      call("public.claim_fixed_term_investment($1)", [investment["investmentId"]]),
    ).rejects.toThrow(/not found/);
    await asUser(owner);
    await db.exec(
      "update public.fixed_investment_products set yield_bps=5000 where slug='susu-7-day'",
    );
    await db.query(
      "update public.player_fixed_investments set opened_at=now()-interval '8 days',matures_at=now()-interval '1 day' where id=$1",
      [investment["investmentId"]],
    );
    const claimed = await call("public.claim_fixed_term_investment($1)", [
      investment["investmentId"],
    ]);
    expect(claimed["paid"]).toBe(10200);
    await expect(
      call("public.claim_fixed_term_investment($1)", [investment["investmentId"]]),
    ).rejects.toThrow(/already been claimed/);
  });

  it("purchases billboard ads exactly once and exposes them to readers without allowing edits", async () => {
    const board = (
      await db.query<{ id: string }>(
        "select id from public.game_billboards where slug='oke-fia-junction-001'",
      )
    ).rows[0]!.id;
    const request = randomUUID();
    const args = [
      board,
      "Ade Studios",
      "New collection",
      "Fresh designs in Osogbo",
      "green",
      7,
      request,
    ];
    const first = await call("public.purchase_player_advertisement($1,$2,$3,$4,$5,$6,$7)", args);
    expect(first["paid"]).toBe(35000);
    expect(await balance(owner)).toBe(19965000);
    const repeated = await call("public.purchase_player_advertisement($1,$2,$3,$4,$5,$6,$7)", args);
    expect(repeated["advertisementId"]).toBe(first["advertisementId"]);
    expect(repeated["duplicate"]).toBe(true);
    expect(await balance(owner)).toBe(19965000);
    await expect(
      call("public.purchase_player_advertisement($1,$2,$3,$4,$5,$6,$7)", [
        board,
        "Ade Studios",
        "New collection",
        "Fresh designs in Osogbo",
        "green",
        30,
        request,
      ]),
    ).rejects.toThrow(/different inputs/);
    await expect(
      call("public.purchase_player_advertisement($1,$2,$3,$4,$5,$6,$7)", [
        board,
        "Ade Studios",
        "New collection",
        "Fresh designs in Osogbo",
        "green",
        3,
        randomUUID(),
      ]),
    ).rejects.toThrow(/7, 14 or 30/);

    await asUser(investor);
    await db.exec("set role authenticated");
    const visible = await db.query<{ count: number }>(
      "select count(*)::integer as count from public.player_advertisements where id=$1 and status='active' and ends_at>now()",
      [first["advertisementId"]],
    );
    expect(visible.rows[0]!.count).toBe(1);
    await expect(
      db.query(
        "update public.player_advertisements set title='changed by another player' where id=$1",
        [first["advertisementId"]],
      ),
    ).rejects.toThrow();
    await db.exec("reset role");
  });

  it("excludes religious locations and preserves fictional court roleplay", async () => {
    const ownerCharacter = await db.query<{ id: string }>(
      "select id from public.characters where user_id=$1",
      [owner],
    );
    const targetCharacter = await db.query<{ id: string }>(
      "select id from public.characters where user_id=$1",
      [investor],
    );
    const characterId = ownerCharacter.rows[0]!.id;
    const targetId = targetCharacter.rows[0]!.id;
    const religiousPlace = await db.query<{ id: string; is_active: boolean }>(
      "select id, is_active from public.locations where slug='osogbo-central-mosque'",
    );
    expect(religiousPlace.rows[0]!.is_active).toBe(false);
    await expect(
      call("public.perform_location_activity($1,'worship',$2,0,null,null)", [
        religiousPlace.rows[0]!.id,
        randomUUID(),
      ]),
    ).rejects.toThrow(/unavailable/);
    expect(await balance(owner)).toBe(20_000_000);

    const court = await db.query<{ id: string }>(
      "select id from public.locations where slug='osogbo-high-court'",
    );
    await db.query("update public.characters set current_location_id=$1 where id=$2", [
      court.rows[0]!.id,
      characterId,
    ]);
    const complaint = await call(
      "public.perform_location_activity($1,'file_complaint',$2,0,$3,$4)",
      [court.rows[0]!.id, randomUUID(), targetId, "A fictional dispute about a shared game venue."],
    );
    expect(complaint).toMatchObject({ action: "file_complaint" });
    await expect(
      call("public.perform_location_activity($1,'file_complaint',$2,0,$3,$4)", [
        court.rows[0]!.id,
        randomUUID(),
        targetId,
        "Another fictional dispute about the same game venue.",
      ]),
    ).rejects.toThrow();
    const caseCount = await db.query<{ count: number }>(
      "select count(*)::integer as count from public.city_civic_cases where claimant_character_id=$1",
      [characterId],
    );
    expect(caseCount.rows[0]!.count).toBe(1);

    const venueCount = await db.query<{ count: number }>(
      "select count(*)::integer as count from public.locations where slug in ('osun-mall','aiyegbaju-market','osogbo-high-court')",
    );
    expect(venueCount.rows[0]!.count).toBe(3);

    await db.query(
      "update public.characters set current_location_id=$1, game_time_hour=10 where id=$2",
      [court.rows[0]!.id, characterId],
    );
    const npcGreeting = await call("public.interact_with_npc('npc-sade','greet',$1)", [
      randomUUID(),
    ]);
    expect(npcGreeting).toMatchObject({ accepted: true });
  });
});

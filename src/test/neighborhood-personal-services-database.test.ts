// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { HAIR_STYLES_BY_GENDER, HAIR_COLORS } from "@/game/avatar-appearance";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  cid = "22222222-2222-4222-8222-222222222222",
  loc = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
const barberQuote = { cash_price: 1500, cash_payout: 0, bank_fee: 0 },
  posQuote = { cash_price: 0, cash_payout: 2000, bank_fee: 100 };
let request = 0;
const key = () => `99999999-9999-4999-8999-${String(++request).padStart(12, "0")}`;
async function use(
  service: string,
  id = key(),
  hair: number | null = 2,
  colour: number | null = 1,
  quote: unknown = barberQuote,
) {
  return (
    await db.query<{ result: Record<string, unknown> }>(
      "select public.use_neighborhood_personal_service($1,$2,$3,$4,$5) result",
      [service, id, hair, colour, JSON.stringify(quote)],
    )
  ).rows[0]!.result;
}
async function wallet() {
  return (
    await db.query<{ balance: number; bank_balance: number; total_expenses: number }>(
      "select balance::float8,bank_balance::float8,total_expenses::float8 from wallets where character_id=$1",
      [cid],
    )
  ).rows[0]!;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key);
 create table locations(id uuid primary key,name text,slug text,type text,is_active boolean default true);
 create table characters(id uuid primary key,user_id uuid,gender text,appearance jsonb,current_location_id uuid,inside_home_property_id uuid,created_at timestamptz default now());
 create table wallets(id uuid primary key default gen_random_uuid(),user_id uuid,character_id uuid,balance bigint check(balance>=0),bank_balance bigint check(bank_balance>=0),total_expenses bigint default 0);
 create table transactions(id uuid primary key default gen_random_uuid(),user_id uuid,wallet_id uuid,character_id uuid,amount bigint check(amount>0),kind text check(kind in ('income','expense')),category text,description text,transaction_type text,account text,source text,destination text,balance_after bigint check(balance_after>=0),metadata jsonb);
 create table game_places(id uuid primary key,location_id uuid,category text);
 create function public._my_character_id() returns uuid language sql security definer as $$select id from public.characters where user_id=auth.uid() order by created_at desc limit 1$$;
 create function public.deposit_cash(bigint) returns jsonb language plpgsql as $$begin raise exception 'Unused fixture function';end$$;
 create function public.withdraw_cash(bigint) returns jsonb language plpgsql as $$begin raise exception 'Unused fixture function';end$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 `);
  await db.exec(readFileSync("supabase/migrations/20261105020855_bank_accounts.sql", "utf8"));
  await db.exec(readFileSync("drizzle/migrations/0106_barber_pos_services.sql", "utf8"));
  await db.query("insert into auth.users values($1),($2)", [uid, other]);
  await db.query(
    "insert into locations(id,name,slug,type) values($1,'City Centre','city-centre','district')",
    [loc],
  );
  await db.query(
    'insert into characters(id,user_id,gender,appearance,current_location_id) values($1,$2,\'male\',\'{"hair":1,"hairColor":0,"skin":4,"outfit":3,"clothed":true}\',$3)',
    [cid, uid, loc],
  );
  await db.query(
    "insert into wallets(user_id,character_id,balance,bank_balance) values($1,$2,10000,10000)",
    [uid, cid],
  );
  await db.query(
    "insert into bank_accounts(character_id,branch_location_id,account_number) values($1,$2,'1234567890')",
    [cid, loc],
  );
});
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("reset role;delete from neighborhood_service_receipts;delete from transactions;");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await db.query(
    "update wallets set balance=10000,bank_balance=10000,total_expenses=0 where character_id=$1",
    [cid],
  );
  await db.query(
    'update characters set gender=\'male\',appearance=\'{"hair":1,"hairColor":0,"skin":4,"outfit":3,"clothed":true}\',current_location_id=$1,inside_home_property_id=null where id=$2',
    [loc, cid],
  );
});
it("applies a paid hairstyle while preserving every unrelated appearance choice", async () => {
  await use("barber-style");
  expect(await wallet()).toEqual({ balance: 8500, bank_balance: 10000, total_expenses: 1500 });
  const row = (
    await db.query<{ appearance: unknown }>("select appearance from characters where id=$1", [cid])
  ).rows[0]!;
  expect(row.appearance).toEqual({ hair: 2, hairColor: 1, skin: 4, outfit: 3, clothed: true });
  expect((await db.query("select * from transactions")).rows).toHaveLength(1);
});
it.each(["male", "female", "nonbinary"])(
  "keeps %s saved palette indices aligned with the character renderer",
  async (gender) => {
    await db.query("update characters set gender=$1 where id=$2", [gender, cid]);
    const result = (
      await db.query<{ data: Array<{ hair_styles: string[]; hair_colors: string[] }> }>(
        "select public.my_neighborhood_personal_services('zone-shop-barber') data",
      )
    ).rows[0]!.data[0]!;
    expect(result.hair_styles).toEqual(HAIR_STYLES_BY_GENDER[gender]);
    expect(result.hair_colors).toEqual(HAIR_COLORS);
    await use("barber-style", key(), result.hair_styles.length - 1, 3);
  },
);
it("replays a successful haircut receipt without paying or writing transactions again", async () => {
  const id = key();
  const first = await use("barber-style", id);
  expect(await use("barber-style", id)).toEqual(first);
  expect((await wallet()).balance).toBe(8500);
  expect((await db.query("select * from transactions")).rows).toHaveLength(1);
  await expect(use("barber-style", id, 0, 0)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
});
it("performs concurrent POS retries exactly once and records the fee separately", async () => {
  const id = key();
  await Promise.all([
    use("pos-cashout", id, null, null, posQuote),
    use("pos-cashout", id, null, null, posQuote),
  ]);
  expect(await wallet()).toEqual({ balance: 12000, bank_balance: 7900, total_expenses: 100 });
  const rows = (
    await db.query<{ amount: number; category: string }>(
      "select amount::float8,category from transactions order by amount desc",
    )
  ).rows;
  expect(rows).toEqual([
    { amount: 2000, category: "withdrawal" },
    { amount: 100, category: "service_fee" },
  ]);
});
it("rejects unaffordable withdrawals, invalid styles and client-modified prices without writes", async () => {
  await db.query("update wallets set bank_balance=2099");
  await expect(use("pos-cashout", key(), null, null, posQuote)).rejects.toThrow(
    "INSUFFICIENT_SAVINGS",
  );
  await expect(use("barber-style", key(), 77, 0)).rejects.toThrow("INVALID_APPEARANCE");
  await expect(use("barber-style", key(), 2, 1, { ...barberQuote, cash_price: 1 })).rejects.toThrow(
    "QUOTE_CHANGED",
  );
  await expect(use("barber-style", key(), 1, 0)).rejects.toThrow("STYLE_ALREADY_SELECTED");
  expect((await wallet()).balance).toBe(10000);
  expect((await db.query("select * from transactions")).rows).toHaveLength(0);
});
it("refuses purchases from inside home or the wrong district, but permits receipt recovery after departure", async () => {
  const id = key();
  await use("barber-style", id);
  await db.query("update characters set current_location_id=null where id=$1", [cid]);
  await expect(use("barber-style")).rejects.toThrow("VISIT_SERVICE_LOCATION");
  expect((await use("barber-style", id))["ok"]).toBe(true);
  await db.query(
    "update characters set current_location_id=$1,inside_home_property_id=$2 where id=$3",
    [loc, loc, cid],
  );
  await expect(use("pos-cashout", key(), null, null, posQuote)).rejects.toThrow(
    "VISIT_SERVICE_LOCATION",
  );
});
it("requires an open bank account for POS", async () => {
  await db.query("delete from bank_accounts where character_id=$1", [cid]);
  await expect(use("pos-cashout", key(), null, null, posQuote)).rejects.toThrow(
    "BANK_ACCOUNT_REQUIRED",
  );
  expect((await wallet()).balance).toBe(10000);
  await db.query(
    "insert into bank_accounts(character_id,branch_location_id,account_number) values($1,$2,'1234567890')",
    [cid, loc],
  );
});
it("prevents anonymous execution and direct authenticated price or receipt writes", async () => {
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await expect(use("barber-style")).rejects.toThrow("UNAUTHORIZED");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  await use("barber-style");
  await db.exec("set role authenticated");
  await expect(db.query("update neighborhood_personal_services set cash_price=0")).rejects.toThrow(
    /permission denied/,
  );
  await expect(db.query("delete from neighborhood_service_receipts")).rejects.toThrow(
    /permission denied/,
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
  expect((await db.query("select * from neighborhood_service_receipts")).rows).toHaveLength(0);
});

it("rolls back the payout, fee and receipt together if ledger writing fails", async () => {
  await db.exec(
    "alter table transactions add constraint reject_pos_fee check(category<>'service_fee')",
  );
  try {
    await expect(use("pos-cashout", key(), null, null, posQuote)).rejects.toThrow(/reject_pos_fee/);
    expect(await wallet()).toEqual({ balance: 10000, bank_balance: 10000, total_expenses: 0 });
    expect((await db.query("select * from transactions")).rows).toHaveLength(0);
    expect((await db.query("select * from neighborhood_service_receipts")).rows).toHaveLength(0);
  } finally {
    await db.exec("alter table transactions drop constraint reject_pos_fee");
  }
});
it("does not debit unaffordable cash styling", async () => {
  await db.query("update wallets set balance=1499 where character_id=$1", [cid]);
  await expect(use("barber-style")).rejects.toThrow("INSUFFICIENT_CASH");
  expect((await wallet()).balance).toBe(1499);
  expect((await db.query("select * from transactions")).rows).toHaveLength(0);
});

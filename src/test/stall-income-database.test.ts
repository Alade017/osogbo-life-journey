// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, beforeEach, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
const uid = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222";
let cid: string;
const clock = (stamp: string) =>
  db.query("update test_stall_clock set stamp=$1::timestamptz", [stamp]);
async function call<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ value: T }>(`select ${sql} value`, params)).rows[0]!.value;
}
const save = (open = true) =>
  call("public.save_player_stall('Fictional stall','Crafts',$1)", [open]);
const read = () =>
  call<{
    claimable: number;
    todayEarned: number;
    todayPaid: number;
    enrolled: boolean;
    isOpen: boolean;
    hasStall: boolean;
    date: string;
  }>("public.get_stall_income()");
const request = () => crypto.randomUUID();
const claim = (id = request()) =>
  call<{ amount: number; duplicate: boolean; cash: number; transactionId: string | null }>(
    "public.claim_stall_income($1::uuid)",
    [id],
  );
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;create schema realtime;
  create table auth.users(id uuid primary key,is_anonymous boolean not null default false);create table realtime.messages(id bigint generated always as identity);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
  create function realtime.topic() returns text language sql stable as $$select ''::text$$;
  create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$begin return;end$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for (const file of readdirSync("drizzle/migrations")
    .filter((f) => f.endsWith(".sql") && !f.startsWith("0075_"))
    .sort())
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/20261027104102_stall_passive_income.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261028143246_public_player_stall_discovery.sql", "utf8"),
  );
  await db.exec(`create table test_stall_clock(stamp timestamptz);insert into test_stall_clock values('2026-10-27T12:00:00Z');
    create function public.test_stall_now() returns timestamptz language sql volatile as $$select stamp from public.test_stall_clock$$;
    update stall_income_policy set activated_at='2026-10-27T00:00:00Z';`);
  for (const signature of [
    "public.save_player_stall(text,text,boolean)",
    "public.get_stall_income()",
    "public.claim_stall_income(uuid)",
  ]) {
    const row = (
      await db.query<{ definition: string }>(
        "select pg_get_functiondef($1::regprocedure) definition",
        [signature],
      )
    ).rows[0]!;
    await db.exec(
      row.definition
        .replaceAll("clock_timestamp()", "public.test_stall_now()")
        .replaceAll("statement_timestamp()", "public.test_stall_now()"),
    );
  }
  for (const [id, name] of [
    [uid, "Ade"],
    [other, "Bisi"],
  ])
    await db.query(`insert into auth.users(id) values($1);`, [id]);
  await db.exec(
    `insert into profiles(id) values('${uid}'),('${other}');insert into characters(user_id,name,gender,age,personality) values('${uid}','Ade','male',21,'ambitious'),('${other}','Bisi','female',21,'creative');insert into wallets(user_id,character_id) select user_id,id from characters;`,
  );
  cid = (await db.query<{ id: string }>("select id from characters where user_id=$1", [uid]))
    .rows[0]!.id;
}, 180_000);
beforeEach(async () => {
  await db.exec(
    `reset role;select set_config('test.user_id','${uid}',false);delete from stall_income_receipts;delete from stall_income_days;delete from stall_income_state;delete from player_stalls;delete from transactions;update wallets set balance=0,total_income=0;update auth.users set is_anonymous=false;`,
  );
  await clock("2026-10-27T12:00:00Z");
});
afterAll(async () => {
  await db?.close();
});
describe("server stall income", () => {
  it("does not enroll or credit on reads, and never backfills a pre-existing open stall", async () => {
    await db.query(
      "insert into player_stalls(user_id,character_id,name,goods,is_open) values($1,$2,'Old stall','Crafts',true)",
      [uid, cid],
    );
    expect(await read()).toMatchObject({ enrolled: false, claimable: 0 });
    expect((await db.query("select * from stall_income_state")).rows).toHaveLength(0);
    await save();
    await clock("2026-10-27T13:00:00Z");
    expect(await read()).toMatchObject({ claimable: 10 });
    expect(
      (await db.query("select balance::int balance from wallets where character_id=$1", [cid]))
        .rows,
    ).toEqual([{ balance: 0 }]);
  });
  it("earns exactly at 360 seconds, keeps sub-second residues, and credits once", async () => {
    await save();
    await clock("2026-10-27T12:05:59.999999Z");
    expect((await read()).claimable).toBe(0);
    await save();
    await clock("2026-10-27T12:06:00Z");
    expect((await read()).claimable).toBe(1);
    const id = request(),
      first = await claim(id);
    expect(first).toMatchObject({ amount: 1, cash: 1, duplicate: false });
    expect(await claim(id)).toEqual({ ...first, duplicate: true });
    expect((await claim()).amount).toBe(0);
    expect(
      (await db.query("select * from transactions where category='stall_income'")).rows,
    ).toHaveLength(1);
  });
  it("preserves rounding through repeated claims, saves and close/open transitions", async () => {
    await save();
    for (let minute = 1; minute <= 6; minute++) {
      await clock(`2026-10-27T12:0${minute}:00Z`);
      await save();
      if (minute < 6) expect((await claim()).amount).toBe(0);
    }
    expect((await claim()).amount).toBe(1);
    await save(false);
    await clock("2026-10-28T12:00:00Z");
    expect((await read()).claimable).toBe(0);
    await save();
    await clock("2026-10-28T13:00:00Z");
    expect((await claim()).amount).toBe(10);
  });
  it("splits earning dates at Lagos midnight, and never moves yesterday's remainder into today", async () => {
    await clock("2026-10-27T22:57:00Z");
    await save();
    await clock("2026-10-27T23:03:00Z");
    expect(await read()).toMatchObject({ date: "2026-10-28", claimable: 0 });
    await clock("2026-10-27T23:06:00Z");
    expect(await read()).toMatchObject({ claimable: 1, todayEarned: 1 });
  });
  it("caps each earning day, preserves the paid cap after reopening, and includes offline elapsed time", async () => {
    await clock("2026-10-26T23:00:00Z");
    await save();
    await clock("2026-10-27T22:00:00Z");
    expect((await claim()).amount).toBe(100);
    await save(false);
    await save();
    await clock("2026-10-27T22:59:59Z");
    expect(await read()).toMatchObject({ claimable: 0, todayEarned: 100, todayPaid: 100 });
  });
  it("retains only seven earning dates and has at most 700 pending after a long absence", async () => {
    await save();
    await clock("2026-11-27T22:59:59Z");
    expect((await read()).claimable).toBe(700);
    expect((await claim()).amount).toBe(700);
    expect((await db.query("select * from stall_income_days")).rows).toHaveLength(7);
  });
  it("expires unclaimed old days without making them today's earnings", async () => {
    await save();
    await clock("2026-10-27T13:00:00Z");
    await save(false);
    await clock("2026-11-03T12:00:00Z");
    expect((await claim()).amount).toBe(0);
  });
  it("does not duplicate or resurrect earnings after the server clock moves backwards", async () => {
    await save();
    await clock("2026-10-27T13:00:00Z");
    expect((await claim()).amount).toBe(10);
    await clock("2026-10-27T12:30:00Z");
    await save(false);
    await save();
    expect((await claim()).amount).toBe(0);
    await clock("2026-10-27T14:00:00Z");
    expect((await claim()).amount).toBe(10);
  });
  it("isolates accounts, denies anonymous use, direct writes and private helpers", async () => {
    await save();
    await clock("2026-10-27T13:00:00Z");
    await claim();
    await db.exec(`select set_config('test.user_id','${other}',false);set role authenticated;`);
    expect((await read()).claimable).toBe(0);
    expect((await db.query("select * from stall_income_receipts")).rows).toEqual([]);
    await expect(db.exec("update stall_income_days set paid=0")).rejects.toThrow("permission");
    await expect(
      db.query("select * from public._stall_income_preview($1,now())", [uid]),
    ).rejects.toThrow("permission");
    await db.exec("reset role");
    await db.query("update auth.users set is_anonymous=true where id=$1", [other]);
    await expect(save()).rejects.toThrow("REGISTERED");
    await expect(claim()).rejects.toThrow("REGISTERED");
    await expect(read()).rejects.toThrow("REGISTERED");
  });
  it("rolls wallet, ledger and receipt back together on a credit failure", async () => {
    await save();
    await clock("2026-10-27T13:00:00Z");
    await db.exec(
      `create function test_stall_fail() returns trigger language plpgsql as $$begin raise exception 'fixture credit failure';end$$;create trigger test_stall_fail before insert on transactions for each row execute function test_stall_fail();`,
    );
    try {
      await expect(claim()).rejects.toThrow("fixture credit failure");
      expect((await db.query("select * from stall_income_receipts")).rows).toEqual([]);
      expect((await read()).claimable).toBe(10);
      expect(
        (await db.query("select balance::int balance from wallets where character_id=$1", [cid]))
          .rows,
      ).toEqual([{ balance: 0 }]);
    } finally {
      await db.exec("drop trigger test_stall_fail on transactions;drop function test_stall_fail()");
    }
  });
  it("preserves paid caps and receipts across character recreation without accruing the deleted gap", async () => {
    await save();
    await clock("2026-10-27T22:00:00Z");
    const id = request(),
      first = await claim(id);
    expect(first.amount).toBe(100);
    await db.query("delete from characters where id=$1", [cid]);
    expect(await claim(id)).toEqual({ ...first, duplicate: true });
    cid = (
      await db.query<{ id: string }>(
        "insert into characters(user_id,name,gender,age,personality) values($1,'New Ade','male',21,'ambitious') returning id",
        [uid],
      )
    ).rows[0]!.id;
    await db.query("insert into wallets(user_id,character_id) values($1,$2)", [uid, cid]);
    await clock("2026-10-27T22:30:00Z");
    await save();
    await clock("2026-10-27T22:59:59Z");
    expect((await claim()).amount).toBe(0);
    expect((await read()).todayPaid).toBe(100);
  });
  it("allows previously earned income to be claimed after closing without accruing closed time", async () => {
    await save();
    await clock("2026-10-27T13:00:00Z");
    await save(false);
    await clock("2026-10-27T16:00:00Z");
    expect(await read()).toMatchObject({ isOpen: false, claimable: 10 });
    expect((await claim()).amount).toBe(10);
  });
  it("discards a deleted stall's unsettled gap while preserving materialized account earnings", async () => {
    await save();
    await clock("2026-10-27T12:06:00Z");
    await save();
    await clock("2026-10-27T12:12:00Z");
    await db.query("delete from characters where id=$1", [cid]);
    cid = (
      await db.query<{ id: string }>(
        "insert into characters(user_id,name,gender,age,personality) values($1,'New Ade','male',21,'ambitious') returning id",
        [uid],
      )
    ).rows[0]!.id;
    await db.query("insert into wallets(user_id,character_id) values($1,$2)", [uid, cid]);
    await clock("2026-10-27T13:00:00Z");
    await save();
    await clock("2026-10-27T13:06:00Z");
    expect((await claim()).amount).toBe(2);
  });
  it("does not count pre-activation time even when the clock is earlier during enrollment", async () => {
    await clock("2026-10-26T23:00:00Z");
    await save();
    expect((await read()).claimable).toBe(0);
    await clock("2026-10-27T00:06:00Z");
    expect((await claim()).amount).toBe(1);
  });
  it("rolls back failed saves and preserves the previous open state and cursor", async () => {
    await save();
    await clock("2026-10-27T13:00:00Z");
    await expect(call("public.save_player_stall('x','Crafts',false)")).rejects.toThrow(
      "stall name",
    );
    expect(await read()).toMatchObject({ isOpen: true, claimable: 10 });
    expect((await db.query("select * from stall_income_days")).rows).toHaveLength(0);
  });
  it("rejects signed-out callers and fails closed without the server policy", async () => {
    await db.exec("select set_config('test.user_id','',false)");
    await expect(read()).rejects.toThrow("REGISTERED");
    await expect(claim()).rejects.toThrow("REGISTERED");
    await db.exec(
      `select set_config('test.user_id','${uid}',false);delete from stall_income_policy;`,
    );
    try {
      await expect(read()).rejects.toThrow("POLICY_UNAVAILABLE");
      await expect(save()).rejects.toThrow("POLICY_UNAVAILABLE");
    } finally {
      await db.exec(
        "insert into stall_income_policy(version,activated_at) values(1,'2026-10-27T00:00:00Z')",
      );
    }
  });
});

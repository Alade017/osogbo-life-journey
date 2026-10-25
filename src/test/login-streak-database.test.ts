// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { LoginStreakReceipt, LoginStreakSnapshot } from "@/lib/login-streak-service";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "33333333-3333-4333-8333-333333333333",
  empty = "44444444-4444-4444-8444-444444444444";
let db: PGlite;
const clock = async (stamp: string) => {
  await db.query("update public.test_login_clock set stamp=$1::timestamptz", [stamp]);
};
async function snapshot() {
  return (
    await db.query<{ value: LoginStreakSnapshot }>("select public.get_login_streak() as value")
  ).rows[0]!.value;
}
async function check(date = "2026-10-25") {
  return (
    await db.query<{ value: LoginStreakReceipt }>(
      "select public.check_in_login($1::date) as value",
      [date],
    )
  ).rows[0]!.value;
}
async function xp() {
  return (
    await db.query<{ xp: number }>("select xp from public.characters where user_id=auth.uid()")
  ).rows[0]!.xp;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;
 create schema auth;create schema extensions;create schema realtime;
 create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
 create table realtime.messages(id bigint generated always as identity);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
 create function realtime.topic() returns text language sql stable as $$select ''::text$$;
 create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$begin return;end$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for (const file of readdirSync("drizzle/migrations")
    .filter((f) => f.endsWith(".sql") && f !== "0075_remove_orphaned_player_data.sql")
    .sort())
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  for (const file of [
    "20261022000000_expanded_town_places.sql",
    "20261025092415_daily_life_tasks.sql",
    "20261025095803_weekly_city_events.sql",
    "20261025152947_login_streak_check_in.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(`create table public.test_login_clock(stamp timestamptz not null);
 insert into public.test_login_clock values('2026-10-25T12:00:00Z');
 create function public.test_login_now() returns timestamptz language sql volatile as $$select stamp from public.test_login_clock$$;`);
  for (const signature of ["public.get_login_streak()", "public.check_in_login(date)"]) {
    const result = await db.query<{ definition: string }>(
      "select pg_get_functiondef($1::regprocedure) as definition",
      [signature],
    );
    await db.exec(
      result.rows[0]!.definition.replaceAll("clock_timestamp()", "public.test_login_now()"),
    );
  }
  await db.exec(`insert into auth.users(id) values('${uid}'),('${other}'),('${empty}');
 insert into public.profiles(id) values('${uid}'),('${other}'),('${empty}');
 insert into public.characters(user_id,name,gender,age,personality) values('${uid}','Ade','male',21,'ambitious'),('${other}','Bisi','female',21,'creative');`);
}, 180_000);
beforeEach(async () => {
  await db.exec(`reset role;select set_config('test.user_id','${uid}',false);
 delete from public.login_streak_claims;delete from public.login_streak_state;
 update public.characters set xp=0,level=1;update auth.users set is_anonymous=false;`);
  await clock("2026-10-25T12:00:00Z");
});
afterAll(async () => {
  await db?.close();
});
describe("authoritative login streaks", () => {
  it("reads without rewards and pays the first day exactly once", async () => {
    expect(await snapshot()).toMatchObject({
      date: "2026-10-25",
      streak: 0,
      todayClaimed: false,
      rewardXp: 5,
    });
    expect(await xp()).toBe(0);
    const wallets = (await db.query("select * from public.wallets order by character_id")).rows;
    const first = await check();
    expect(first).toMatchObject({ streak: 1, rewardXp: 5, newlyAwarded: true });
    expect(await check()).toEqual({ ...first, newlyAwarded: false });
    expect(await xp()).toBe(5);
    expect(await snapshot()).toMatchObject({ streak: 1, todayClaimed: true });
    expect((await db.query("select * from public.wallets order by character_id")).rows).toEqual(
      wallets,
    );
  });
  it("continues consecutive days and resets after one or several missed days", async () => {
    await check();
    await clock("2026-10-26T12:00:00Z");
    expect((await check("2026-10-26")).streak).toBe(2);
    await clock("2026-10-28T12:00:00Z");
    expect((await snapshot()).streak).toBe(0);
    expect((await check("2026-10-28")).streak).toBe(1);
    await clock("2026-11-05T12:00:00Z");
    expect((await check("2026-11-05")).streak).toBe(1);
    expect(await xp()).toBe(20);
  });
  it("uses the Lagos day at midnight and rejects a stale snapshot date", async () => {
    await clock("2026-10-25T22:59:59Z");
    await check();
    await clock("2026-10-25T23:00:00Z");
    expect((await snapshot()).date).toBe("2026-10-26");
    await expect(check()).rejects.toThrow(/day has changed/);
    expect((await check("2026-10-26")).streak).toBe(2);
    expect(await xp()).toBe(10);
    await expect(check("2026-10-27")).rejects.toThrow(/day has changed/);
  });
  it("counts consecutive month, leap-day and year transitions correctly", async () => {
    for (const dates of [
      ["2028-02-28", "2028-02-29", "2028-03-01"],
      ["2026-12-31", "2027-01-01", "2027-01-02"],
    ]) {
      await db.exec(
        "delete from public.login_streak_claims;delete from public.login_streak_state;",
      );
      for (const [index, date] of dates.entries()) {
        await clock(`${date}T12:00:00Z`);
        expect((await check(date)).streak).toBe(index + 1);
      }
    }
  });
  it("rolls back streak state, receipt and XP when reward processing fails", async () => {
    const original = (
      await db.query<{ definition: string }>(
        "select pg_get_functiondef('public._grant_xp(uuid,integer)'::regprocedure) as definition",
      )
    ).rows[0]!.definition;
    await db.exec(
      "create or replace function public._grant_xp(p_char uuid,p_xp integer) returns integer language plpgsql as $$begin raise exception 'reward failure';end$$",
    );
    try {
      await expect(check()).rejects.toThrow(/reward failure/);
      expect((await db.query("select * from public.login_streak_claims")).rows).toHaveLength(0);
      expect((await db.query("select * from public.login_streak_state")).rows).toHaveLength(0);
      expect(await xp()).toBe(0);
    } finally {
      await db.exec(original);
    }
    expect((await check()).newlyAwarded).toBe(true);
    expect(await xp()).toBe(5);
  });
  it("keeps account claims and counts across character recreation", async () => {
    await check();
    await db.exec("delete from public.characters where user_id=auth.uid()");
    await db.query(
      "insert into public.characters(user_id,name,gender,age,personality) values($1,'Ade Again','male',21,'ambitious')",
      [uid],
    );
    expect((await check()).newlyAwarded).toBe(false);
    expect(await xp()).toBe(0);
    await clock("2026-10-26T12:00:00Z");
    expect((await check("2026-10-26")).streak).toBe(2);
    expect(await xp()).toBe(5);
  });
  it("enforces actual RLS and blocks direct writes, anonymous and missing-character claims", async () => {
    await check();
    await db.exec(`select set_config('test.user_id','${other}',false);set role authenticated`);
    expect((await db.query("select * from public.login_streak_claims")).rows).toHaveLength(0);
    expect((await db.query("select * from public.login_streak_state")).rows).toHaveLength(0);
    await expect(db.exec("update public.login_streak_settings set reward_xp=5")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.exec("insert into public.login_streak_state values(auth.uid(),current_date,99)"),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("delete from public.login_streak_claims")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec(`select set_config('test.user_id','${uid}',false)`);
    expect((await db.query("select * from public.login_streak_claims")).rows).toHaveLength(1);
    await db.exec(`reset role;update auth.users set is_anonymous=true where id='${uid}'`);
    await expect(check()).rejects.toThrow(/registered/);
    await db.exec(`select set_config('test.user_id','${empty}',false)`);
    await expect(check()).rejects.toThrow(/character/);
    await db.exec("select set_config('test.user_id','',false)");
    await expect(snapshot()).rejects.toThrow(/registered/);
    await db.exec("set role anon");
    await expect(check()).rejects.toThrow(/permission denied/);
  });
  it("bounds server reward configuration", async () => {
    await expect(db.exec("update public.login_streak_settings set reward_xp=6")).rejects.toThrow(
      /check constraint/,
    );
  });
});

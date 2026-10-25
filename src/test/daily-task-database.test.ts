// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const uid = "11111111-1111-4111-8111-111111111111";
const other = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
let cid: string;
const stamp = "2026-10-25T12:00:00Z";
async function clock(value: string) {
  await db.query("update public.test_daily_clock set stamp=$1::timestamptz", [value]);
}
async function snapshot() {
  const result = await db.query<{
    value: {
      date: string;
      resetsAt: string;
      tasks: { key: string; completed: boolean; claimed: boolean }[];
    };
  }>("select public.get_daily_tasks() as value");
  return result.rows[0]!.value;
}
async function complete(action: string, request = crypto.randomUUID()) {
  await db.query(
    "insert into public.simulation_action_receipts(character_id,request_id,action_id) values($1,$2,$3)",
    [cid, request, action],
  );
}
async function claim(key = "meal", date = "2026-10-25") {
  return (
    await db.query<{ value: { rewardXp: number; claimed: boolean } }>(
      "select public.claim_daily_task($1,$2::date) as value",
      [key, date],
    )
  ).rows[0]!.value;
}
async function xp() {
  return (await db.query<{ xp: number }>("select xp from public.characters where id=$1", [cid]))
    .rows[0]!.xp;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions; create schema realtime;
    create table auth.users(id uuid primary key, is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const file of readdirSync("drizzle/migrations")
    .filter((f) => f.endsWith(".sql") && f !== "0075_remove_orphaned_player_data.sql")
    .sort()) {
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  }
  // Apply the exact dated migration after the canonical existing game baseline.
  await db.exec(readFileSync("supabase/migrations/20261025092415_daily_life_tasks.sql", "utf8"));
  // Replace only the clock in this ephemeral DB. Production has no clock parameter/GUC override.
  await db.exec(`create table public.test_daily_clock(stamp timestamptz not null);
    insert into public.test_daily_clock values('${stamp}');
    create function public.test_daily_now() returns timestamptz language sql volatile as $$ select stamp from public.test_daily_clock $$;`);
  for (const signature of [
    "public.get_daily_tasks()",
    "public.claim_daily_task(text,date)",
    "public.stamp_simulation_receipt_completion()",
  ]) {
    const definition = await db.query<{ definition: string }>(
      "select pg_get_functiondef($1::regprocedure) as definition",
      [signature],
    );
    await db.exec(
      definition.rows[0]!.definition.replaceAll("clock_timestamp()", "public.test_daily_now()"),
    );
  }
  await db.exec(`insert into auth.users(id) values('${uid}'),('${other}');
    insert into public.profiles(id) values('${uid}'),('${other}');
    insert into public.characters(user_id,name,gender,age,personality) values
    ('${uid}','Ade','male',21,'ambitious'),('${other}','Bisi','female',21,'creative');`);
  cid = (await db.query<{ id: string }>("select id from public.characters where user_id=$1", [uid]))
    .rows[0]!.id;
  await db.query(
    "insert into public.player_missions(user_id,character_id,mission_id) select $1,$2,id from public.missions",
    [uid, cid],
  );
}, 180_000);
beforeEach(async () => {
  await db.exec(`reset role; delete from public.daily_task_claims; delete from public.simulation_action_receipts;
    update auth.users set is_anonymous=false; update public.characters set xp=0,level=1;
    select set_config('test.user_id','${uid}',false);`);
  await clock(stamp);
});
afterAll(async () => {
  await db?.close();
});

describe("daily tasks database acceptance", () => {
  it("unlocks only after the existing simulation command confirms completion", async () => {
    const session = crypto.randomUUID();
    let revision = 0;
    async function command(
      kind: string,
      action: string | null = null,
      request: string | null = null,
    ) {
      const response = await db.query<{ value: { revision: number } }>(
        "select public.personal_simulation_command($1,$2,$3,$4,$5) as value",
        [session, revision, kind, action, request],
      );
      revision = response.rows[0]!.value.revision;
    }
    await command("open");
    await command("start", "eat", "verified-meal");
    expect((await snapshot()).tasks[0]!.completed).toBe(false);
    await command("complete", "eat", "verified-meal");
    expect((await snapshot()).tasks[0]!.completed).toBe(true);
    await claim();
    expect(await xp()).toBe(5);
    await command("complete", "eat", "verified-meal");
    await claim();
    expect(await xp()).toBe(5);
  });
  it("keeps lifetime missions and supplies three uncompleted objectives", async () => {
    const s = await snapshot();
    expect(s.date).toBe("2026-10-25");
    expect(Date.parse(s.resetsAt)).toBe(Date.parse("2026-10-25T23:00:00Z"));
    expect(s.tasks.map((t) => t.key)).toEqual(["meal", "study", "social"]);
    expect(s.tasks.every((t) => !t.completed && !t.claimed)).toBe(true);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int as count from public.player_missions where character_id=$1",
          [cid],
        )
      ).rows[0]!.count,
    ).toBeGreaterThan(0);
    await expect(claim()).rejects.toThrow(/Complete/);
    await expect(claim("invented")).rejects.toThrow(/not found/);
  });
  it("awards exactly 15 XP for all three activities and retries without paying twice", async () => {
    for (const [action, key] of [
      ["eat", "meal"],
      ["study", "study"],
      ["socialize", "social"],
    ]) {
      await complete(action!);
      const first = await claim(key);
      expect(first.rewardXp).toBe(5);
      expect(await claim(key)).toEqual(first);
    }
    expect(await xp()).toBe(15);
    expect((await snapshot()).tasks.every((t) => t.claimed)).toBe(true);
    await db.exec("delete from public.simulation_action_receipts");
    expect((await claim()).claimed).toBe(true);
    expect(await xp()).toBe(15);
  });
  it("uses Lagos completion day across midnight and rejects stale claims", async () => {
    await clock("2026-10-25T22:59:59Z");
    await complete("eat");
    expect((await snapshot()).tasks[0]!.completed).toBe(true);
    await clock("2026-10-25T23:00:00Z");
    expect((await snapshot()).date).toBe("2026-10-26");
    expect((await snapshot()).tasks[0]!.completed).toBe(false);
    await expect(claim()).rejects.toThrow(/reset/);
    await complete("study");
    expect((await snapshot()).tasks.find((t) => t.key === "study")!.completed).toBe(true);
    await claim("study", "2026-10-26");
    expect(await xp()).toBe(5);
  });
  it("stamps completion at receipt insertion rather than the start of a transaction", async () => {
    await db.exec("begin");
    try {
      await clock("2026-10-25T22:59:59Z");
      await clock("2026-10-25T23:00:01Z");
      await db.query(
        "insert into public.simulation_action_receipts(character_id,request_id,action_id,completed_at) values($1,'cross-midnight','eat','2026-10-25T22:59:59Z')",
        [cid],
      );
      expect((await snapshot()).tasks[0]!.completed).toBe(true);
      await claim("meal", "2026-10-26");
      await db.exec("commit");
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  });
  it("blocks anonymous users and unauthenticated execution", async () => {
    await db.exec(`update auth.users set is_anonymous=true where id='${uid}'`);
    await expect(snapshot()).rejects.toThrow(/registered/);
    await expect(claim()).rejects.toThrow(/registered/);
    await db.exec("select set_config('test.user_id','',false)");
    await expect(claim()).rejects.toThrow(/registered/);
    await db.exec("set role anon");
    await expect(snapshot()).rejects.toThrow(/permission denied/);
  });
  it("enforces actual ownership RLS, no direct writes and no foreign receipt eligibility", async () => {
    await complete("eat");
    await claim();
    await db.exec(`select set_config('test.user_id','${other}',false); set role authenticated`);
    expect((await db.query("select * from public.daily_task_claims")).rows).toHaveLength(0);
    await expect(claim()).rejects.toThrow(/Complete/);
    await expect(
      db.exec(
        "insert into public.daily_task_claims(user_id,lagos_date,task_key,reward_xp) values(auth.uid(),current_date,'meal',5)",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("update public.daily_task_catalog set reward_xp=0")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec(`select set_config('test.user_id','${uid}',false)`);
    expect((await db.query("select * from public.daily_task_claims")).rows).toHaveLength(1);
  });
  it("rolls back a claim if the reward helper fails", async () => {
    await complete("eat");
    const original = (
      await db.query<{ definition: string }>(
        "select pg_get_functiondef('public._grant_xp(uuid,integer)'::regprocedure) as definition",
      )
    ).rows[0]!.definition;
    await db.exec(
      "create or replace function public._grant_xp(p_char uuid,p_xp integer) returns integer language plpgsql as $$ begin raise exception 'test reward failure'; end $$",
    );
    try {
      await expect(claim()).rejects.toThrow(/test reward failure/);
      expect((await db.query("select * from public.daily_task_claims")).rows).toHaveLength(0);
      expect(await xp()).toBe(0);
    } finally {
      await db.exec(original);
    }
    await claim();
    expect(await xp()).toBe(5);
  });
  it("retains account claims across character recreation", async () => {
    await complete("eat");
    await claim();
    await db.query("delete from public.characters where id=$1", [cid]);
    await db.query(
      "insert into public.characters(user_id,name,gender,age,personality) values($1,'Ade Again','male',21,'ambitious')",
      [uid],
    );
    cid = (
      await db.query<{ id: string }>("select id from public.characters where user_id=$1", [uid])
    ).rows[0]!.id;
    expect((await claim()).rewardXp).toBe(5);
    expect(await xp()).toBe(0);
    expect((await snapshot()).tasks[0]!.claimed).toBe(true);
  });
});

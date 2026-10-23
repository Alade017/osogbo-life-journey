// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
let db: PGlite;
async function asUser(id: string) {
  await db.query("select set_config('test.user_id',$1,false)", [id]);
}
async function call(sql: string, args: unknown[] = []) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await db.query<{ result: any }>(`select ${sql} as result`, args);
  return result.rows[0]!.result;
}
async function balance() {
  const result = await db.query<{ balance: number }>("select balance from public.wallets where user_id=$1", [userId]);
  return Number(result.rows[0]!.balance);
}

describe("authoritative career progression database", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create schema realtime;
      create table auth.users(id uuid primary key); create table realtime.messages(id bigint generated always as identity);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
      create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    for (const { tag } of journal.entries) await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261019100000_party_life.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261019110000_party_clubs_and_activities.sql", "utf8"));
    await db.exec(readFileSync("supabase/migrations/20261023090000_career_progression.sql", "utf8"));
    await db.query("insert into auth.users values($1)", [userId]);
    await db.query("insert into public.profiles(id) values($1)", [userId]);
    await db.query("insert into public.characters(user_id,name,gender,age,personality) values($1,'Career Tester','male',24,'ambitious')", [userId]);
    await db.query("insert into public.wallets(user_id,character_id,balance) select $1,id,100000 from public.characters where user_id=$1", [userId]);
  }, 180_000);
  afterAll(async () => { await db?.close(); });

  it("prevents double application, withholds pay until the final step, rejects out-of-order steps and caps mood", async () => {
    await asUser(userId);
    const char = (await db.query<{ id: string }>("select id from public.characters where user_id=$1", [userId])).rows[0]!;
    await db.query("update public.characters set current_location_id=(select id from public.locations where slug='city-centre') where id=$1", [char.id]);

    const applyRequest = randomUUID();
    const applied = await call("public.apply_for_career('banking',$1)", [applyRequest]);
    const replayedApplication = await call("public.apply_for_career('banking',$1)", [applyRequest]);
    expect(replayedApplication.application_id).toBe(applied.application_id);
    await expect(call("public.apply_for_career('retail',$1)", [randomUUID()])).rejects.toThrow(/active career/);

    const startingCash = await balance();
    const started = await call("public.start_career_shift($1)", [randomUUID()]);
    const stepOneRequest = randomUUID();
    const stepOne = await call("public.complete_career_step($1,1,$2)", [started.session_id, stepOneRequest]);
    const stepOneReplay = await call("public.complete_career_step($1,1,$2)", [started.session_id, stepOneRequest]);
    expect(stepOneReplay.step_completed).toBe(1);
    expect(stepOneReplay.paid).toBe(0);
    expect(await balance()).toBe(startingCash);
    await expect(call("public.complete_career_step($1,3,$2)", [started.session_id, randomUUID()])).rejects.toThrow(/next step in order/);

    await call("public.complete_career_step($1,2,$2)", [started.session_id, randomUUID()]);
    expect(await balance()).toBe(startingCash);
    await db.query("insert into public.party_mood(character_id,user_id,score) values($1,$2,99) on conflict(character_id) do update set score=99", [char.id,userId]);
    const final = await call("public.complete_career_step($1,3,$2)", [started.session_id, randomUUID()]);
    expect(final.shift_complete).toBe(true);
    expect(Number(final.paid)).toBe(3500);
    expect(await balance()).toBe(startingCash + 3500);
    const mood = await db.query<{ score: number }>("select score from public.party_mood where character_id=$1", [char.id]);
    expect(mood.rows[0]!.score).toBe(100);
    await expect(call("public.complete_career_step($1,4,$2)", [started.session_id, randomUUID()])).rejects.toThrow(/not active/);
  }, 180_000);
});

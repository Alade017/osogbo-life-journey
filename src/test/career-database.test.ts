// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it } from "vitest";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let aliceCharacter: string;
let bobCharacter: string;
let shiftId: string;

async function act<T>(sql: string, params: unknown[] = []): Promise<T> {
  const response = await db.query<{ value: T }>(`select ${sql} as value`, params);
  return response.rows[0]!.value;
}

describe("career database transitions", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create schema realtime;
      create table auth.users(id uuid primary key, is_anonymous boolean not null default false);
      create table realtime.messages(id bigint generated always as identity);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
      create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
      grant usage on schema auth to authenticated;
      grant execute on function auth.uid() to authenticated;`);
    for (const file of readdirSync("drizzle/migrations")
      .filter((name) => name.endsWith(".sql") && !name.startsWith("0075_"))
      .sort()) {
      try {
        await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${String(error)}`);
      }
    }
    // The production Party Life migration lives in supabase/migrations rather than
    // the Drizzle chain. Install its mood contract in this isolated career fixture.
    await db.exec(`create table public.party_mood(character_id uuid primary key,user_id uuid not null,
      score integer not null default 50 check(score between 0 and 100));
      create function public.apply_party_mood(p_character_id uuid,p_user_id uuid,p_delta integer)
      returns integer language plpgsql as $$ declare next_score integer; begin
        insert into public.party_mood(character_id,user_id) values(p_character_id,p_user_id)
          on conflict(character_id) do nothing;
        update public.party_mood set score=least(100,greatest(0,score+p_delta))
          where character_id=p_character_id returning score into next_score;
        return next_score;
      end $$;`);
    await db.exec(`insert into auth.users(id) values('${alice}'),('${bob}');
      insert into public.profiles(id) values('${alice}'),('${bob}');
      insert into public.characters(user_id,name,gender,age,personality,energy,game_time_hour,current_location_id)
      values('${alice}','Ade','male',21,'ambitious',100,10,(select id from public.locations where slug='cedar-bank')),
            ('${bob}','Bisi','female',21,'ambitious',100,10,(select id from public.locations where slug='meridian-bank'));
      insert into public.wallets(user_id,character_id)
      select user_id,id from public.characters;
      select set_config('test.user_id','${alice}',false);`);
    const characters = await db.query<{ id: string; user_id: string }>(
      "select id,user_id from public.characters",
    );
    aliceCharacter = characters.rows.find((entry) => entry.user_id === alice)!.id;
    bobCharacter = characters.rows.find((entry) => entry.user_id === bob)!.id;
  }, 180_000);
  afterAll(async () => {
    await db?.close();
  });

  it("seeds the two paths, six ranks, and three existing workplace locations", async () => {
    const counts = await db.query<{ paths: number; ranks: number; workplaces: number }>(`
      select (select count(*)::int from public.career_paths) paths,
      (select count(*)::int from public.career_ranks) ranks,
      (select count(*)::int from public.jobs where career_path_slug is not null and location_id is not null) workplaces`);
    expect(counts.rows[0]).toMatchObject({ paths: 2, ranks: 6, workplaces: 3 });
    const salaries = await db.query<{ path_slug: string; level: number; salary: number }>(
      "select path_slug,level,salary from public.career_ranks order by path_slug,level",
    );
    expect(salaries.rows).toEqual([
      { path_slug: "banking", level: 1, salary: 3500 },
      { path_slug: "banking", level: 2, salary: 5000 },
      { path_slug: "banking", level: 3, salary: 7000 },
      { path_slug: "retail", level: 1, salary: 3000 },
      { path_slug: "retail", level: 2, salary: 4500 },
      { path_slug: "retail", level: 3, salary: 6500 },
    ]);
  });

  it("requires employment and the correct workplace", async () => {
    await expect(act("public.start_career_shift()")).rejects.toThrow("Apply for a career first");
    const job = await db.query<{ id: string }>(
      "select id from public.jobs where slug='career_cedar_banking'",
    );
    await act("public.select_job($1)", [job.rows[0]!.id]);
    await expect(
      act("public.perform_job($1)", ["33333333-3333-4333-8333-333333333333"]),
    ).rejects.toThrow("three-step");
    await db.exec(
      "update public.characters set current_location_id=(select id from public.locations where slug='city-centre') where user_id='" +
        alice +
        "'",
    );
    await expect(act("public.start_career_shift()")).rejects.toThrow("Travel to your workplace");
    await db.exec(
      "update public.characters set current_location_id=(select id from public.locations where slug='cedar-bank') where user_id='" +
        alice +
        "'",
    );
  });

  it("completes ordered steps and awards a single wallet payment", async () => {
    const started = await act<{ id: string; step_count: number }>("public.start_career_shift()");
    shiftId = started.id;
    expect((await act<{ id: string }>("public.start_career_shift()")).id).toBe(shiftId);
    await expect(act("public.complete_career_step($1,$2)", [shiftId, 3])).rejects.toThrow(
      "in order",
    );
    await expect(act("public.claim_career_shift($1)", [shiftId])).rejects.toThrow(
      "three work steps",
    );
    for (let step = 1; step <= 3; step++) {
      await db.query(
        "update public.career_shifts set next_step_at=now()-interval '1 second' where id=$1",
        [shiftId],
      );
      await act("public.complete_career_step($1,$2)", [shiftId, step]);
    }
    await db.query(
      "update public.career_shifts set next_step_at=now()-interval '1 second' where id=$1",
      [shiftId],
    );
    const first = await act<{ earned: number; duplicate: boolean }>(
      "public.claim_career_shift($1)",
      [shiftId],
    );
    const repeated = await act<{ earned: number; duplicate: boolean }>(
      "public.claim_career_shift($1)",
      [shiftId],
    );
    expect(first).toMatchObject({ earned: 3500, duplicate: false });
    expect(repeated).toMatchObject({ earned: 3500, duplicate: true });
    const effects = await db.query<{
      balance: number;
      receipts: number;
      shifts: number;
      mood: number;
    }>(
      `
      select (select balance::int from public.wallets where character_id=$1) balance,
        (select count(*)::int from public.transactions where character_id=$1 and category='career_shift') receipts,
        (select times_performed from public.character_jobs where character_id=$1 and is_current) shifts,
        (select score from public.party_mood where character_id=$1) mood`,
      [aliceCharacter],
    );
    expect(effects.rows[0]).toMatchObject({ balance: 3500, receipts: 1, shifts: 1, mood: 52 });
  });

  it("blocks early promotion and cross-character shift access", async () => {
    await expect(act("public.promote_career()")).rejects.toThrow("Promotion needs");
    await db.exec(`select set_config('test.user_id','${bob}',false)`);
    await expect(act("public.claim_career_shift($1)", [shiftId])).rejects.toThrow(
      "Shift not found",
    );
    const aliceShift = await db.query<{ count: number }>(
      "select count(*)::int as count from public.career_shifts where character_id=$1",
      [aliceCharacter],
    );
    expect(aliceShift.rows[0]?.count).toBe(1);
    expect(bobCharacter).toBeTruthy();
  });

  it("cancels unpaid work and preserves employment history after leaving and rejoining", async () => {
    await db.exec(`select set_config('test.user_id','${alice}',false)`);
    await db.exec(
      `update public.character_jobs set last_performed_at=now()-interval '2 hours' where character_id='${aliceCharacter}'`,
    );
    const started = await act<{ id: string }>("public.start_career_shift()");
    const cancelled = await act<{ status: string }>("public.cancel_career_shift($1)", [started.id]);
    expect(cancelled.status).toBe("cancelled");
    await expect(act("public.claim_career_shift($1)", [started.id])).rejects.toThrow();
    await act("public.leave_career()");
    const job = await db.query<{ id: string }>(
      "select id from public.jobs where slug='career_cedar_banking'",
    );
    await act("public.select_job($1)", [job.rows[0]!.id]);
    const employment = await db.query<{ times_performed: number; is_current: boolean }>(
      "select times_performed,is_current from public.character_jobs where character_id=$1 and job_id=$2",
      [aliceCharacter, job.rows[0]!.id],
    );
    expect(employment.rows[0]).toMatchObject({ times_performed: 1, is_current: true });
  });

  it("restricts career-shift reads to their owner through RLS", async () => {
    await db.exec(`select set_config('test.user_id','${bob}',false); set role authenticated`);
    try {
      const visible = await db.query<{ id: string }>("select id from public.career_shifts");
      expect(visible.rows).toHaveLength(0);
      await expect(
        db.query("update public.career_shifts set paid_amount=999999"),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });

  describe("promotion acceptance with isolated fixture state", () => {
    async function thresholds(rank: number, shifts: number, skill: number) {
      await db.query(
        "update character_jobs set career_level=$2,times_performed=$3 where character_id=$1 and is_current",
        [aliceCharacter, rank, shifts],
      );
      await db.query(
        `insert into player_skills(user_id,character_id,skill_slug,level) select $1,$2,j.skill_reward_slug,$3 from character_jobs cj join jobs j on j.id=cj.job_id where cj.character_id=$2 and cj.is_current on conflict(character_id,skill_slug) do update set level=excluded.level`,
        [alice, aliceCharacter, skill],
      );
    }
    beforeEach(async () => {
      await db.exec(`reset role;select set_config('test.user_id','${alice}',false);`);
      await db.query("delete from career_shifts where character_id=$1", [aliceCharacter]);
      await db.query("delete from transactions where character_id=$1", [aliceCharacter]);
      await db.query("update wallets set balance=0 where character_id=$1", [aliceCharacter]);
      await db.query(
        "update characters set energy=100,game_time_hour=10,current_location_id=(select id from locations where slug='cedar-bank') where id=$1",
        [aliceCharacter],
      );
      if (
        (
          await db.query("select id from character_jobs where character_id=$1 and is_current", [
            aliceCharacter,
          ])
        ).rows.length
      )
        await act("public.leave_career()");
      await act("public.select_job((select id from jobs where slug='career_cedar_banking'))");
      await db.query("update character_jobs set last_performed_at=null where character_id=$1", [
        aliceCharacter,
      ]);
      await thresholds(1, 0, 0);
    });
    afterEach(async () => {
      await db.exec("reset role");
    });
    it.each([
      [1, 4, 1],
      [1, 5, 0],
      [2, 14, 3],
      [2, 15, 2],
    ])("rejects rank %i with %i shifts and skill %i", async (rank, shifts, skill) => {
      await thresholds(rank, shifts, skill);
      await expect(act("public.promote_career()")).rejects.toThrow("Promotion needs");
    });
    it("advances one rank per request, persists titles/pay, and does not mint money", async () => {
      await thresholds(1, 15, 3);
      expect(await act("public.promote_career()")).toMatchObject({
        career_level: 2,
        title: "Customer Service Officer",
        salary: 5000,
      });
      expect(
        (
          await db.query(
            "select career_level from character_jobs where character_id=$1 and is_current",
            [aliceCharacter],
          )
        ).rows,
      ).toEqual([{ career_level: 2 }]);
      expect(await act("public.promote_career()")).toMatchObject({
        career_level: 3,
        title: "Branch Supervisor",
        salary: 7000,
      });
      await expect(act("public.promote_career()")).rejects.toThrow("highest rank");
      expect(
        (
          await db.query("select balance::int balance from wallets where character_id=$1", [
            aliceCharacter,
          ])
        ).rows,
      ).toEqual([{ balance: 0 }]);
      expect(
        (await db.query("select * from transactions where character_id=$1", [aliceCharacter])).rows,
      ).toHaveLength(0);
    });
    it("blocks qualified active work and allows promotion after cancelling without shift credit", async () => {
      await thresholds(1, 5, 1);
      const shift = await act<{ id: string }>("public.start_career_shift()");
      await expect(act("public.promote_career()")).rejects.toThrow("active shift");
      await act("public.cancel_career_shift($1)", [shift.id]);
      expect(
        (
          await db.query(
            "select times_performed from character_jobs where character_id=$1 and is_current",
            [aliceCharacter],
          )
        ).rows,
      ).toEqual([{ times_performed: 5 }]);
      expect(await act("public.promote_career()")).toMatchObject({ career_level: 2 });
    });
    it.each([
      ["career_cedar_banking", 2, 5000],
      ["career_cedar_banking", 3, 7000],
      ["career_osun_mall_retail", 2, 4500],
      ["career_osun_mall_retail", 3, 6500],
    ])("pays the promoted %s rank %i salary once", async (slug, rank, pay) => {
      await db.query(
        "update characters set current_location_id=(select location_id from jobs where slug=$2) where id=$1",
        [aliceCharacter, slug],
      );
      if (slug !== "career_cedar_banking") await act("public.leave_career()");
      await act("public.select_job((select id from jobs where slug=$1))", [slug]);
      await thresholds(1, 15, 3);
      await act("public.promote_career()");
      if (rank === 3) await act("public.promote_career()");
      const shift = await act<{ id: string }>("public.start_career_shift()");
      expect(
        (await db.query("select rank_level from career_shifts where id=$1", [shift.id])).rows,
      ).toEqual([{ rank_level: rank }]);
      for (let step = 1; step <= 3; step++) {
        await db.query(
          "update career_shifts set next_step_at=now()-interval '1 second' where id=$1",
          [shift.id],
        );
        await act("public.complete_career_step($1,$2)", [shift.id, step]);
      }
      await db.query(
        "update career_shifts set next_step_at=now()-interval '1 second' where id=$1",
        [shift.id],
      );
      expect(await act("public.claim_career_shift($1)", [shift.id])).toMatchObject({
        earned: pay,
        duplicate: false,
      });
      expect(await act("public.claim_career_shift($1)", [shift.id])).toMatchObject({
        earned: pay,
        duplicate: true,
      });
      expect(
        (
          await db.query("select balance::int balance from wallets where character_id=$1", [
            aliceCharacter,
          ])
        ).rows,
      ).toEqual([{ balance: pay }]);
      expect(
        (
          await db.query(
            "select * from transactions where character_id=$1 and category='career_shift'",
            [aliceCharacter],
          )
        ).rows,
      ).toHaveLength(1);
      expect(
        (
          await db.query(
            "select times_performed from character_jobs where character_id=$1 and is_current",
            [aliceCharacter],
          )
        ).rows,
      ).toEqual([{ times_performed: 16 }]);
    });
    it("rejects unauthenticated promotion and cannot target another character", async () => {
      await thresholds(1, 5, 1);
      await db.exec("select set_config('test.user_id','',false)");
      await expect(act("public.promote_career()")).rejects.toThrow("Sign in");
      await db.exec(`select set_config('test.user_id','${bob}',false)`);
      await expect(act("public.promote_career()")).rejects.toThrow("No active career");
      expect(
        (
          await db.query(
            "select career_level from character_jobs where character_id=$1 and is_current",
            [aliceCharacter],
          )
        ).rows,
      ).toEqual([{ career_level: 1 }]);
    });
    it("exposes no browser write path to rank or skill and restricts employment reads", async () => {
      await db.exec("set role authenticated");
      await expect(db.exec("update character_jobs set career_level=3")).rejects.toThrow(
        "permission",
      );
      await expect(db.exec("update player_skills set level=100")).rejects.toThrow("permission");
      await db.exec(`select set_config('test.user_id','${bob}',false)`);
      expect(
        (await db.query("select * from character_jobs where character_id=$1", [aliceCharacter]))
          .rows,
      ).toHaveLength(0);
    });
  });
});

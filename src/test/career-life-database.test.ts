// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, afterAll, beforeEach, afterEach, expect, it } from "vitest";

const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
let db: PGlite;
let char: string;
let bobChar: string;
let course: string;
let slug: string;
let job: string;
async function query<T>(sql: string, params: unknown[] = []) {
  await db.exec("savepoint career_call");
  try {
    const response = await db.query<T>(sql, params);
    await db.exec("release savepoint career_call");
    return response.rows;
  } catch (error) {
    await db.exec("rollback to savepoint career_call;release savepoint career_call");
    throw error;
  }
}
async function value<T>(sql: string, params: unknown[] = []) {
  return (await query<{ result: T }>(`select ${sql} as result`, params))[0]!.result;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema extensions;create schema realtime;
    create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return;end $$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for (const file of readdirSync("drizzle/migrations")
    .filter(
      (name) => name.endsWith(".sql") && !name.startsWith("0075_") && !name.startsWith("0077_"),
    )
    .sort()) {
      if (file === "0083_studio_room_layout") {
        // The studio layout migration depends on x/y columns from this Supabase migration.
        await db.exec(
          readFileSync(
            "supabase/migrations/20261102223137_freeform_house_furniture_placement.sql",
            "utf8",
          ),
        );
      }
if (file === "0085_house_floors.sql") {
          // House floors serialize the placement rotation column introduced by this Supabase migration.
          await db.exec(
            readFileSync(
              "supabase/migrations/20261105080000_house_placement_rotation.sql",
              "utf8",
            ),
          );
        }
                await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8").replace(/^\uFEFF/, ""));
  }
  await db.exec(
    readFileSync("supabase/migrations/20261101232845_career_life_and_saved_courses.sql", "utf8"),
  );
  for (const [user, name] of [
    [alice, "Ade"],
    [bob, "Bisi"],
  ]) {
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query("insert into profiles(id) values($1)", [user]);
    await db.query(
      "insert into characters(user_id,name,gender,age,personality) values($1,$2,'female',24,'ambitious')",
      [user, name],
    );
  }
  char = (await db.query<{ id: string }>("select id from characters where user_id=$1", [alice]))
    .rows[0]!.id;
  bobChar = (await db.query<{ id: string }>("select id from characters where user_id=$1", [bob]))
    .rows[0]!.id;
  const c = (
    await db.query<{ id: string; slug: string }>(
      "select id,slug from education_courses order by sort_order limit 1",
    )
  ).rows[0]!;
  course = c.id;
  slug = c.slug;
  job = (await db.query<{ id: string }>("select id from jobs where slug='career_cedar_banking'"))
    .rows[0]!.id;
  await db.exec("insert into wallets(user_id,character_id) select user_id,id from characters");
}, 180000);
beforeEach(async () => {
  await db.exec("begin");
  await db.query("select set_config('test.user_id',$1,true)", [alice]);
});
afterEach(async () => {
  await db.exec("rollback;reset role");
});
afterAll(async () => {
  await db?.close();
});

it("saves idempotently without charging, and persists across fresh reads", async () => {
  await db.exec("set local role authenticated");
  await value("public.set_saved_course($1,true)", [slug]);
  await value("public.set_saved_course($1,true)", [slug]);
  expect(await query("select course_id from player_course_plans")).toEqual([{ course_id: course }]);
  expect(await query("select * from transactions")).toHaveLength(0);
  expect(await query("select * from player_courses")).toHaveLength(0);
});
it("unsaves only the caller's course and does not remove a completion", async () => {
  await db.query(
    "insert into player_course_plans(user_id,character_id,course_id) values($1,$2,$3),($4,$5,$3)",
    [alice, char, course, bob, bobChar],
  );
  await db.query(
    "insert into player_courses(user_id,character_id,course_id,tuition_paid) values($1,$2,$3,100)",
    [alice, char, course],
  );
  await db.exec("set local role authenticated");
  await value("public.set_saved_course($1,false)", [slug]);
  await value("public.set_saved_course($1,false)", [slug]);
  expect(await query("select * from player_course_plans")).toHaveLength(0);
  expect(await query("select * from player_courses")).toHaveLength(1);
  await db.exec("reset role");
  expect(await query("select * from player_course_plans")).toHaveLength(1);
});
it("rejects invalid course, missing state, anonymous and signed-out calls", async () => {
  await expect(value("public.set_saved_course('missing',true)")).rejects.toThrow(
    "Course not found",
  );
  await expect(value("public.set_saved_course($1,null)", [slug])).rejects.toThrow("Saved state");
  await db.exec("set local role anon");
  await expect(value("public.set_saved_course($1,true)", [slug])).rejects.toThrow(
    "permission denied",
  );
  await expect(value("public.get_career_life_summary()")).rejects.toThrow("permission denied");
  await db.exec("reset role;select set_config('test.user_id','',true)");
  await expect(value("public.get_career_life_summary()")).rejects.toThrow("Sign in");
});
it("blocks direct client writes and cross-player event reads", async () => {
  await db.query("insert into character_jobs(user_id,character_id,job_id) values($1,$2,$3)", [
    bob,
    bobChar,
    job,
  ]);
  await db.exec("set local role authenticated");
  expect(await query("select * from player_career_events")).toHaveLength(0);
  await expect(
    query("insert into player_course_plans(user_id,character_id,course_id) values($1,$2,$3)", [
      bob,
      bobChar,
      course,
    ]),
  ).rejects.toThrow("permission denied");
  await expect(query("delete from player_career_events")).rejects.toThrow("permission denied");
  await expect(query("update character_jobs set career_level=3")).rejects.toThrow(
    "permission denied",
  );
});
it("records joins, departures, rehiring and promotions without duplicate work events", async () => {
  const employment = (
    await query<{ id: string }>(
      "insert into character_jobs(user_id,character_id,job_id) values($1,$2,$3) returning id",
      [alice, char, job],
    )
  )[0]!.id;
  await db.query("update character_jobs set times_performed=1 where id=$1", [employment]);
  await db.query("update character_jobs set career_level=2 where id=$1", [employment]);
  await db.query("update character_jobs set is_current=false where id=$1", [employment]);
  await db.query("update character_jobs set is_current=true where id=$1", [employment]);
  expect(
    (await query<{ event: string }>("select event from player_career_events order by id")).map(
      (row) => row.event,
    ),
  ).toEqual(["joined", "promoted", "left", "joined"]);
});
it("reports full earnings and shifts, independent of timeline page limits and other players", async () => {
  await db.query(
    "insert into character_jobs(user_id,character_id,job_id,times_performed) values($1,$2,$3,45),($4,$5,$3,99)",
    [alice, char, job, bob, bobChar],
  );
  await db.query(
    "insert into transactions(user_id,character_id,wallet_id,amount,kind,category,description) select $1,$2,w.id,100,'income','job','Shift' from wallets w,generate_series(1,45) where w.character_id=$2",
    [alice, char],
  );
  await db.query(
    "insert into transactions(user_id,character_id,wallet_id,amount,kind,category,description) select user_id,character_id,id,900,'income','gift','Gift' from wallets",
  );
  await db.exec("set local role authenticated");
  const summary = await value<{ earned: number; shifts: number; employments: unknown[] }>(
    "public.get_career_life_summary()",
  );
  expect(summary.earned).toBe(4500);
  expect(summary.shifts).toBe(45);
  expect(summary.employments).toHaveLength(1);
  const page1 = await value<{ id: string }[]>("public.get_career_life_history(0)");
  const page2 = await value<{ id: string }[]>("public.get_career_life_history(20)");
  expect(page1).toHaveLength(21);
  expect(page2).toHaveLength(21);
  expect(
    page1.slice(0, 20).some((row) => page2.slice(0, 20).some((next) => next.id === row.id)),
  ).toBe(false);
  await expect(value("public.get_career_life_history(-1)")).rejects.toThrow(
    "Invalid history offset",
  );
});
it("retains past employment and shows empty records honestly", async () => {
  expect(await value("public.get_career_life_summary()")).toEqual({
    earned: 0,
    shifts: 0,
    employments: [],
  });
  await db.query(
    "insert into character_jobs(user_id,character_id,job_id,is_current,times_performed) values($1,$2,$3,false,4)",
    [alice, char, job],
  );
  const summary = await value<{ employments: { current: boolean; shifts: number }[] }>(
    "public.get_career_life_summary()",
  );
  expect(summary.employments[0]).toMatchObject({ current: false, shifts: 4 });
  expect(await value("public.get_career_life_history(0)")).toEqual([]);
});

it("labels career payments with the workplace and rank held during that shift", async () => {
  const employment = (
    await query<{ id: string }>(
      "insert into character_jobs(user_id,character_id,job_id) values($1,$2,$3) returning id",
      [alice, char, job],
    )
  )[0]!.id;
  const payment = (
    await query<{ id: string }>(
      "insert into transactions(user_id,character_id,wallet_id,amount,kind,category,description) select $1,$2,id,3500,'income','career_shift','Career shift internal-id' from wallets where character_id=$2 returning id",
      [alice, char],
    )
  )[0]!.id;
  await db.query(
    `insert into career_shifts(user_id,character_id,character_job_id,location_id,path_slug,rank_level,step_count,status,completed_at,paid_amount,transaction_id)
    select $1,$2,$3,location_id,'banking',1,3,'completed',now(),3500,$4 from jobs where id=$5`,
    [alice, char, employment, payment, job],
  );
  const rows = await value<{ kind: string; label: string }[]>("public.get_career_life_history(0)");
  const pay = rows.find((row) => row.kind === "payment");
  expect(pay?.label).toContain("Banking Assistant");
  expect(pay?.label).toContain("Cedar Bank");
  expect(pay?.label).not.toContain("internal-id");
});

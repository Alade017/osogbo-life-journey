// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const one = "11111111-1111-4111-8111-111111111111",
  two = "22222222-2222-4222-8222-222222222222",
  clinic = "33333333-3333-4333-8333-333333333333";
async function actor(id: string) {
  await db.query("select set_config('test.uid',$1,false)", [id]);
}
async function command(cmd: string) {
  return (
    await db.query<{ visit: { status: string; id: string; queuePosition: number } }>(
      "select clinic_visit_command($1) as visit",
      [cmd],
    )
  ).rows[0]!.visit;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table characters(id uuid primary key,user_id uuid,current_location_id uuid);create table locations(id uuid primary key,slug text,is_active boolean default true);insert into auth.users values('${one}'),('${two}');insert into locations values('${clinic}','community-clinic',true);insert into characters values('${one}','${one}','${clinic}'),('${two}','${two}','${clinic}');`,
  );
  await db.exec(readFileSync("drizzle/migrations/0100_clinic_patient_flow.sql", "utf8"));
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("reserves one station and queues the next patient without duplicate check-ins", async () => {
  await actor(one);
  const first = await command("check_in");
  expect(first.status).toBe("examination");
  expect((await command("check_in")).id).toBe(first.id);
  await actor(two);
  expect(await command("check_in")).toMatchObject({ status: "waiting", queuePosition: 1 });
  expect(
    (
      await db.query<{ count: number }>(
        "select count(*)::int as count from clinic_visits where status='examination'",
      )
    ).rows[0]!.count,
  ).toBe(1);
});
it("cancels a visit and releases the station to the waiting patient", async () => {
  await actor(one);
  expect((await command("cancel")).status).toBe("cancelled");
  await actor(two);
  expect((await command("status")).status).toBe("examination");
});
it("completes only after the server deadline and retains the result on retry", async () => {
  await actor(two);
  expect((await command("status")).status).toBe("examination");
  await db.exec(
    "update clinic_visits set exam_started_at=now()-interval '21 seconds' where status='examination'",
  );
  expect((await command("status")).status).toBe("discharged");
  expect((await command("check_in")).status).toBe("discharged");
  expect((await command("new_visit")).status).toBe("examination");
});
it("rejects away-from-clinic and unauthenticated requests", async () => {
  await db.exec(`update characters set current_location_id=null where id='${two}'`);
  await expect(command("check_in")).rejects.toThrow(/Travel/);
  await actor("");
  await expect(command("status")).rejects.toThrow(/Sign in/);
});

it("limits authenticated reads to the actor and rejects direct visit writes", async () => {
  await actor(one);
  await db.exec("grant usage on schema auth to authenticated; set role authenticated");
  try {
    const rows = await db.query<{ user_id: string }>("select user_id from clinic_visits");
    expect(rows.rows.length).toBeGreaterThan(0);
    expect(rows.rows.every((row) => row.user_id === one)).toBe(true);
    await expect(
      db.exec("update clinic_visits set status='discharged' where status='waiting'"),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await db.exec("reset role");
  }
});

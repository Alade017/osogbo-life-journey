// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, it, expect } from "vitest";
let db: PGlite;
const one = "11111111-1111-4111-8111-111111111111",
  two = "22222222-2222-4222-8222-222222222222",
  clinic = "33333333-3333-4333-8333-333333333333";
type Visit = {
  status: string;
  staffAvailable: boolean;
  staff: { id: string; onDuty: boolean };
  assignedStaff: { id: string } | null;
};
async function hour(n: number) {
  await db.query("select set_config('test.hour',$1,false)", [String(n)]);
}
async function actor(id: string) {
  await db.query("select set_config('test.uid',$1,false)", [id]);
}
async function command(cmd: string) {
  return (await db.query<{ visit: Visit }>("select clinic_visit_command($1) as visit", [cmd]))
    .rows[0].visit;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;create table characters(id uuid primary key,user_id uuid,current_location_id uuid);create table locations(id uuid primary key,slug text,is_active boolean default true);create table npc_definitions(id text primary key,name text,role text,personality text,work_location_id uuid,interests text[],topics text[],routine jsonb);create function world_clock() returns jsonb language sql as $$select jsonb_build_object('hour',coalesce(nullif(current_setting('test.hour',true),'')::int,12))$$;insert into auth.users values('${one}'),('${two}');insert into locations values('${clinic}','community-clinic',true);insert into characters values('${one}','${one}','${clinic}'),('${two}','${two}','${clinic}');`,
  );
  await db.exec(readFileSync("drizzle/migrations/0100_clinic_patient_flow.sql", "utf8"));
  await actor(one);
  await command("check_in");
  // Fixture roster: the production migration derives assignments from existing NPC configuration.
  await db.query("insert into npc_definitions(id,name,role,work_location_id,routine) values($1,$2,$3,$4,$5::jsonb)", [
    "npc-clinic-sade", "Sade Akinola", "Clinic care officer", clinic,
    JSON.stringify([{ start: 8, end: 18, place: "work", activity: "helping visitors" }]),
  ]);
  await db.exec(readFileSync("drizzle/migrations/0101_clinic_staff_assignment.sql", "utf8"));
}, 60000);
afterAll(async () => {
  await db?.close();
});
it("preserves and assigns an examination already active before the staffing migration", async () => {
  await actor(one);
  await hour(7);
  expect(await command("status")).toMatchObject({
    status: "examination",
    assignedStaff: { id: "npc-clinic-sade" },
  });
  await db.exec("delete from clinic_visits");
});
it("reports off-duty roster and rejects new check-ins outside the game-time shift", async () => {
  await actor(one);
  await hour(7);
  expect(await command("status")).toMatchObject({
    status: "not_checked_in",
    staffAvailable: false,
    staff: { id: "npc-clinic-sade", onDuty: false },
  });
  await expect(command("check_in")).rejects.toThrow(/off duty/);
});
it("assigns the on-duty NPC and keeps a second visitor queued", async () => {
  await hour(8);
  expect(await command("check_in")).toMatchObject({
    status: "examination",
    staffAvailable: true,
    assignedStaff: { id: "npc-clinic-sade" },
  });
  await actor(two);
  expect((await command("check_in")).status).toBe("waiting");
});
it("lets an existing examination finish after closing without promoting a waiting patient", async () => {
  await hour(18);
  await actor(one);
  expect(await command("status")).toMatchObject({
    status: "examination",
    staffAvailable: false,
    assignedStaff: { id: "npc-clinic-sade" },
  });
  await db.exec(
    "update clinic_visits set exam_started_at=now()-interval '21 seconds' where status='examination'",
  );
  expect((await command("status")).status).toBe("discharged");
  await expect(command("new_visit")).rejects.toThrow(/off duty/);
  await actor(two);
  expect((await command("status")).status).toBe("waiting");
});
it("promotes the queue when the shift reopens and respects a disabled assignment", async () => {
  await hour(8);
  expect((await command("status")).status).toBe("examination");
  await command("cancel");
  await db.exec("update clinic_staff_assignments set enabled=false");
  await actor(one);
  expect((await command("status")).staffAvailable).toBe(false);
  await expect(command("new_visit")).rejects.toThrow(/off duty/);
});

it("does not invent a roster when no assignment is configured", async () => {
  await db.exec("delete from clinic_staff_assignments");
  await actor(one);
  expect(await command("status")).toMatchObject({ staffAvailable: false, staff: null });
  await expect(command("new_visit")).rejects.toThrow(/off duty/);
});

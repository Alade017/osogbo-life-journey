// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
let db: PGlite;
const users = [1, 2, 3].map((n) => `${n}${"1".repeat(7)}-1111-4111-8111-111111111111`);
let chars: string[], venue: string, event: string, requirement: string;
const user = (index: number) =>
  db.query("select set_config('test.user_id',$1,false)", [users[index]!]);
const clock = (time: string) =>
  db.query("update test_party_clock set stamp=$1::timestamptz", [time]);
async function read() {
  return (
    await db.query<{ value: { date: string; events: Array<{ reason: string; guests: number }> } }>(
      "select public.get_party_host_results() value",
    )
  ).rows[0]!.value;
}
async function claim(date = "2026-10-26", id = event) {
  return (
    await db.query<{ value: Record<string, unknown> }>(
      "select public.claim_party_host_reward($1::uuid,$2::date) value",
      [id, date],
    )
  ).rows[0]!.value;
}
async function respond(index: number) {
  await user(index);
  return (
    await db.query("select public.respond_to_event($1::uuid,gen_random_uuid()) value", [
      requirement,
    ])
  ).rows;
}
async function finish() {
  await respond(1);
  await respond(2);
  await user(0);
  await clock("2026-10-26T15:00:00Z");
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
    "20261019100000_party_life.sql",
    "20261019110000_party_clubs_and_activities.sql",
    "20261026162243_party_host_reputation.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(`create table test_party_clock(stamp timestamptz);insert into test_party_clock values('2026-10-26T12:00:00Z');
    create function public.test_party_now() returns timestamptz language sql volatile as $$select stamp from public.test_party_clock$$;
    update public.party_host_reward_settings set activated_at='2026-10-26T00:00:00Z';`);
  for (const signature of [
    "public.get_party_host_results()",
    "public.claim_party_host_reward(uuid,date)",
    "public.respond_to_event(uuid,uuid)",
  ]) {
    const result = await db.query<{ definition: string }>(
      "select pg_get_functiondef($1::regprocedure) definition",
      [signature],
    );
    await db.exec(
      result.rows[0]!.definition.replaceAll("clock_timestamp()", "public.test_party_now()"),
    );
  }
  for (const [index, uid] of users.entries())
    await db.exec(
      `insert into auth.users(id) values('${uid}');insert into public.profiles(id) values('${uid}');insert into public.characters(user_id,name,gender,age,personality) values('${uid}','Player ${index}','male',21,'ambitious');`,
    );
  chars = (await db.query<{ id: string }>("select id from characters order by user_id")).rows.map(
    (r) => r.id,
  );
  venue = (
    await db.query<{ location_id: string }>(
      "select location_id from party_venues where venue_kind='event_center' limit 1",
    )
  ).rows[0]!.location_id;
}, 180_000);
beforeEach(async () => {
  await db.exec(
    "reset role;delete from party_host_reward_receipts;delete from party_events;delete from party_mood;delete from economy_request_results;update auth.users set is_anonymous=false;update characters set reputation=10;",
  );
  await db.query("update characters set current_location_id=$1::uuid", [venue]);
  await user(0);
  await clock("2026-10-26T13:00:00Z");
  event = (
    await db.query<{ id: string }>(
      `insert into party_events(user_id,host_character_id,location_id,title,starts_at,ends_at,created_at) values($1,$2,$3,'Fictional gathering','2026-10-26T12:00:00Z','2026-10-26T15:00:00Z','2026-10-26T01:00:00Z') returning id`,
      [users[0], chars[0], venue],
    )
  ).rows[0]!.id;
  requirement = (
    await db.query<{ id: string }>(
      "insert into party_event_requirements(event_id,kind,item_or_role,quantity) values($1,'guest','guest',2) returning id",
      [event],
    )
  ).rows[0]!.id;
});
afterAll(async () => {
  await db?.close();
});
describe("party rewards SQL", () => {
  it("admits event-centre guests without club visits and preserves exactly one mood award", async () => {
    await respond(1);
    await expect(respond(1)).rejects.toThrow("already");
    await respond(2);
    expect(
      (
        await db.query<{ score: number }>("select score from party_mood where character_id=$1", [
          chars[0],
        ])
      ).rows[0]!.score,
    ).toBe(65);
    await user(0);
    expect((await read()).events[0]).toMatchObject({ guests: 2, reason: "not_ended" });
  });
  it("reads without rewarding, then grants once at the exact end and replays a pinned receipt", async () => {
    await finish();
    expect((await read()).events[0]!.reason).toBe("eligible");
    expect(
      (
        await db.query<{ reputation: number }>("select reputation from characters where id=$1", [
          chars[0],
        ])
      ).rows[0]!.reputation,
    ).toBe(10);
    const result = await claim();
    expect(result).toMatchObject({ reputationDelta: 1, reputationAfter: 11, newlyAwarded: true });
    expect(await claim("2026-10-27")).toEqual({ ...result, newlyAwarded: false });
  });
  it("rejects insufficient evidence, host responses, wrong venue and anonymous guests", async () => {
    await expect(respond(0)).rejects.toThrow("Hosts");
    await db.query("update characters set current_location_id=null where id=$1", [chars[1]]);
    await expect(respond(1)).rejects.toThrow("event centre");
    await db.query("update auth.users set is_anonymous=true where id=$1", [users[2]]);
    await expect(respond(2)).rejects.toThrow("REGISTERED");
    await user(0);
    await clock("2026-10-26T15:00:00Z");
    await expect(claim()).rejects.toThrow("requirements");
  });
  it("requires two distinct accounts even when one guest completes all requirements", async () => {
    await db.query("update party_event_requirements set quantity=1 where id=$1", [requirement]);
    await respond(1);
    await user(0);
    await clock("2026-10-26T15:00:00Z");
    await expect(claim()).rejects.toThrow("guests");
  });
  it("rejects stale dates, old events, cancellation, expiry and late responses", async () => {
    await finish();
    await expect(claim("2026-10-25")).rejects.toThrow("STALE_DATE");
    await db.query("update party_events set created_at='2026-10-25' where id=$1", [event]);
    await expect(claim()).rejects.toThrow("legacy");
    await db.query(
      "update party_events set created_at='2026-10-26T01:00Z',status='cancelled' where id=$1",
      [event],
    );
    await expect(claim()).rejects.toThrow("cancelled");
    await db.query("update party_events set status='scheduled' where id=$1", [event]);
    await clock("2026-11-02T15:00:01Z");
    await expect(claim("2026-11-02")).rejects.toThrow("expired");
    await expect(respond(1)).rejects.toThrow("not live");
  });
  it("caps reputation at 100 and still consumes the receipt", async () => {
    await finish();
    await db.query("update characters set reputation=100 where id=$1", [chars[0]]);
    expect(await claim()).toMatchObject({ reputationDelta: 0, reputationAfter: 100 });
    expect((await read()).events[0]!.reason).toBe("claimed");
  });
  it("isolates snapshots/receipts and blocks direct writes and private helpers", async () => {
    await finish();
    await claim();
    await user(1);
    await db.exec("set role authenticated");
    expect((await read()).events).toEqual([]);
    expect((await db.query("select * from party_host_reward_receipts")).rows).toEqual([]);
    await expect(claim()).rejects.toThrow("NOT_YOUR_EVENT");
    await expect(
      db.exec("update party_host_reward_receipts set claim_date=current_date"),
    ).rejects.toThrow("permission");
    await expect(
      db.query("select public._party_host_result($1::uuid,now())", [event]),
    ).rejects.toThrow("permission");
    await expect(db.exec("select * from party_host_reward_settings")).rejects.toThrow("permission");
  });
  it("rolls back a receipt if reputation update fails", async () => {
    await finish();
    await db.exec(
      `create function test_block_party_update() returns trigger language plpgsql as $$begin raise exception 'fixture reward failed';end$$;create trigger test_party_failure before update on characters for each row execute function test_block_party_update();`,
    );
    try {
      await expect(claim()).rejects.toThrow("fixture reward failed");
      expect((await db.query("select * from party_host_reward_receipts")).rows).toEqual([]);
    } finally {
      await db.exec(
        "drop trigger test_party_failure on characters;drop function test_block_party_update()",
      );
    }
  });
  it("enforces the account/day cap across events and releases it at Lagos midnight", async () => {
    await finish();
    await claim();
    const second = (
      await db.query<{ id: string }>(
        `insert into party_events(user_id,host_character_id,location_id,title,starts_at,ends_at,created_at) select user_id,host_character_id,location_id,'Second gathering',starts_at,ends_at,created_at from party_events where id=$1 returning id`,
        [event],
      )
    ).rows[0]!.id;
    const req = (
      await db.query<{ id: string }>(
        "insert into party_event_requirements(event_id,kind,item_or_role,quantity,fulfilled_count) values($1,'guest','guest',2,2) returning id",
        [second],
      )
    ).rows[0]!.id;
    await db.query(
      "insert into party_event_fulfilments(requirement_id,character_id,created_at) values($1,$2,'2026-10-26T13:00:00Z'),($1,$3,'2026-10-26T13:00:00Z')",
      [req, chars[1], chars[2]],
    );
    await expect(claim("2026-10-26", second)).rejects.toThrow("daily_cap");
    await clock("2026-10-26T23:00:00Z");
    await expect(claim("2026-10-26", second)).rejects.toThrow("STALE_DATE");
    expect(await claim("2026-10-27", second)).toMatchObject({
      date: "2026-10-27",
      reputationDelta: 1,
    });
  });
  it("requires a server drink purchase inside the event window", async () => {
    await db.query(
      "update party_event_requirements set kind='drink',item_or_role='zobo' where id=$1",
      [requirement],
    );
    await expect(respond(1)).rejects.toThrow("Buy");
    await db.query(
      "insert into party_drink_purchases(user_id,character_id,location_id,drink_slug,amount,created_at) values($1,$2,$3,'zobo',500,'2026-10-26T11:59:59Z')",
      [users[1], chars[1], venue],
    );
    await expect(respond(1)).rejects.toThrow("Buy");
    await db.query(
      "update party_drink_purchases set created_at='2026-10-26T12:00:00Z' where character_id=$1",
      [chars[1]],
    );
    await expect(respond(1)).resolves.toBeDefined();
  });
  it("rejects a response at the exact end, inactive venues, and early claims", async () => {
    await user(0);
    await expect(claim()).rejects.toThrow("not_ended");
    await clock("2026-10-26T15:00:00Z");
    await expect(respond(1)).rejects.toThrow("not live");
    await clock("2026-10-26T13:00:00Z");
    await db.query("update party_venues set is_active=false where location_id=$1", [venue]);
    try {
      await expect(respond(1)).rejects.toThrow("event centre");
    } finally {
      await db.query("update party_venues set is_active=true where location_id=$1", [venue]);
    }
  });
  it("keeps a receipt after host deletion and replays it without a new character", async () => {
    await finish();
    const receipt = await claim();
    await db.query("delete from characters where id=$1", [chars[0]]);
    expect(await claim()).toEqual({ ...receipt, newlyAwarded: false });
    expect((await db.query("select character_id from party_host_reward_receipts")).rows).toEqual([
      { character_id: null },
    ]);
    chars[0] = (
      await db.query<{ id: string }>(
        "insert into characters(user_id,name,gender,age,personality) values($1,'New host','male',21,'ambitious') returning id",
        [users[0]],
      )
    ).rows[0]!.id;
  });
  it("replays a response request without a duplicate contribution", async () => {
    await user(1);
    const request = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const first = await db.query("select public.respond_to_event($1,$2) value", [
      requirement,
      request,
    ]);
    expect(
      (await db.query("select public.respond_to_event($1,$2) value", [requirement, request])).rows,
    ).toEqual(first.rows);
    expect(
      (
        await db.query("select * from party_event_fulfilments where requirement_id=$1", [
          requirement,
        ])
      ).rows,
    ).toHaveLength(1);
  });
  it("rejects anonymous callers and fails closed without reward settings", async () => {
    await db.query("update auth.users set is_anonymous=true where id=$1", [users[0]]);
    await expect(read()).rejects.toThrow("REGISTERED");
    await expect(claim()).rejects.toThrow("REGISTERED");
    await db.query("update auth.users set is_anonymous=false where id=$1", [users[0]]);
    await db.exec("delete from party_host_reward_settings");
    try {
      await expect(read()).rejects.toThrow("SETTINGS_UNAVAILABLE");
    } finally {
      await db.exec(
        "insert into party_host_reward_settings(singleton,activated_at) values(true,'2026-10-26T00:00:00Z')",
      );
    }
  });
});

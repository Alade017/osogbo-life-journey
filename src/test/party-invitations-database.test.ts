// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
let db: PGlite;
const users = Array.from(
  { length: 60 },
  (_, n) => n.toString(16).padStart(8, "0") + "-1111-4111-8111-111111111111",
);
let chars: string[], venue: string, event: string, requirement: string;
const user = (index: number) =>
  db.query("select set_config('test.user_id',$1,false)", [users[index]!]);
const clock = (time: string) =>
  db.query("update test_party_clock set stamp=$1::timestamptz", [time]);
type Confirmation = {
  requestId: string;
  invitationId: string;
  eventId: string;
  status: string;
  isNew: boolean;
  duplicate: boolean;
};
type Item = {
  id: string;
  eventId: string;
  recipientName: string;
  hostName: string;
  status: string;
  phase: string;
  isGuest: boolean;
  canRespond: boolean;
};
type Page = { serverTime: string; items: Item[]; nextCursor: string | null };
async function call<T = Confirmation>(sql: string, params: unknown[] = []): Promise<T> {
  return (await db.query<{ result: T }>("select " + sql + " result", params)).rows[0]!.result;
}
const send = (target = 1, key = crypto.randomUUID(), eventId = event) =>
  call("public.party_invitation_action('send',$1,$2,$3)", [key, eventId, chars[target]]);
const decide = (invite: string, decision = "accepted", key = crypto.randomUUID()) =>
  call("public.party_invitation_action('respond',$1,null,null,$2,$3)", [key, invite, decision]);
const list = (eventId: string | null = null, after: string | null = null, limit = 20) =>
  call<Page>("public.get_party_invitations($1,$2,$3)", [eventId, after, limit]);
async function reject(work: () => Promise<unknown>, message: string) {
  await db.exec("savepoint denial");
  await expect(work()).rejects.toThrow(message);
  await db.exec("rollback to denial;release denial");
}
afterEach(async () => {
  await db.exec("rollback;reset role");
});
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
    "20261028151428_party_invitations.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(`create table test_party_clock(stamp timestamptz);insert into test_party_clock values('2026-10-26T12:00:00Z');
    create function public.test_party_now() returns timestamptz language sql volatile as $$select stamp from public.test_party_clock$$;
    update public.party_host_reward_settings set activated_at='2026-10-26T00:00:00Z';`);
  for (const signature of [
    "public.get_party_host_results()",
    "public.party_invitation_action(text,uuid,uuid,uuid,uuid,text)",
    "public.get_party_invitations(uuid,uuid,integer)",
    "public.claim_party_host_reward(uuid,date)",
    "public.respond_to_event(uuid,uuid)",
  ]) {
    const result = await db.query<{ definition: string }>(
      "select pg_get_functiondef($1::regprocedure) definition",
      [signature],
    );
    await db.exec(
      result.rows[0]!.definition.replaceAll(
        "clock_timestamp()",
        "public.test_party_now()",
      ).replaceAll("statement_timestamp()", "public.test_party_now()"),
    );
  }
  for (const [index, uid] of users.entries())
    await db.exec(
      `insert into auth.users(id) values('${uid}');insert into public.profiles(id) values('${uid}');insert into public.characters(user_id,name,gender,age,personality) values('${uid}','Player ${index}','male',21,'ambitious');`,
    );
  chars = (await db.query<{ id: string }>("select id from characters order by user_id")).rows.map(
    (r) => r.id,
  );
  await db.exec(
    "insert into wallets(user_id,character_id,balance,total_income) select user_id,id,1000,1000 from characters;",
  );
  venue = (
    await db.query<{ location_id: string }>(
      "select location_id from party_venues where venue_kind='event_center' limit 1",
    )
  ).rows[0]!.location_id;
}, 180_000);
beforeEach(async () => {
  await db.exec(
    "reset role;delete from party_invitation_receipts;delete from notifications;delete from player_blocks;delete from party_host_reward_receipts;delete from party_events;delete from party_mood;delete from economy_request_results;update auth.users set is_anonymous=false;update characters set reputation=10;",
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
  await db.exec("begin");
});
afterAll(async () => {
  await db?.close();
});

describe("party invitation SQL", () => {
  it("rolls back the response and receipt if guest insertion fails", async () => {
    const invite = await send();
    await db.exec(
      "create function test_guest_fail() returns trigger language plpgsql as $$begin raise exception 'TEST_GUEST_FAILURE';end$$;create trigger test_fail before insert on party_event_guests for each row execute function test_guest_fail();",
    );
    await user(1);
    await reject(() => decide(invite.invitationId), "TEST_GUEST_FAILURE");
    expect((await list()).items[0]).toMatchObject({ status: "pending", isGuest: false });
    expect(await call<number>("(select count(*)::int from party_invitation_receipts)")).toBe(1);
  });
  it("retains account send limits after host character recreation deletes old events", async () => {
    for (let n = 1; n <= 20; n++) await send(n);
    await db.query("delete from characters where id=$1", [chars[0]]);
    const replacement = (
      await db.query<{ id: string }>(
        "insert into characters(user_id,name,gender,age,personality) values($1,'New host','male',21,'creative') returning id",
        [users[0]],
      )
    ).rows[0]!.id;
    const next = (
      await db.query<{ id: string }>(
        "insert into party_events(user_id,host_character_id,location_id,title,starts_at,ends_at) values($1,$2,$3,'New gathering','2026-10-26T12:00:00Z','2026-10-26T15:00:00Z') returning id",
        [users[0], replacement, venue],
      )
    ).rows[0]!.id;
    await reject(() => send(21, crypto.randomUUID(), next), "INVITATION_RATE_LIMIT");
  });
  it("sends once, exposes participant-only display fields, and accepts with exactly one guest", async () => {
    const key = crypto.randomUUID(),
      first = await send(1, key);
    expect(first).toMatchObject({ status: "pending", isNew: true, duplicate: false });
    expect(await send(1, key)).toMatchObject({ invitationId: first.invitationId, duplicate: true });
    expect(await send()).toMatchObject({ invitationId: first.invitationId, isNew: false });
    expect(await call<number>("(select count(*)::int from notifications)")).toBe(1);
    const host = await list(event);
    expect(host.items).toHaveLength(1);
    expect(Object.keys(host.items[0]!).sort()).toEqual(
      [
        "canRespond",
        "endsAt",
        "eventId",
        "hostName",
        "id",
        "isGuest",
        "phase",
        "recipientCharacterId",
        "recipientName",
        "startsAt",
        "status",
        "title",
        "venue",
      ].sort(),
    );
    await user(1);
    const inbox = await list();
    expect(inbox.items[0]).toMatchObject({
      id: first.invitationId,
      status: "pending",
      canRespond: true,
    });
    const responseKey = crypto.randomUUID();
    await decide(first.invitationId, "accepted", responseKey);
    expect(await decide(first.invitationId, "accepted", responseKey)).toMatchObject({
      status: "accepted",
      duplicate: true,
    });
    await decide(first.invitationId);
    expect(await call<number>("(select count(*)::int from party_event_guests)")).toBe(1);
    expect((await list()).items[0]).toMatchObject({
      isGuest: true,
      status: "accepted",
      canRespond: false,
    });
    await user(0);
    expect((await list(event)).items[0]!.isGuest).toBe(true);
  });
  it("declines without membership and rejects opposite decisions or reinvitation transitions", async () => {
    const first = await send();
    await user(1);
    await decide(first.invitationId, "declined");
    await decide(first.invitationId, "declined");
    await reject(() => decide(first.invitationId), "INVITATION_ALREADY_RESOLVED");
    expect(await call<number>("(select count(*)::int from party_event_guests)")).toBe(0);
    await user(0);
    expect(await send()).toMatchObject({ status: "declined", isNew: false });
    expect(await call<number>("(select count(*)::int from notifications)")).toBe(1);
  });
  it("denies unauthorized send/read/respond, self and unknown targets", async () => {
    const first = await send();
    await user(2);
    await reject(() => send(), "INVITATION_UNAVAILABLE");
    await reject(() => list(event), "INVITATION_UNAVAILABLE");
    expect((await list()).items).toEqual([]);
    await reject(() => decide(first.invitationId), "INVITATION_UNAVAILABLE");
    await user(0);
    await reject(() => decide(first.invitationId), "INVITATION_UNAVAILABLE");
    await reject(() => send(0), "INVALID_RECIPIENT");
    await reject(
      () =>
        call("public.party_invitation_action('send',gen_random_uuid(),$1,gen_random_uuid())", [
          event,
        ]),
      "INVALID_RECIPIENT",
    );
  });
  it("denies anonymous, signed-out and missing-character callers/recipients", async () => {
    await db.query("update auth.users set is_anonymous=true where id=$1", [users[1]]);
    await reject(() => send(), "INVITATION_UNAVAILABLE");
    await db.query("update auth.users set is_anonymous=true where id=$1", [users[0]]);
    await reject(() => send(), "REGISTERED_ACCOUNT_REQUIRED");
    await db.query("select set_config('test.user_id','',false)");
    await reject(() => list(), "REGISTERED_ACCOUNT_REQUIRED");
    await user(2);
    await db.query("delete from characters where id=$1", [chars[2]]);
    await reject(() => list(), "CHARACTER_REQUIRED");
  });
  it.each([false, true])(
    "denies either block direction before send and after an invitation exists (%s)",
    async (reverse) => {
      const invite = await send();
      await db.query(
        "insert into player_blocks(blocker_character_id,blocked_character_id) values($1,$2)",
        reverse ? [chars[1], chars[0]] : [chars[0], chars[1]],
      );
      await reject(() => send(), "PLAYER_BLOCKED");
      await user(1);
      expect((await list()).items[0]!.canRespond).toBe(false);
      await reject(() => decide(invite.invitationId), "PLAYER_BLOCKED");
    },
  );
  it.each(["cancelled", "ended"])(
    "rejects %s events without membership and derives display state",
    async (phase) => {
      const first = await send();
      if (phase === "cancelled")
        await db.query("update party_events set status='cancelled' where id=$1", [event]);
      else await clock("2026-10-26T15:00:00Z");
      await reject(() => send(2), "EVENT_NOT_ACCEPTING_INVITATIONS");
      await user(1);
      expect((await list()).items[0]).toMatchObject({ phase, canRespond: false });
      await reject(() => decide(first.invitationId), "EVENT_NOT_ACCEPTING_INVITATIONS");
      expect(await call<number>("(select count(*)::int from party_event_guests)")).toBe(0);
    },
  );
  it("allows scheduled and live acceptance without requiring travel or counting attendance", async () => {
    await db.query("update party_events set starts_at='2026-10-26T14:00:00Z' where id=$1", [event]);
    const first = await send();
    await user(1);
    await decide(first.invitationId);
    expect((await list()).items[0]).toMatchObject({ phase: "scheduled", isGuest: true });
    expect(await call<number>("(select count(*)::int from party_event_fulfilments)")).toBe(0);
    expect(
      await call<number>("(select fulfilled_count from party_event_requirements where id=$1)", [
        requirement,
      ]),
    ).toBe(0);
    await user(0);
    expect(await call("public.get_party_host_results()")).toHaveProperty("events");
  });
  it("enforces account rate and event caps while exempting duplicate sends", async () => {
    const original = await send(1);
    for (let i = 2; i <= 20; i++) await send(i);
    await reject(() => send(21), "INVITATION_RATE_LIMIT");
    expect((await send(1)).invitationId).toBe(original.invitationId);
    await clock("2026-10-26T13:01:00Z");
    for (let i = 21; i <= 40; i++) await send(i);
    await clock("2026-10-26T13:02:00Z");
    for (let i = 41; i <= 50; i++) await send(i);
    await reject(() => send(51), "EVENT_INVITATION_LIMIT");
    const page1 = await list(event),
      page2 = await list(event, page1.nextCursor),
      page3 = await list(event, page2.nextCursor);
    expect([page1.items.length, page2.items.length, page3.items.length]).toEqual([20, 20, 10]);
    expect(page3.nextCursor).toBeNull();
    expect(new Set([...page1.items, ...page2.items, ...page3.items].map((i) => i.id)).size).toBe(
      50,
    );
    await reject(() => list(event, null, 51), "INVALID_PAGE_LIMIT");
  });
  it("binds UUID receipts to exact payloads and rolls back a failed notification", async () => {
    const key = crypto.randomUUID();
    await send(1, key);
    await reject(() => send(2, key), "REQUEST_ID_REUSED");
    await db.exec(
      "create function test_notification_fail() returns trigger language plpgsql as $$begin raise exception 'TEST_NOTIFICATION_FAILURE';end$$;create trigger test_fail before insert on notifications for each row execute function test_notification_fail();",
    );
    await reject(() => send(2), "TEST_NOTIFICATION_FAILURE");
    expect(await call<number>("(select count(*)::int from party_invitations)")).toBe(1);
    expect(await call<number>("(select count(*)::int from party_invitation_receipts)")).toBe(1);
  });
  it("keeps guest membership unique across recipient character recreation and never transfers hosting", async () => {
    const invite = await send();
    await user(1);
    await decide(invite.invitationId);
    await db.query("delete from characters where id=$1", [chars[1]]);
    await db.query(
      "insert into characters(user_id,name,gender,age,personality) values($1,'Recreated','female',21,'creative')",
      [users[1]],
    );
    await decide(invite.invitationId);
    expect(await call<number>("(select count(*)::int from party_event_guests)")).toBe(1);
    await user(0);
    const key = crypto.randomUUID();
    const sent = await send(2, key);
    await db.query("delete from characters where id=$1", [chars[0]]);
    expect(await call<number>("(select count(*)::int from party_invitations)")).toBe(0);
    expect(await call<number>("(select count(*)::int from party_event_guests)")).toBe(0);
    expect(await send(2, key)).toMatchObject({ invitationId: sent.invitationId, duplicate: true });
    await reject(() => send(2), "INVITATION_UNAVAILABLE");
  });
  it("does not change economy, mood, requirements or host reward eligibility on reads or responses", async () => {
    const snapshot = () =>
      call(
        "jsonb_build_object('characters',(select jsonb_agg(to_jsonb(c) order by id) from characters c),'wallets',(select jsonb_agg(to_jsonb(w) order by id) from wallets w),'mood',(select jsonb_agg(m) from party_mood m),'requirements',(select jsonb_agg(r) from party_event_requirements r),'fulfilments',(select count(*) from party_event_fulfilments),'rewards',(select count(*) from party_host_reward_receipts),'transactions',(select count(*) from transactions))",
      );
    const before = await snapshot();
    const invite = await send();
    await list(event);
    await user(1);
    await list();
    await decide(invite.invitationId);
    expect(await snapshot()).toEqual(before);
    await user(0);
    expect(
      (await call<{ events: { guests: number }[] }>("public.get_party_host_results()")).events[0]!
        .guests,
    ).toBe(0);
  });
  it("denies raw browser reads/writes and grants no anonymous execution", async () => {
    await send();
    await db.exec("set role authenticated");
    for (const table of ["party_invitations", "party_event_guests", "party_invitation_receipts"]) {
      await reject(() => db.query("select * from " + table), "permission denied");
      await reject(() => db.query("delete from " + table), "permission denied");
      const column = table === "party_event_guests" ? "accepted_at" : "created_at";
      await reject(() => db.query(`update ${table} set ${column}=${column}`), "permission denied");
    }
    await reject(
      () =>
        db.query(
          "insert into party_invitations(event_id,host_user_id,recipient_user_id,created_at) values($1,$2,$3,now())",
          [event, users[0], users[2]],
        ),
      "permission denied",
    );
    await reject(
      () =>
        db.query(
          "insert into party_event_guests(event_id,guest_user_id,accepted_at) values($1,$2,now())",
          [event, users[1]],
        ),
      "permission denied",
    );
    await reject(
      () =>
        db.query(
          "insert into party_invitation_receipts(user_id,request_id,payload,result,created_invitation,created_at) values($1,gen_random_uuid(),'{}','{}',false,now())",
          [users[0]],
        ),
      "permission denied",
    );
    await db.exec("reset role;set role anon");
    await reject(() => list(), "permission denied");
    await reject(() => send(), "permission denied");
  });
  it("enforces participant RLS even if SELECT is mistakenly granted later", async () => {
    const invitation = await send();
    await user(1);
    await decide(invitation.invitationId);
    await db.exec(
      "grant select on party_invitations,party_event_guests,party_invitation_receipts to authenticated;set role authenticated",
    );
    expect((await db.query("select * from party_invitations")).rows).toHaveLength(1);
    expect((await db.query("select * from party_event_guests")).rows).toHaveLength(1);
    await user(2);
    expect((await db.query("select * from party_invitations")).rows).toHaveLength(0);
    expect((await db.query("select * from party_event_guests")).rows).toHaveLength(0);
    expect((await db.query("select * from party_invitation_receipts")).rows).toHaveLength(0);
  });
});

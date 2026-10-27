// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
let db: PGlite;
const users = Array.from({ length: 6 }, (_, n) => `${n + 1}1111111-1111-4111-8111-111111111111`);
const me = users[0]!;
const outsider = users[5]!;
const threads: string[] = [];
let character: string;
async function value<T = Record<string, unknown>>(expression: string, params: unknown[] = []) {
  return (await db.query<{ result: T }>(`select ${expression} result`, params)).rows[0]!.result;
}
const send = (
  user = me,
  thread = threads[0],
  reply: string | null = null,
  request = crypto.randomUUID(),
) =>
  value<{ id: string; duplicate: boolean; created_at: string }>(
    "public.send_social_message_as_user($1,'private','Hello',$2,null,$3,$4)",
    [user, request, thread, reply],
  );
const pref = (thread: string, command: string, duration: string | null = null, user = me) =>
  value("public.thread_pref_action_as_user($1,$2,$3,$4)", [user, thread, command, duration]);
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
    .filter((f) => f.endsWith(".sql") && !f.startsWith("0075_"))
    .sort())
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/20261017155516_social_messaging_delivery.sql", "utf8"),
  );
  await db.exec(readFileSync("supabase/migrations/20261027113217_messaging_hardening.sql", "utf8"));
  await db.exec(`create table test_message_clock(stamp timestamptz);insert into test_message_clock values('2026-10-27T12:00:00Z');
    create function public.test_message_now() returns timestamptz language sql volatile as $$select stamp from public.test_message_clock$$;`);
  // Test-only trusted clock substitution; production has no caller-controlled time parameter.
  const definition = await value<string>(
    "pg_get_functiondef('public.send_social_message_as_user(uuid,text,text,uuid,uuid,uuid,uuid)'::regprocedure)",
  );
  await db.exec(definition.replaceAll("clock_timestamp()", "public.test_message_now()"));
  for (const [index, user] of users.entries()) {
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query("insert into profiles(id) values($1)", [user]);
    await db.query(
      "insert into characters(user_id,name,gender,age,personality) values($1,$2,'female',21,'creative')",
      [user, `Player ${index}`],
    );
  }
  character = await value<string>("(select id from characters where user_id=$1)", [me]);
  for (const user of users.slice(1, 5)) {
    const other = await value<string>("(select id from characters where user_id=$1)", [user]);
    await db.query(
      "insert into player_friendships(first_character_id,second_character_id) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid))",
      [character, other],
    );
    const thread = await db.query<{ id: string }>(
      "insert into social_conversations(first_character_id,second_character_id) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid)) returning id",
      [character, other],
    );
    threads.push(thread.rows[0]!.id);
  }
}, 180_000);
beforeEach(async () => {
  await db.exec(`reset role;select set_config('test.user_id','${me}',false);
    delete from social_messages;delete from thread_prefs;
    update test_message_clock set stamp='2026-10-27T12:00:00Z';`);
});
afterAll(async () => {
  await db?.close();
});
describe("existing messaging delivery with hardening", () => {
  it("persists and reads text and same-thread quoted replies for participants", async () => {
    const first = await send();
    await send(users[1], threads[0], first.id);
    const history = await value<Array<Record<string, unknown>>>(
      "public.get_social_messages(null,$1,null,50)",
      [threads[0]],
    );
    expect(history).toHaveLength(2);
    expect(history.find((row) => row["reply_to_message_id"] === first.id)).toMatchObject({
      reply_body: "Hello",
      reply_sender_name: "Player 0",
    });
    const list = await value<Array<{ id: string }>>(
      "public.get_social_thread_summaries_as_user($1)",
      [me],
    );
    expect(list.some((row) => row["id"] === threads[0])).toBe(true);
  });
  it("rejects foreign-thread quoted replies and preserves message count", async () => {
    const first = await send();
    await expect(send(me, threads[1], first.id)).rejects.toThrow("UNKNOWN_REPLY");
    expect(await value("(select count(*)::int from social_messages)")).toBe(1);
  });
  it("denies outsider history, sending, discovery, and preferences", async () => {
    await send();
    await db.query("select set_config('test.user_id',$1,false)", [outsider]);
    await expect(
      value("public.get_social_messages(null,$1,null,50)", [threads[0]]),
    ).rejects.toThrow("Conversation not found");
    await expect(send(outsider)).rejects.toThrow("UNKNOWN_THREAD");
    await expect(pref(threads[0]!, "pin", null, outsider)).rejects.toThrow("UNKNOWN_THREAD");
    expect(await value("public.get_social_thread_summaries_as_user($1)", [outsider])).toEqual([]);
    // Grants are supplied explicitly in this harness so these reads exercise RLS.
    await db.exec(
      "grant select on social_messages,social_conversations,thread_prefs to authenticated;set role authenticated;",
    );
    expect(await value("(select count(*)::int from social_messages)")).toBe(0);
    expect(await value("(select count(*)::int from social_conversations)")).toBe(0);
    expect(await value("(select count(*)::int from thread_prefs)")).toBe(0);
  });
  it("denies browser direct writes and privileged RPC execution", async () => {
    await db.exec("set role authenticated");
    await expect(send()).rejects.toThrow("permission denied");
    await expect(pref(threads[0]!, "pin")).rejects.toThrow("permission denied");
    await expect(
      db.query(
        "insert into social_messages(sender_character_id,channel,conversation_id,body) values($1,'private',$2,'bypass')",
        [character, threads[0]],
      ),
    ).rejects.toThrow();
    await expect(
      db.query("insert into thread_prefs(account_id,thread_id) values($1,$2)", [me, threads[0]]),
    ).rejects.toThrow();
    await db.exec("reset role;set role anon");
    await expect(send()).rejects.toThrow("permission denied");
  });
  it("allows five sends per ten seconds, replays without consuming quota, then expires the window", async () => {
    const request = crypto.randomUUID();
    const first = await send(me, threads[0], null, request);
    for (let i = 0; i < 4; i++) await send();
    await expect(send()).rejects.toThrow("MESSAGE_RATE_LIMIT");
    expect(await send(me, threads[0], null, request)).toMatchObject({
      id: first.id,
      duplicate: true,
    });
    await db.exec("update test_message_clock set stamp=stamp+interval '10 seconds'");
    expect((await send()).duplicate).toBe(false);
    expect(await value("(select count(*)::int from social_messages)")).toBe(6);
  });
  it("retains the twelve-per-minute limit across burst windows", async () => {
    for (const count of [5, 5, 2]) {
      for (let i = 0; i < count; i++) await send();
      await db.exec("update test_message_clock set stamp=stamp+interval '10 seconds'");
    }
    await expect(send()).rejects.toThrow("MESSAGE_RATE_LIMIT");
    await db.exec("update test_message_clock set stamp='2026-10-27T12:01:00Z'");
    expect((await send()).duplicate).toBe(false);
  });
  it("enforces the pin cap and releases a slot after unpinning", async () => {
    for (const thread of threads.slice(0, 3)) await pref(thread, "pin");
    await expect(pref(threads[3]!, "pin")).rejects.toThrow("PIN_LIMIT_REACHED");
    await pref(threads[0]!, "unpin");
    await expect(pref(threads[3]!, "pin")).resolves.toHaveProperty("pinnedAt");
  });
  it.each(["8h", "1w", "always"])(
    "keeps %s mute owned by the requesting participant",
    async (duration) => {
      const result = await pref(threads[0]!, "mute", duration);
      expect(result["mutedUntil"]).toBeTruthy();
      expect(
        await value("(select count(*)::int from thread_prefs where account_id=$1)", [users[1]]),
      ).toBe(0);
      await pref(threads[0]!, "unmute");
      expect(
        await value("(select muted_until from thread_prefs where account_id=$1 and thread_id=$2)", [
          me,
          threads[0],
        ]),
      ).toBeNull();
    },
  );
});

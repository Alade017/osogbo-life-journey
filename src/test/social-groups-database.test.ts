// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ownerUserId = "a1111111-1111-4111-8111-111111111111";
const ownerCharacterId = "a2222222-2222-4222-8222-222222222222";
const friendUserId = "a3333333-3333-4333-8333-333333333333";
const friendCharacterId = "a4444444-4444-4444-8444-444444444444";
const otherFriendUserId = "a5555555-5555-4555-8555-555555555555";
const otherFriendCharacterId = "a6666666-6666-4666-8666-666666666666";
const strangerUserId = "a7777777-7777-4777-8777-777777777777";
const strangerCharacterId = "a8888888-8888-4888-8888-888888888888";
let db: PGlite;

type Outcome = { ok: true; result: unknown } | { ok: false; message: string };

async function asUser(userId: string, sql: string, params: unknown[] = []): Promise<Outcome> {
  await db.query("select set_config('test.user_id',$1,false)", [userId]);
  try {
    const { rows } = await db.query<{ result: unknown }>(sql, params);
    return { ok: true, result: rows[0]?.result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}

async function befriend(a: string, b: string) {
  const [first, second] = a < b ? [a, b] : [b, a];
  await db.query(
    "insert into public.player_friendships(first_character_id,second_character_id) values($1,$2)",
    [first, second],
  );
}

async function groupIdFor(name: string) {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.social_groups where name=$1",
    [name],
  );
  return rows[0]!.id;
}

describe("social group chat database", () => {
  beforeAll(async () => {
    db = new PGlite({ extensions: { pg_trgm } });
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema auth; create schema extensions; create schema realtime;
      create table auth.users(id uuid primary key, is_anonymous boolean not null default false); create table realtime.messages(id bigint generated always as identity);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
      create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
      create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
    const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
    for (const { tag } of journal.entries.filter(
      (entry: { tag: string }) =>
        ![
          "0075_remove_orphaned_player_data",
          "0077_market_stall_rent_categories_sales",
          "0079_free_house_placement",
        ].includes(entry.tag),
    ))
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8").replace(/^﻿/, ""));
    await db.exec(
      readFileSync(
        "supabase/migrations/20261102223137_freeform_house_furniture_placement.sql",
        "utf8",
      ),
    );
    await db.exec(readFileSync("drizzle/migrations/0079_free_house_placement.sql", "utf8"));
    await db.exec("drop function if exists public.house_place_free(uuid, text, numeric, numeric);");
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role;
      delete from public.social_group_messages; delete from public.social_group_members;
      delete from public.social_groups; delete from public.player_blocks;
      delete from public.player_friendships; delete from public.wallets;
      delete from public.characters; delete from public.profiles; delete from auth.users;`);
    await db.exec(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('group-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;",
    );
    for (const [userId, characterId, name] of [
      [ownerUserId, ownerCharacterId, "Owner"],
      [friendUserId, friendCharacterId, "Friend"],
      [otherFriendUserId, otherFriendCharacterId, "Other"],
      [strangerUserId, strangerCharacterId, "Stranger"],
    ] as const) {
      await db.query("insert into auth.users(id) values($1)", [userId]);
      await db.query("insert into public.profiles(id,display_name) values($1,$2)", [userId, name]);
      await db.query(
        "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,$2,$3,'female',22,'ambitious','group-job','housing')",
        [characterId, userId, name],
      );
    }
    await befriend(ownerCharacterId, friendCharacterId);
    await befriend(ownerCharacterId, otherFriendCharacterId);
  });

  it("lets a player create a group with friends and refuses a stranger", async () => {
    const stranger = await asUser(
      ownerUserId,
      "select public.create_social_group($1,$2::uuid[]) as result",
      ["Stranger group", [strangerCharacterId]],
    );
    expect(stranger).toMatchObject({ ok: false, message: expect.stringContaining("GROUP_MEMBER_UNAVAILABLE") });

    const created = await asUser(
      ownerUserId,
      "select public.create_social_group($1,$2::uuid[]) as result",
      ["Market crew", [friendCharacterId, otherFriendCharacterId]],
    );
    expect(created.ok).toBe(true);
    const overview = await asUser(
      ownerUserId,
      "select public.get_social_groups_overview() as result",
    );
    expect(overview).toMatchObject({
      ok: true,
      result: [{ name: "Market crew", member_count: 3 }],
    });
  });

  it("needs at least one friend besides the creator and a clean name", async () => {
    expect(
      await asUser(ownerUserId, "select public.create_social_group($1,'{}'::uuid[]) as result", [
        "Alone",
      ]),
    ).toMatchObject({ ok: false, message: expect.stringContaining("GROUP_NEEDS_MEMBERS") });
    expect(
      await asUser(ownerUserId, "select public.create_social_group($1,$2::uuid[]) as result", [
        "   ",
        [friendCharacterId],
      ]),
    ).toMatchObject({ ok: false, message: expect.stringContaining("GROUP_NAME_INVALID") });
  });

  it("refuses to add a friend who is blocked by a member", async () => {
    await db.query(
      "insert into public.player_blocks(blocker_character_id,blocked_character_id) values($1,$2)",
      [friendCharacterId, otherFriendCharacterId],
    );
    expect(
      await asUser(ownerUserId, "select public.create_social_group($1,$2::uuid[]) as result", [
        "Blocked mix",
        [friendCharacterId, otherFriendCharacterId],
      ]),
    ).toMatchObject({ ok: false, message: expect.stringContaining("GROUP_MEMBER_UNAVAILABLE") });
  });

  it("sends messages only for members and is idempotent per request", async () => {
    await asUser(ownerUserId, "select public.create_social_group($1,$2::uuid[]) as result", [
      "Chat",
      [friendCharacterId],
    ]);
    const groupId = await groupIdFor("Chat");
    const requestId = "b1111111-1111-4111-8111-111111111111";

    const first = await asUser(
      friendUserId,
      "select public.send_social_group_message($1,$2,$3) as result",
      [groupId, "Hello group", requestId],
    );
    expect(first).toMatchObject({ ok: true, result: { body: "Hello group", duplicate: false } });
    const again = await asUser(
      friendUserId,
      "select public.send_social_group_message($1,$2,$3) as result",
      [groupId, "Hello group", requestId],
    );
    expect(again).toMatchObject({ ok: true, result: { duplicate: true } });

    const stranger = await asUser(
      strangerUserId,
      "select public.send_social_group_message($1,$2,$3) as result",
      [groupId, "Let me in", "b2222222-2222-4222-8222-222222222222"],
    );
    expect(stranger).toMatchObject({ ok: false, message: expect.stringContaining("NOT_IN_GROUP") });

    const history = await asUser(
      ownerUserId,
      "select public.get_social_group_messages($1,50) as result",
      [groupId],
    );
    expect(history).toMatchObject({
      ok: true,
      result: [{ body: "Hello group", sender_name: "Friend" }],
    });
    const strangerHistory = await asUser(
      strangerUserId,
      "select public.get_social_group_messages($1,50) as result",
      [groupId],
    );
    expect(strangerHistory).toMatchObject({ ok: false, message: expect.stringContaining("NOT_IN_GROUP") });
  });

  it("removes the group when the last member leaves, and keeps it while others remain", async () => {
    await asUser(ownerUserId, "select public.create_social_group($1,$2::uuid[]) as result", [
      "Leaving",
      [friendCharacterId],
    ]);
    const groupId = await groupIdFor("Leaving");

    expect(
      await asUser(friendUserId, "select public.leave_social_group($1) as result", [groupId]),
    ).toMatchObject({ ok: true });
    const { rows: stillThere } = await db.query<{ n: number }>(
      "select count(*)::integer as n from public.social_groups where id=$1",
      [groupId],
    );
    expect(stillThere[0]!.n).toBe(1);

    await asUser(ownerUserId, "select public.leave_social_group($1) as result", [groupId]);
    const { rows: gone } = await db.query<{ n: number }>(
      "select count(*)::integer as n from public.social_groups where id=$1",
      [groupId],
    );
    expect(gone[0]!.n).toBe(0);
  });

  it("does not let clients read the group tables directly", async () => {
    await db.exec("set role authenticated");
    try {
      await expect(
        db.query("select count(*) from public.social_group_messages"),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec("reset role");
    }
  });
});

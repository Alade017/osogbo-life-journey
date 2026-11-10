// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ownerUserId = "c1111111-1111-4111-8111-111111111111";
const ownerCharacterId = "c2222222-2222-4222-8222-222222222222";
const friendUserId = "c3333333-3333-4333-8333-333333333333";
const friendCharacterId = "c4444444-4444-4444-8444-444444444444";
const strangerUserId = "c5555555-5555-4555-8555-555555555555";
const strangerCharacterId = "c6666666-6666-4666-8666-666666666666";
const requestA = "d1111111-1111-4111-8111-111111111111";
const requestB = "d2222222-2222-4222-8222-222222222222";
const requestC = "d3333333-3333-4333-8333-333333333333";
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

async function createGroup(name: string) {
  const outcome = await asUser(
    ownerUserId,
    "select public.create_social_group($1,$2::uuid[]) as result",
    [name, [friendCharacterId]],
  );
  if (!outcome.ok) throw new Error(outcome.message);
  const { rows } = await db.query<{ id: string }>(
    "select id from public.social_groups where name=$1",
    [name],
  );
  return rows[0]!.id;
}

function sendMedia(
  groupId: string,
  kind: string,
  path: string,
  durationMs: number | null,
  requestId: string,
  userId = friendUserId,
) {
  return db
    .query<{ result: { id: string; kind: string; duplicate: boolean } }>(
      "select public.send_social_group_media_as_user($1,$2,$3,$4,$5,$6) as result",
      [userId, groupId, kind, path, durationMs, requestId],
    )
    .then(
      (r) => ({ ok: true as const, result: r.rows[0]!.result }),
      (error: unknown) => ({
        ok: false as const,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
}

describe("social group media, reactions and preferences database", () => {
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
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8").replace(/^\uFEFF/, ""));
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
      delete from public.social_group_reactions; delete from public.social_group_prefs;
      delete from public.social_group_messages; delete from public.social_group_members;
      delete from public.social_groups; delete from public.player_blocks;
      delete from public.player_friendships; delete from public.wallets;
      delete from public.characters; delete from public.profiles; delete from auth.users;`);
    await db.exec(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('media-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;",
    );
    for (const [userId, characterId, name] of [
      [ownerUserId, ownerCharacterId, "Owner"],
      [friendUserId, friendCharacterId, "Friend"],
      [strangerUserId, strangerCharacterId, "Stranger"],
    ] as const) {
      await db.query("insert into auth.users(id) values($1)", [userId]);
      await db.query("insert into public.profiles(id,display_name) values($1,$2)", [userId, name]);
      await db.query(
        "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,$2,$3,'female',22,'ambitious','media-job','housing')",
        [characterId, userId, name],
      );
    }
    await befriend(ownerCharacterId, friendCharacterId);
  });

  it("records voice notes and pictures only for members, with a valid path and duration", async () => {
    const groupId = await createGroup("Voice crew");
    const voicePath = `group/${groupId}/${requestA}.ogg`;

    expect(await sendMedia(groupId, "voice", voicePath, 4000, requestA)).toMatchObject({
      ok: true,
      result: { kind: "voice", duplicate: false },
    });
    expect(await sendMedia(groupId, "voice", voicePath, 4000, requestA)).toMatchObject({
      ok: true,
      result: { duplicate: true },
    });
    expect(
      await sendMedia(groupId, "voice", `group/${groupId}/${requestB}.ogg`, 500, requestB),
    ).toMatchObject({ ok: false, message: expect.stringContaining("VOICE_DURATION_INVALID") });
    expect(
      await sendMedia(groupId, "image", `group/${groupId}/${requestB}.gif`, null, requestB),
    ).toMatchObject({ ok: false, message: expect.stringContaining("MEDIA_PATH_INVALID") });
    expect(
      await sendMedia(groupId, "image", `group/${groupId}/${requestC}.png`, null, requestB),
    ).toMatchObject({ ok: false, message: expect.stringContaining("MEDIA_PATH_INVALID") });
    expect(
      await sendMedia(
        groupId,
        "image",
        `group/${groupId}/${requestC}.png`,
        null,
        requestC,
        strangerUserId,
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining("NOT_IN_GROUP") });
  });

  it("returns the storage path only to members and never through the client message list", async () => {
    const groupId = await createGroup("Pictures");
    const path = `group/${groupId}/${requestA}.jpg`;
    const sent = await sendMedia(groupId, "image", path, null, requestA);
    expect(sent.ok).toBe(true);
    const messageId = (sent as { result: { id: string } }).result.id;

    const memberLookup = await db.query<{ result: { path: string; kind: string } }>(
      "select public.get_social_group_media_as_user($1,$2) as result",
      [friendUserId, messageId],
    );
    expect(memberLookup.rows[0]!.result).toEqual({ kind: "image", path });

    await expect(
      db.query("select public.get_social_group_media_as_user($1,$2)", [strangerUserId, messageId]),
    ).rejects.toThrow(/NOT_IN_GROUP/);

    const history = await asUser(
      friendUserId,
      "select public.get_social_group_messages($1,50) as result",
      [groupId],
    );
    expect(JSON.stringify(history)).not.toContain(path);
    expect(history).toMatchObject({ ok: true, result: [{ kind: "image" }] });
  });

  it("keeps one reaction per member, switching or removing it on repeat", async () => {
    const groupId = await createGroup("Reactions");
    const text = await asUser(
      ownerUserId,
      "select public.send_social_group_message($1,$2,$3) as result",
      [groupId, "Hello", requestA],
    );
    const messageId = (text as { result: { id: string } }).result.id;

    expect(
      await asUser(friendUserId, "select public.toggle_social_group_reaction($1,$2) as result", [
        messageId,
        "😂",
      ]),
    ).toMatchObject({ ok: true, result: { emoji: "😂" } });
    expect(
      await asUser(friendUserId, "select public.toggle_social_group_reaction($1,$2) as result", [
        messageId,
        "🙏",
      ]),
    ).toMatchObject({ ok: true, result: { emoji: "🙏" } });
    const summary = await asUser(
      ownerUserId,
      "select public.get_social_group_messages($1,50) as result",
      [groupId],
    );
    expect(summary).toMatchObject({
      ok: true,
      result: [{ reactions: [{ emoji: "🙏", count: 1, mine: false }] }],
    });
    expect(
      await asUser(friendUserId, "select public.toggle_social_group_reaction($1,$2) as result", [
        messageId,
        "🙏",
      ]),
    ).toMatchObject({ ok: true, result: { emoji: null } });
  });

  it("refuses reactions outside the set and from non-members", async () => {
    const groupId = await createGroup("Strict");
    const text = await asUser(
      ownerUserId,
      "select public.send_social_group_message($1,$2,$3) as result",
      [groupId, "Hi", requestA],
    );
    const messageId = (text as { result: { id: string } }).result.id;
    expect(
      await asUser(friendUserId, "select public.toggle_social_group_reaction($1,$2) as result", [
        messageId,
        "🔥",
      ]),
    ).toMatchObject({ ok: false, message: expect.stringContaining("REACTION_INVALID") });
    expect(
      await asUser(strangerUserId, "select public.toggle_social_group_reaction($1,$2) as result", [
        messageId,
        "👍",
      ]),
    ).toMatchObject({ ok: false, message: expect.stringContaining("NOT_IN_GROUP") });
  });

  it("sorts pinned groups first and muted groups last, with my state per member", async () => {
    const plain = await createGroup("Plain");
    const pinned = await createGroup("Pinned");
    const muted = await createGroup("Muted");
    expect(
      await asUser(ownerUserId, "select public.set_social_group_prefs($1,true,false) as result", [
        pinned,
      ]),
    ).toMatchObject({ ok: true, result: { pinned: true, muted: false } });
    expect(
      await asUser(ownerUserId, "select public.set_social_group_prefs($1,false,true) as result", [
        muted,
      ]),
    ).toMatchObject({ ok: true, result: { muted: true } });

    const overview = await asUser(
      ownerUserId,
      "select public.get_social_groups_overview() as result",
    );
    expect(overview.ok).toBe(true);
    const rows = (overview as { result: { id: string; muted: boolean }[] }).result;
    expect(rows.map((row) => row.id)).toEqual([pinned, plain, muted]);
    expect(rows.find((row) => row.id === muted)?.muted).toBe(true);

    // The friend's own view is unaffected by my pin or mute.
    const friendOverview = await asUser(
      friendUserId,
      "select public.get_social_groups_overview() as result",
    );
    expect(
      (friendOverview as { result: { pinned_at: unknown }[] }).result.every(
        (row) => row.pinned_at === null,
      ),
    ).toBe(true);
  });

  it("does not let signed-in players call the service-only media functions", async () => {
    const { rows } = await db.query<{ authenticated: boolean; service: boolean }>(
      `select has_function_privilege('authenticated',
          'public.send_social_group_media_as_user(uuid,uuid,text,text,integer,uuid)','execute') as authenticated,
        has_function_privilege('service_role',
          'public.send_social_group_media_as_user(uuid,uuid,text,text,integer,uuid)','execute') as service`,
    );
    expect(rows[0]).toEqual({ authenticated: false, service: true });
  });
});

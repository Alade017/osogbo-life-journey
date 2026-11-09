// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, afterEach, expect, it } from "vitest";
const users = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
  "33333333-3333-4333-8333-333333333333",
];
const key = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let db: PGlite;
let chars: string[];
let thread: string;
async function run<T>(sql: string, args: unknown[] = []) {
  await db.exec("savepoint media_test_call");
  try {
    const result = await db.query<T>(sql, args);
    await db.exec("release savepoint media_test_call");
    return result;
  } catch (error) {
    await db.exec("rollback to savepoint media_test_call;release savepoint media_test_call");
    throw error;
  }
}
type MediaResult = Record<string, unknown> & {
  storage_path?: string;
  messageId?: string;
  duplicate?: boolean;
  filename?: string;
  coverPath?: string | null;
  status?: unknown;
};
const value = async <T = MediaResult>(sql: string, args: unknown[] = []): Promise<T> =>
  (await run<{ result: T }>(`select ${sql} as result`, args)).rows[0]!.result;
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth; create schema extensions;create schema realtime;create schema storage;
    create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated;
    grant all on storage.objects to anon,authenticated;
    create policy broad_existing_policy on storage.objects for all to authenticated using(true) with check(true);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return;end $$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for (const file of readdirSync("drizzle/migrations")
    .filter(
      (name) =>
        name.endsWith(".sql") &&
        !name.startsWith("0075_") &&
        !name.startsWith("0077_") &&
        !name.startsWith("0079_"),
    )
    .sort()) {
    if (file === "0083_studio_room_layout.sql") {
      // The studio layout migration depends on x/y columns from this Supabase migration.
      await db.exec(
        readFileSync(
          "supabase/migrations/20261102223137_freeform_house_furniture_placement.sql",
          "utf8",
        ),
      );
      await db.exec(readFileSync("drizzle/migrations/0079_free_house_placement.sql", "utf8"));
    }
    if (file === "0085_house_floors.sql") {
      // House floors serialize the placement rotation column introduced by this Supabase migration.
      await db.exec(
        readFileSync("supabase/migrations/20261105080000_house_placement_rotation.sql", "utf8"),
      );
    }
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8").replace(/^\uFEFF/, ""));
  }
  await db.exec(readFileSync("supabase/migrations/20261027113217_messaging_hardening.sql", "utf8"));
  await db.exec(
    readFileSync(
      "supabase/migrations/20261101222456_messaging_media_and_profile_covers.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync("supabase/migrations/20261103110815_tie_safe_social_history.sql", "utf8"),
  );
  chars = [];
  for (const [index, user] of users.entries()) {
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query("insert into profiles(id) values($1)", [user]);
    const result = await db.query<{ id: string }>(
      "insert into characters(user_id,name,gender,age,personality) values($1,$2,'female',24,'ambitious') returning id",
      [user, `Player ${index}`],
    );
    chars.push(result.rows[0]!.id);
  }
  await db.query(
    "insert into player_friendships(first_character_id,second_character_id) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid))",
    chars.slice(0, 2),
  );
  thread = (
    await db.query<{ id: string }>(
      "insert into social_conversations(first_character_id,second_character_id) values(least($1::uuid,$2::uuid),greatest($1::uuid,$2::uuid)) returning id",
      chars.slice(0, 2),
    )
  ).rows[0]!.id;
}, 180000);
beforeEach(async () => {
  await db.exec("begin");
  await db.query("select set_config('test.user_id',$1,false)", [users[0]]);
});
afterEach(async () => {
  await db.exec("rollback;reset role;");
});
afterAll(async () => {
  await db?.close();
});
async function prepare(purpose = "attachment", user = users[0]!, digest = "a".repeat(64)) {
  return value("public.prepare_social_media_as_user($1,$2,$3,$4,'photo.png','image/png',20,$5)", [
    user,
    key,
    purpose,
    purpose === "cover" ? null : thread,
    digest,
  ]);
}
it("creates an attachment once and enriches only authorized history", async () => {
  const upload = await prepare();
  expect(upload.storage_path).toContain(key);
  const first = await value("public.finish_social_media_as_user($1,$2)", [users[0], key]);
  const replay = await value("public.finish_social_media_as_user($1,$2)", [users[0], key]);
  expect(replay.messageId).toBe(first.messageId);
  expect(replay.duplicate).toBe(true);
  const count = await db.query<{ count: number }>(
    "select count(*)::int as count from social_messages where request_id=$1",
    [key],
  );
  expect(count.rows[0]!.count).toBe(1);
  const history = await value("public.get_social_messages_with_media(null,$1,null,50)", [thread]);
  expect(history).toEqual([
    expect.objectContaining({
      attachment: { filename: "photo.png", mimeType: "image/png", size: 20 },
    }),
  ]);
  const media = await value("public.get_social_media_as_user($1,$2)", [users[1], first.messageId]);
  expect(media.filename).toBe("photo.png");
  await expect(
    value("public.get_social_media_as_user($1,$2)", [users[2], first.messageId]),
  ).rejects.toThrow("MEDIA_NOT_FOUND");
});
it("rejects changed retry content and unrelated request receipts", async () => {
  await prepare();
  await expect(prepare("attachment", users[0], "b".repeat(64))).rejects.toThrow(
    "IDEMPOTENCY_CONFLICT",
  );
  await value("public.send_social_message_as_user($1,'private','Original text',$2,null,$3,null)", [
    users[0],
    key,
    thread,
  ]);
  await expect(value("public.finish_social_media_as_user($1,$2)", [users[0], key])).rejects.toThrow(
    "IDEMPOTENCY_CONFLICT",
  );
});
it("rechecks friendship and reciprocal blocks before finalization and downloads", async () => {
  await prepare();
  const result = await value("public.finish_social_media_as_user($1,$2)", [users[0], key]);
  await db.query(
    "insert into player_blocks(blocker_character_id,blocked_character_id) values($1,$2)",
    [chars[1], chars[0]],
  );
  await expect(prepare()).rejects.toThrow("UNKNOWN_THREAD");
  await expect(
    value("public.get_social_media_as_user($1,$2)", [users[0], result.messageId]),
  ).rejects.toThrow("MEDIA_NOT_FOUND");
  await expect(
    value("public.get_social_profile_card_as_user($1,$2)", [users[0], chars[1]]),
  ).rejects.toThrow("PROFILE_UNAVAILABLE");
});
it("keeps covers and active status friend-only and omits sensitive character data", async () => {
  await prepare("cover");
  await value("public.finish_social_media_as_user($1,$2)", [users[0], key]);
  await db.query(
    "insert into player_status_posts(owner_user_id,owner_character_id,body,theme) values($1,$2,'Hello friends','leaf')",
    [users[0], chars[0]],
  );
  const friend = await value("public.get_social_profile_card_as_user($1,$2)", [users[1], chars[0]]);
  expect(friend.coverPath).toBeTypeOf("string");
  expect(friend.status).toMatchObject({ body: "Hello friends" });
  expect(Object.keys(friend).sort()).toEqual(
    [
      "appearance",
      "characterId",
      "coverPath",
      "gender",
      "isFriend",
      "isOwn",
      "level",
      "name",
      "status",
    ].sort(),
  );
  const outsider = await value("public.get_social_profile_card_as_user($1,$2)", [
    users[2],
    chars[0],
  ]);
  expect(outsider.coverPath).toBeNull();
  expect(outsider.status).toBeNull();
  await db.exec(
    "update player_status_posts set created_at=now()-interval '2 days',expires_at=now()-interval '1 second'",
  );
  expect(
    (await value("public.get_social_profile_card_as_user($1,$2)", [users[1], chars[0]])).status,
  ).toBeNull();
});
it("only lets the owner clear a cover", async () => {
  await prepare("cover");
  await value("public.finish_social_media_as_user($1,$2)", [users[0], key]);
  await expect(
    value("public.clear_social_profile_cover_as_user($1,$2)", [users[1], chars[0]]),
  ).rejects.toThrow("PROFILE_UNAVAILABLE");
  await value("public.clear_social_profile_cover_as_user($1,$2)", [users[0], chars[0]]);
  expect(
    (await value("public.get_social_profile_card_as_user($1,$2)", [users[0], chars[0]])).coverPath,
  ).toBeNull();
});
it("preserves the existing message burst limit without publishing a rejected upload", async () => {
  await prepare();
  for (let index = 0; index < 5; index++)
    await value(
      "public.send_social_message_as_user($1,'private','Hello',gen_random_uuid(),null,$2,null)",
      [users[0], thread],
    );
  await expect(value("public.finish_social_media_as_user($1,$2)", [users[0], key])).rejects.toThrow(
    "MESSAGE_RATE_LIMIT",
  );
  const result = await db.query<{ completed: boolean; message_id: string | null }>(
    "select completed,message_id from social_media_uploads where request_id=$1",
    [key],
  );
  expect(result.rows[0]).toEqual({ completed: false, message_id: null });
});
it("limits fresh upload reservations while allowing an existing retry", async () => {
  await prepare("cover");
  for (let index = 1; index < 20; index++)
    await value(
      "public.prepare_social_media_as_user($1,$2,'cover',null,'photo.png','image/png',20,$3)",
      [users[0], `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`, "a".repeat(64)],
    );
  expect((await prepare("cover")).storage_path).toBeTypeOf("string");
  await expect(
    value(
      "public.prepare_social_media_as_user($1,gen_random_uuid(),'cover',null,'photo.png','image/png',20,$2)",
      [users[0], "a".repeat(64)],
    ),
  ).rejects.toThrow("MEDIA_RATE_LIMIT");
});
it("paginates messages with the same timestamp without skipping boundary rows", async () => {
  const timestamp = "2026-11-03T10:00:00.000Z";
  for (let index = 1; index <= 4; index++) {
    const id = `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
    await db.query(
      `insert into social_messages(
        id,sender_character_id,channel,conversation_id,request_id,body,created_at
      ) values($1,$2,'private',$3,gen_random_uuid(),$4,$5)`,
      [id, chars[0], thread, `Message ${index}`, timestamp],
    );
  }

  const newestPage = await value<{ id: string; created_at: string }[]>(
    "public.get_social_messages_with_media_v2(null,$1,null,2,null)",
    [thread],
  );
  const olderPage = await value<{ id: string }[]>(
    "public.get_social_messages_with_media_v2(null,$1,$2,2,$3)",
    [thread, newestPage[0]!.created_at, newestPage[0]!.id],
  );

  expect([...olderPage, ...newestPage].map((message) => message.id)).toEqual([
    "00000000-0000-4000-8000-000000000001",
    "00000000-0000-4000-8000-000000000002",
    "00000000-0000-4000-8000-000000000003",
    "00000000-0000-4000-8000-000000000004",
  ]);
});
it("rejects incomplete history cursors and unrelated readers", async () => {
  await expect(
    value("public.get_social_messages_v2(null,$1,now(),2,null)", [thread]),
  ).rejects.toThrow("Invalid message history cursor");
  await db.query("select set_config('test.user_id',$1,false)", [users[2]]);
  await expect(
    value("public.get_social_messages_v2(null,$1,null,2,null)", [thread]),
  ).rejects.toThrow("Conversation not found");
  await expect(
    value("public.get_social_messages_with_media_v2(null,$1,null,2,null)", [thread]),
  ).rejects.toThrow("UNKNOWN_THREAD");
});
it("denies anonymous history execution and rechecks reciprocal blocks", async () => {
  await db.query(
    "insert into player_blocks(blocker_character_id,blocked_character_id) values($1,$2)",
    [chars[1], chars[0]],
  );
  await expect(
    value("public.get_social_messages_with_media_v2(null,$1,null,2,null)", [thread]),
  ).rejects.toThrow("UNKNOWN_THREAD");
  await db.exec("set local role anon");
  await expect(
    value("public.get_social_messages_v2(null,$1,null,2,null)", [thread]),
  ).rejects.toThrow("permission denied");
  await expect(
    value("public.get_social_messages_with_media_v2(null,$1,null,2,null)", [thread]),
  ).rejects.toThrow("permission denied");
});
it("denies browser metadata writes and storage reads despite a broad existing policy", async () => {
  await db.exec(
    "insert into storage.objects(bucket_id,name) values('social-media-v1','private-photo');set role authenticated;",
  );
  expect(
    (await db.query("select * from storage.objects where bucket_id='social-media-v1'")).rows,
  ).toHaveLength(0);
  await expect(
    run("insert into storage.objects(bucket_id,name) values('social-media-v1','forged')"),
  ).rejects.toThrow();
  await expect(run("select * from social_media_uploads")).rejects.toThrow("permission denied");
  await expect(prepare()).rejects.toThrow("permission denied");
});

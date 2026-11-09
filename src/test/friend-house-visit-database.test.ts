// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ownerUserId = "91111111-1111-4111-8111-111111111111";
const ownerCharacterId = "92222222-2222-4222-8222-222222222222";
const friendUserId = "93333333-3333-4333-8333-333333333333";
const friendCharacterId = "94444444-4444-4444-8444-444444444444";
const strangerUserId = "95555555-5555-4555-8555-555555555555";
const strangerCharacterId = "96666666-6666-4666-8666-666666666666";
const sharedRoomId = "f1ee0000-0000-4000-8000-000000000001";
let db: PGlite;

async function visit(asUser: string, targetCharacterId: string) {
  await db.query("select set_config('test.user_id',$1,false)", [asUser]);
  try {
    const { rows } = await db.query<{ result: Record<string, unknown> }>(
      "select public.get_friend_house_for_visit($1) as result",
      [targetCharacterId],
    );
    return { ok: true as const, result: rows[0]!.result };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : String(error) };
  }
}

async function setVisitSwitch(allow: boolean) {
  await db.query(
    "update public.character_home_saves set allow_friend_visits=$1 where character_id=$2",
    [allow, ownerCharacterId],
  );
}

async function setBlock(blocker: string, blocked: string | null) {
  await db.exec("delete from public.player_blocks");
  if (blocked) {
    await db.query(
      "insert into public.player_blocks(blocker_character_id,blocked_character_id) values($1,$2)",
      [blocker, blocked],
    );
  }
}

describe("friend house visit database", () => {
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
    // Same replay order as the house placement test: 0079 wraps the move function from the supabase file.
    for (const { tag } of journal.entries.filter(
      (entry: { tag: string }) =>
        ![
          "0075_remove_orphaned_player_data",
          "0077_market_stall_rent_categories_sales",
          "0079_free_house_placement",
        ].includes(entry.tag),
    ))
      await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8").replace(/^ /, ""));
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
      delete from public.player_blocks; delete from public.player_friendships;
      delete from public.character_home_saves; delete from public.player_houses;
      delete from public.wallets; delete from public.characters;
      delete from public.profiles; delete from auth.users;`);
    await db.exec(
      `insert into public.jobs(slug,name,description,salary,energy_cost) values('visit-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;`,
    );
    for (const [userId, characterId, name] of [
      [ownerUserId, ownerCharacterId, "Owner"],
      [friendUserId, friendCharacterId, "Friend"],
      [strangerUserId, strangerCharacterId, "Stranger"],
    ] as const) {
      await db.query("insert into auth.users(id) values($1)", [userId]);
      await db.query("insert into public.profiles(id,display_name) values($1,$2)", [userId, name]);
      await db.query(
        "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,$2,$3,'female',22,'ambitious','visit-job','housing')",
        [characterId, userId, name],
      );
      await db.query(
        "insert into public.wallets(user_id,character_id,balance) values($1,$2,500000)",
        [userId, characterId],
      );
    }
    // The owner rents a home and places one item, then saves a legacy snapshot with visits on.
    await db.query("select set_config('test.user_id',$1,false)", [ownerUserId]);
    await db.query("select public.housing_rent($1,'shared-room',$2)", [ownerUserId, sharedRoomId]);
    await db.query(
      "insert into public.content_items(id,category,slot_type,art_key,price_minor) values('visit-sofa','furniture','seat','sofa',0) on conflict(id) do nothing",
    );
    await db.query(
      "insert into public.player_items(player_id,item_id,source,is_stackable,quantity) values($1,'visit-sofa','gift',false,1)",
      [ownerUserId],
    );
    await db.query(
      `insert into public.character_home_saves(character_id,user_id,payload,allow_friend_visits)
       values($1,$2,'{"layoutId":"courtyard-room"}'::jsonb,true)`,
      [ownerCharacterId, ownerUserId],
    );
    await db.query(
      "insert into public.player_friendships(first_character_id,second_character_id) values($1,$2)",
      [
        [ownerCharacterId, friendCharacterId].sort()[0],
        [ownerCharacterId, friendCharacterId].sort()[1],
      ],
    );
    await db.query("select set_config('test.user_id',$1,false)", [ownerUserId]);
    await db.query("select public.house_place_free($1,'visit-sofa',20,20)", [ownerUserId]);
  });

  it("shows a friend the owner's current house with walls and placements", async () => {
    await db.query("update public.player_houses set walls_closed=true where player_id=$1", [
      ownerUserId,
    ]);
    const seen = await visit(friendUserId, ownerCharacterId);
    expect(seen.ok).toBe(true);
    if (!seen.ok) return;
    const house = seen.result["house"] as Record<string, unknown>;
    expect(seen.result["owner_name"]).toBe("Owner");
    expect(house["house_type_id"]).toBe("shared-room");
    expect(house["walls_closed"]).toBe(true);
    // Renting already places the starter furniture, so look for the sofa placed in the test.
    const placements = seen.result["placements"] as Array<Record<string, unknown>>;
    expect(placements.length).toBeGreaterThan(1);
    expect(placements.find((item) => item["item_id"] === "visit-sofa")).toMatchObject({
      art_key: "sofa",
      floor: 0,
      x: 20,
      y: 20,
    });
    // The owner's account id is never sent to a visitor.
    expect(JSON.stringify(seen.result)).not.toContain(ownerUserId);
  });

  it("refuses a stranger who is not a friend", async () => {
    const seen = await visit(strangerUserId, ownerCharacterId);
    expect(seen).toMatchObject({ ok: false, message: expect.stringContaining("not open to you") });
  });

  it("refuses a friend once the owner switches visits off", async () => {
    await setVisitSwitch(false);
    const seen = await visit(friendUserId, ownerCharacterId);
    expect(seen).toMatchObject({ ok: false, message: expect.stringContaining("not open to you") });
  });

  it("refuses a friend who is blocked in either direction", async () => {
    await setBlock(ownerCharacterId, friendCharacterId);
    expect(await visit(friendUserId, ownerCharacterId)).toMatchObject({ ok: false });
    await setBlock(friendCharacterId, ownerCharacterId);
    expect(await visit(friendUserId, ownerCharacterId)).toMatchObject({ ok: false });
    await setBlock(ownerCharacterId, null);
    expect(await visit(friendUserId, ownerCharacterId)).toMatchObject({ ok: true });
  });

  it("refuses a visit to your own home", async () => {
    expect(await visit(ownerUserId, ownerCharacterId)).toMatchObject({
      ok: false,
      message: expect.stringContaining("Choose a friend home"),
    });
  });
});

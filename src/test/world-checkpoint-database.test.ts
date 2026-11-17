// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const userId = "e1111111-1111-4111-8111-111111111111";
const otherUserId = "e5555555-5555-4555-8555-555555555555";
const characterId = "e2222222-2222-4222-8222-222222222222";
const locationId = "e3333333-3333-4333-8333-333333333333";
const otherLocationId = "e6666666-6666-4666-8666-666666666666";
const propertyId = "e4444444-4444-4444-8444-444444444444";
let db: PGlite;

type Outcome = { ok: true; result: unknown } | { ok: false; message: string };

const OLD_RPC = "public.save_my_world_checkpoint(double precision,double precision)";
const NEW_RPC =
  "public.save_neighborhood_world_checkpoint(uuid,uuid,uuid,double precision,double precision)";

/** Runs a statement under a real database role, so grants are enforced. */
async function asRole(role: string, sql: string, params: unknown[] = []): Promise<Outcome> {
  try {
    await db.exec(`set role ${role}`);
    const { rows } = await db.query<{ result: unknown }>(sql, params);
    return { ok: true, result: rows[0]?.result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  } finally {
    await db.exec("reset role");
  }
}

async function characterRow() {
  const { rows } = await db.query<{
    world_x: number;
    world_y: number;
    energy: number;
    game_time_minute: number;
    world_position_revision: string;
  }>(
    "select world_x, world_y, energy, game_time_minute, world_position_revision from public.characters where id=$1",
    [characterId],
  );
  return rows[0]!;
}

function saveAsService(character: string, user: string, location: string, x: number, y: number) {
  return asRole(
    "service_role",
    "select public.save_neighborhood_world_checkpoint($1,$2,$3,$4,$5) as result",
    [character, user, location, x, y],
  );
}

describe("neighbourhood checkpoint database", () => {
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
    await db.exec(
      readFileSync("supabase/migrations/20261110082709_save_world_checkpoint.sql", "utf8"),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261113000934_expand_neighborhood_world_bounds.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261113130000_secure_neighborhood_checkpoints.sql",
        "utf8",
      ),
    );
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role;
      delete from public.characters; delete from public.profiles; delete from auth.users;
      delete from public.player_properties;`);
    await db.exec(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('checkpoint-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;",
    );
    await db.query(
      "insert into public.locations(id,slug,name,tagline,description,district_type,map_x,map_y,canvas_x,canvas_y) values($1,'checkpoint-place','Checkpoint Place','t','d','residential',10,10,0.1,0.1) on conflict(id) do nothing",
      [locationId],
    );
    await db.query(
      "insert into public.locations(id,slug,name,tagline,description,district_type,map_x,map_y,canvas_x,canvas_y) values($1,'checkpoint-other','Other Place','t','d','residential',20,20,0.2,0.2) on conflict(id) do nothing",
      [otherLocationId],
    );
    await db.query("insert into auth.users(id) values($1), ($2)", [userId, otherUserId]);
    await db.query("insert into public.profiles(id,display_name) values($1,$2)", [
      userId,
      "Walker",
    ]);
    await db.query(
      "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step,current_location_id) values($1,$2,'Walker','female',22,'ambitious','checkpoint-job','housing',$3)",
      [characterId, userId, locationId],
    );
  });

  it("refuses the old checkpoint function to signed-in users and visitors", async () => {
    const outcome = await asRole(
      "authenticated",
      "select public.save_my_world_checkpoint(3, 3) as result",
    );
    expect(outcome).toMatchObject({
      ok: false,
      message: expect.stringContaining("permission denied"),
    });
    const { rows } = await db.query<{ anon: boolean; authenticated: boolean; service: boolean }>(
      `select has_function_privilege('anon','${OLD_RPC}','execute') as anon,
        has_function_privilege('authenticated','${OLD_RPC}','execute') as authenticated,
        has_function_privilege('service_role','${OLD_RPC}','execute') as service`,
    );
    expect(rows[0]).toEqual({ anon: false, authenticated: false, service: false });
  });

  it("accepts positions in the expanded neighbourhood", async () => {
    expect(
      await asUser(userId, "select public.save_my_world_checkpoint(24, 20) as result"),
    ).toMatchObject({ ok: true, result: { saved: true, world_x: 24, world_y: 20 } });
  });

  it("does not spend energy or game time when saving", async () => {
    const before = await db.query<{ energy: number; game_time_minute: number }>(
      "select energy, game_time_minute from public.characters where id=$1",
      [characterId],
    );
    await asUser(userId, "select public.save_my_world_checkpoint(9, 9) as result");
    const after = await db.query<{ energy: number; game_time_minute: number }>(
      "select energy, game_time_minute from public.characters where id=$1",
      [characterId],
  it("does not let visitors call the old checkpoint function", async () => {
    const outcome = await asRole("anon", "select public.save_my_world_checkpoint(3, 3) as result");
    expect(outcome).toMatchObject({
      ok: false,
      message: expect.stringContaining("permission denied"),
    });
  });

  it("is callable by the service role only", async () => {
    const { rows } = await db.query<{ anon: boolean; authenticated: boolean; service: boolean }>(
      `select has_function_privilege('anon','${NEW_RPC}','execute') as anon,
        has_function_privilege('authenticated','${NEW_RPC}','execute') as authenticated,
        has_function_privilege('service_role','${NEW_RPC}','execute') as service`,
    );
    expect(rows[0]).toEqual({ anon: false, authenticated: false, service: true });
    expect(
      await asRole(
        "authenticated",
        "select public.save_neighborhood_world_checkpoint(null,null,null,1,1) as result",
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining("permission denied") });
  });

  it("saves valid coordinates for the matching character, user and location", async () => {
    expect(await saveAsService(characterId, userId, locationId, 3.5, 4.25)).toMatchObject({
      ok: true,
      result: { saved: true, world_x: 3.5, world_y: 4.25 },
    });
    expect(await characterRow()).toMatchObject({ world_x: 3.5, world_y: 4.25 });
  });

  it("rejects coordinates outside the world bounds", async () => {
    expect(await saveAsService(characterId, userId, locationId, 25, 1)).toMatchObject({
      ok: false,
      message: expect.stringContaining("outside the fictional city"),
    });
    expect(await saveAsService(characterId, userId, locationId, 1, 21)).toMatchObject({
      ok: false,
      message: expect.stringContaining("outside the fictional city"),
    });
  });

  it("accepts the far corner of the expanded neighbourhood", async () => {
    expect(await saveAsService(characterId, userId, locationId, 24, 20)).toMatchObject({
      ok: true,
      result: { saved: true, world_x: 24, world_y: 20 },
    });
  });

  it("rejects incomplete checkpoints", async () => {
    expect(await saveAsService(characterId, userId, locationId, Number.NaN, 1)).toMatchObject({
      ok: false,
    });
    expect(
      await asRole(
        "service_role",
        "select public.save_neighborhood_world_checkpoint(null,$1,$2,1,1) as result",
        [userId, locationId],
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining("incomplete") });
  });

  it("cannot save a character that belongs to another user", async () => {
    const before = await characterRow();
    expect(await saveAsService(characterId, otherUserId, locationId, 5, 5)).toMatchObject({
      ok: true,
      result: { saved: false },
    });
    expect((await characterRow()).world_x).toBe(before.world_x);
  });

  it("cannot save a character whose current location differs from the supplied one", async () => {
    const before = await characterRow();
    expect(await saveAsService(characterId, userId, otherLocationId, 5, 5)).toMatchObject({
      ok: true,
      result: { saved: false },
    });
    expect((await characterRow()).world_x).toBe(before.world_x);
  });

  it("does not save while the character is inside a home", async () => {
    // Reuse a seeded room listing so the fixture satisfies the property constraints.
    await db.query(
      "insert into public.player_properties(id,user_id,character_id,property_id,tenure) values($1,$2,$3,(select id from public.game_properties where property_type='room' order by slug limit 1),'rented')",
      [propertyId, userId, characterId],
    );
    await db.query("update public.characters set inside_home_property_id=$1 where id=$2", [
      propertyId,
      characterId,
    ]);
    const before = await characterRow();
    expect(await saveAsService(characterId, userId, locationId, 5, 5)).toMatchObject({
      ok: true,
      result: { saved: false },
    });
    expect((await characterRow()).world_x).toBe(before.world_x);
  });

  it("does not change energy, game time or the world travel revision", async () => {
    const before = await characterRow();
    await saveAsService(characterId, userId, locationId, 9, 9);
    const after = await characterRow();
    expect(after.energy).toBe(before.energy);
    expect(after.game_time_minute).toBe(before.game_time_minute);
    expect(after.world_position_revision).toBe(before.world_position_revision);
  });
});

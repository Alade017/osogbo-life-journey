// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const userId = "e1111111-1111-4111-8111-111111111111";
const characterId = "e2222222-2222-4222-8222-222222222222";
let db: PGlite;

type Outcome = { ok: true; result: unknown } | { ok: false; message: string };

async function asUser(id: string, sql: string, params: unknown[] = []): Promise<Outcome> {
  await db.query("select set_config('test.user_id',$1,false)", [id]);
  try {
    const { rows } = await db.query<{ result: unknown }>(sql, params);
    return { ok: true, result: rows[0]?.result };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
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
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role;
      delete from public.characters; delete from public.profiles; delete from auth.users;`);
    await db.exec(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('checkpoint-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;",
    );
    await db.query("insert into auth.users(id) values($1)", [userId]);
    await db.query("insert into public.profiles(id,display_name) values($1,$2)", [
      userId,
      "Walker",
    ]);
    await db.query(
      "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,$2,'Walker','female',22,'ambitious','checkpoint-job','housing')",
      [characterId, userId],
    );
  });

  it("saves the spot the player stood on, and reads it back", async () => {
    expect(
      await asUser(userId, "select public.save_my_world_checkpoint(3.5, 4.25) as result"),
    ).toMatchObject({ ok: true, result: { saved: true, world_x: 3.5, world_y: 4.25 } });
    const { rows } = await db.query<{ world_x: number; world_y: number; energy: number }>(
      "select world_x, world_y, energy from public.characters where id=$1",
      [characterId],
    );
    expect(rows[0]).toMatchObject({ world_x: 3.5, world_y: 4.25 });
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
    );
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("refuses positions outside the fictional city", async () => {
    expect(
      await asUser(userId, "select public.save_my_world_checkpoint(20, 1) as result"),
    ).toMatchObject({ ok: false, message: expect.stringContaining("outside the fictional city") });
  });

  it("is not callable by signed-out visitors", async () => {
    const { rows } = await db.query<{ anon: boolean; authenticated: boolean }>(
      `select has_function_privilege('anon','public.save_my_world_checkpoint(double precision,double precision)','execute') as anon,
        has_function_privilege('authenticated','public.save_my_world_checkpoint(double precision,double precision)','execute') as authenticated`,
    );
    expect(rows[0]).toEqual({ anon: false, authenticated: true });
  });
});

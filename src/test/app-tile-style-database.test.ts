// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const playerUserId = "f1111111-1111-4111-8111-111111111111";
const otherUserId = "f2222222-2222-4222-8222-222222222222";
let db: PGlite;

async function setStyle(userId: string, style: string) {
  await db.query("select set_config('test.user_id',$1,false)", [userId]);
  try {
    const { rows } = await db.query<{ result: { app_tile_style: string } }>(
      "select public.set_my_app_tile_style($1) as result",
      [style],
    );
    return { ok: true as const, result: rows[0]!.result };
  } catch (error) {
    return { ok: false as const, message: error instanceof Error ? error.message : String(error) };
  }
}

async function styleOf(userId: string) {
  const { rows } = await db.query<{ app_tile_style: string }>(
    "select app_tile_style from public.profiles where id=$1",
    [userId],
  );
  return rows[0]!.app_tile_style;
}

describe("app tile style database", () => {
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
    await db.exec(`reset role; delete from public.profiles; delete from auth.users;`);
    for (const userId of [playerUserId, otherUserId]) {
      await db.query("insert into auth.users(id) values($1)", [userId]);
      await db.query("insert into public.profiles(id,display_name) values($1,'Player')", [userId]);
    }
  });

  it("starts every player on the rounded tile style", async () => {
    expect(await styleOf(playerUserId)).toBe("rounded");
  });

  it("saves a player's choice and returns it", async () => {
    expect(await setStyle(playerUserId, "circle")).toEqual({
      ok: true,
      result: { app_tile_style: "circle" },
    });
    expect(await styleOf(playerUserId)).toBe("circle");
    // The other player keeps their own choice.
    expect(await styleOf(otherUserId)).toBe("rounded");
  });

  it("refuses values other than rounded or circle", async () => {
    expect(await setStyle(playerUserId, "square")).toMatchObject({
      ok: false,
      message: expect.stringContaining("Tile style must be rounded or circle"),
    });
    expect(await styleOf(playerUserId)).toBe("rounded");
  });

  it("is not callable by anonymous visitors", async () => {
    const { rows } = await db.query<{ anon: boolean; signed_in: boolean }>(
      `select has_function_privilege('anon','public.set_my_app_tile_style(text)','execute') as anon,
        has_function_privilege('authenticated','public.set_my_app_tile_style(text)','execute') as signed_in`,
    );
    expect(rows[0]).toEqual({ anon: false, signed_in: true });
  });
});

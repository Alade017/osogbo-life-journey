// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const userId = "82222222-2222-4222-8222-222222222222";
let db: PGlite;

type Result = {
  ok: boolean;
  code?: string;
  state?: { placements: Array<{ item_id: string; slot: string; x: number; y: number }> };
};

async function addOwned(itemId: string, slotType: string, artKey: string) {
  await db.query(
    "insert into public.content_items(id,category,slot_type,art_key,price_minor) values($1,'furniture',$2,$3,0) on conflict(id) do nothing",
    [itemId, slotType, artKey],
  );
  await db.query(
    "insert into public.player_items(player_id,item_id,source,is_stackable,quantity) values($1,$2,'gift',false,1)",
    [userId, itemId],
  );
}

async function place(itemId: string, x: number, y: number) {
  const { rows } = await db.query<{ result: Result }>(
    "select public.house_place_free($1,$2,$3,$4) as result",
    [userId, itemId, x, y],
  );
  return rows[0]!.result;
}

async function move(fromItemId: string, x: number, y: number) {
  const { rows } = await db.query<{ result: Result }>(
    "select public.house_move_to_position($1, (select slot from public.house_placements where item_id=$2 limit 1), $3, $4) as result",
    [userId, fromItemId, x, y],
  );
  return rows[0]!.result;
}

async function freeCells(count: number): Promise<Array<{ x: number; y: number }>> {
  const { rows } = await db.query<{ x: number; y: number }>(
    `with house as (select id from public.player_houses where player_id=$1 and status='active'),
     cells as (select (4+11.5*(i+0.5))::numeric as x, (4+11.5*(j+0.5))::numeric as y
       from generate_series(0,7) i, generate_series(0,7) j)
     select c.x::float8 as x, c.y::float8 as y from cells c, house h
     where not public._house_grid_cell_taken(h.id, c.x, c.y, null)
     order by c.x, c.y limit $2`,
    [userId, count],
  );
  return rows;
}

describe("free furniture placement database", () => {
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
    // 0079 is replayed after the supabase file, because it wraps the move function defined there.
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
    // 0085 replaced the four-argument placement function; the live schema keeps only the five-argument version.
    await db.exec("drop function if exists public.house_place_free(uuid, text, numeric, numeric);");
    await db.query("insert into auth.users(id) values($1)", [userId]);
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(
      "reset role; delete from public.profiles where id='" +
        userId +
        "'; delete from auth.users where id='" +
        userId +
        "';",
    );
    await db.query("insert into auth.users(id) values($1)", [userId]);
    await db.query("insert into public.profiles(id,display_name) values($1,'Tenant')", [userId]);
    await db.query(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('free-placement-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary",
    );
    await db.query(
      "insert into public.characters(user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,'Tenant','female',22,'ambitious','free-placement-job','housing')",
      [userId],
    );
    await db.query(
      "insert into public.wallets(user_id,character_id,balance) select $1,id,500000 from public.characters where user_id=$1",
      [userId],
    );
    await db.query("select set_config('test.user_id',$1,false)", [userId]);
    await db.query("select public.housing_rent($1,'shared-room',$2)", [
      userId,
      "f1ee0000-0000-4000-8000-000000000001",
    ]);
  });

  it("places owned furniture on a free grid position with no room slot", async () => {
    const [a] = await freeCells(1);
    await addOwned("free-sofa", "seat", "sofa");
    const result = await place("free-sofa", a!.x, a!.y);
    expect(result.ok).toBe(true);
    const placed = result.state?.placements.find((item) => item.item_id === "free-sofa");
    expect(placed).toMatchObject({ x: a!.x, y: a!.y });
    expect(placed?.slot).toMatch(/^free:/);
  });

  it("refuses a second item on an occupied grid cell", async () => {
    const [a] = await freeCells(1);
    await addOwned("free-sofa", "seat", "sofa");
    await addOwned("free-lamp", "light", "light");
    expect((await place("free-sofa", a!.x, a!.y)).ok).toBe(true);
    // One unit away is still inside the same 11.5-wide cell.
    expect(await place("free-lamp", a!.x + 1, a!.y + 1)).toMatchObject({
      ok: false,
      code: "CELL_OCCUPIED",
    });
  });

  it("accepts a different cell and refuses an out-of-range position", async () => {
    const [a, b] = await freeCells(2);
    await addOwned("free-sofa", "seat", "sofa");
    await addOwned("free-lamp", "light", "light");
    expect((await place("free-sofa", a!.x, a!.y)).ok).toBe(true);
    expect((await place("free-lamp", b!.x, b!.y)).ok).toBe(true);
    expect(await place("free-lamp", 2, 50)).toMatchObject({ ok: false, code: "INVALID_POSITION" });
  });

  it("refuses to move an item onto a cell another item holds, and allows an empty cell", async () => {
    const [a, b, c] = await freeCells(3);
    await addOwned("free-sofa", "seat", "sofa");
    await addOwned("free-lamp", "light", "light");
    await place("free-sofa", a!.x, a!.y);
    await place("free-lamp", b!.x, b!.y);
    expect(await move("free-sofa", b!.x, b!.y)).toMatchObject({ ok: false, code: "CELL_OCCUPIED" });
    expect((await move("free-sofa", c!.x, c!.y)).ok).toBe(true);
  });

  it("lets an item stay in its own cell when it is moved there again", async () => {
    const [a] = await freeCells(1);
    await addOwned("free-sofa", "seat", "sofa");
    await place("free-sofa", a!.x, a!.y);
    expect((await move("free-sofa", a!.x + 1, a!.y + 1)).ok).toBe(true);
  });
});

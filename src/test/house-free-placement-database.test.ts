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
          "0083_studio_room_layout",
          "0084_other_homes_room_layout",
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
    // 0085 drops the four-argument house_place_free, but 0079 is replayed after it here and
    // brings that overload back. Drop it again so the five-argument version is the only one.
    await db.exec("drop function if exists public.house_place_free(uuid, text, numeric, numeric);");
    // Exercise the exact rearrangement function under test, not a hand-written test stub.
    await db.exec(
      readFileSync("supabase/migrations/20261118024000_house_rearrange.sql", "utf8"),
    );
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
  it("atomically rearranges existing items and rejects stale or foreign snapshots", async () => {
    const rows = async () =>
      (
        await db.query<{
          id: string;
          item_id: string;
          slot: string;
          x: number;
          y: number;
          floor: number;
          rotation_deg: number;
        }>(
          `select id,item_id,slot,x::float8,y::float8,floor,rotation_deg::float8 from public.house_placements
       where player_house_id=(select id from public.player_houses where player_id=$1 and status='active') order by id`,
          [userId],
        )
      ).rows;
    const before = await rows();
    const house = (
      await db.query<{ id: string }>(
        "select id from public.player_houses where player_id=$1 and status='active'",
        [userId],
      )
    ).rows[0]!.id;
    const expectedSnapshot = before.map(({ id, slot, x, y, floor, rotation_deg }) => ({
      id,
      slot,
      x,
      y,
      floor,
      rotation_deg,
    }));
    const count = (
      await db.query<{ n: number }>(
        "select sum(quantity)::int n from public.player_items where player_id=$1",
        [userId],
      )
    ).rows[0]!.n;
    // Seed an intentionally inconsistent legacy row with the same slot but a
    // different item. Disable the mirror trigger only while creating this adversarial
    // fixture; the rearrangement update itself must run with the real trigger enabled.
    const characterId = (
      await db.query<{ id: string }>(
        "select id from public.characters where user_id=$1",
        [userId],
      )
    ).rows[0]!.id;
    const target = (
      await db.query<{ id: string; item_id: string; slot: string; slot_type: string }>(
        `select p.id,p.item_id,p.slot,ci.slot_type
         from public.house_placements p
         join public.content_items ci on ci.id=p.item_id
         where p.player_house_id=$1
         order by p.id limit 1`,
        [house],
      )
    ).rows[0]!;
    const unmirrored = before.find(
      (placement) => placement.id !== target.id && placement.item_id !== target.item_id,
    );
    await db.exec(
      "alter table public.home_items disable trigger sync_legacy_home_item_to_authoritative;",
    );
    try {
      await db.query(
        `insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,x,y,placed)
         values($1,$2,$3,$4,$5,20,30,true)
         on conflict(character_id,item_id) do update
           set slot_type=excluded.slot_type,slot_id=excluded.slot_id,x=excluded.x,y=excluded.y,placed=true`,
        [userId, characterId, target.item_id, target.slot_type, target.slot],
      );
      await db.query(
        `insert into public.home_items(user_id,character_id,item_id,slot_type,slot_id,x,y,placed)
         values($1,$2,'rearrange-slot-decoy',$3,$4,12,13,true)`,
        [userId, characterId, target.slot_type, target.slot],
      );
      if (unmirrored) {
        await db.query(
          "delete from public.home_items where character_id=$1 and item_id=$2",
          [characterId, unmirrored.item_id],
        );
      }
    } finally {
      await db.exec(
        "alter table public.home_items enable trigger sync_legacy_home_item_to_authoritative;",
      );
    }

    // All original placements participate, including the starter furniture.
    const moves = before.map((p, i) => ({
      id: p.id,
      x: 9.75 + 11.5 * (i % 8),
      y: 9.75 + 11.5 * Math.floor(i / 8),
      floor: 0,
      rotation_deg: 90,
    }));
    const result = await db.query<{ result: Result }>(
      "select public.house_rearrange_owned_items($1,$2,$3,$4) result",
      [userId, house, JSON.stringify(expectedSnapshot), JSON.stringify(moves)],
    );
    expect(result.rows[0]!.result.ok).toBe(true);
    const after = await rows();
    expect(after.map((p) => p.id)).toEqual(before.map((p) => p.id));
    expect(after.map((p) => p.item_id)).toEqual(before.map((p) => p.item_id));
    expect(after.map((p) => p.slot)).toEqual(before.map((p) => p.slot));
    expect(after).toEqual(
      expect.arrayContaining(moves.map((move) => expect.objectContaining(move))),
    );
    const targetMove = moves.find((move) => move.id === target.id)!;
    const legacyTarget = (
      await db.query<{ x: number; y: number; placed: boolean; slot_id: string }>(
        "select x::float8,y::float8,placed,slot_id from public.home_items where character_id=$1 and item_id=$2",
        [characterId, target.item_id],
      )
    ).rows[0]!;
    expect(legacyTarget).toMatchObject({
      x: targetMove.x,
      y: targetMove.y,
      placed: true,
      slot_id: target.slot,
    });
    const decoy = (
      await db.query<{ x: number; y: number; placed: boolean; slot_id: string }>(
        "select x::float8,y::float8,placed,slot_id from public.home_items where character_id=$1 and item_id='rearrange-slot-decoy'",
        [characterId],
      )
    ).rows[0]!;
    expect(decoy).toMatchObject({ x: 12, y: 13, placed: true, slot_id: target.slot });
    if (unmirrored) {
      const orphan = await db.query(
        "select id from public.home_items where character_id=$1 and item_id=$2",
        [characterId, unmirrored.item_id],
      );
      expect(orphan.rows).toHaveLength(0);
    }
    expect(
      (
        await db.query<{ n: number }>(
          "select sum(quantity)::int n from public.player_items where player_id=$1",
          [userId],
        )
      ).rows[0]!.n,
    ).toBe(count);
    await expect(
      db.query("select public.house_rearrange_owned_items($1,$2,$3,$4)", [
        userId,
        house,
        JSON.stringify(expectedSnapshot),
        JSON.stringify(moves),
      ]),
    ).rejects.toThrow("LAYOUT_CHANGED");
    expect(await rows()).toEqual(after);
    if (moves.length > 1) {
      const duplicated = moves.map((p, i) =>
        i === 1 ? { ...p, x: moves[0]!.x, y: moves[0]!.y } : p,
      );
      await expect(
        db.query("select public.house_rearrange_owned_items($1,$2,$3,$4)", [
          userId,
          house,
          JSON.stringify(after),
          JSON.stringify(duplicated),
        ]),
      ).rejects.toThrow("INVALID_POSITION");
      expect(await rows()).toEqual(after);
    }

    await expect(
      db.query("select public.house_rearrange_owned_items($1,$2,$3,$4)", [
        "99999999-9999-4999-8999-999999999999",
        house,
        JSON.stringify(after),
        JSON.stringify(moves),
      ]),
    ).rejects.toThrow("NO_ACTIVE_HOUSE");
  });
});

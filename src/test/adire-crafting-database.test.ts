// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
const uid = "82222222-2222-4222-8222-222222222222";
const other = "93333333-3333-4333-8333-333333333333";
let db: PGlite, cid: string;
let sequence = 0;
const nonce = () => `99999999-9999-4999-8999-${String(++sequence).padStart(12, "0")}`;
async function quote(recipe = "adire-wrapper") {
  return (await db.query<{ q: unknown }>("select public._adire_recipe_quote($1) q", [recipe]))
    .rows[0]!.q;
}
async function start(id = nonce(), recipe = "adire-wrapper", q?: unknown) {
  return (
    await db.query<{ r: { ok: boolean; job_id: string } }>(
      "select public.start_adire_craft($1,$2,$3) r",
      [recipe, id, JSON.stringify(q ?? (await quote(recipe)))],
    )
  ).rows[0]!.r;
}
async function collect(id: string, zone = "zone-adire-vats") {
  return (await db.query<{ r: unknown }>("select public.collect_adire_craft($1,$2) r", [id, zone]))
    .rows[0]!.r;
}
async function owned(slug: string) {
  return (
    await db.query<{ n: number }>(
      "select coalesce(sum(p.quantity),0)::int n from player_inventory p join inventory_items i on i.id=p.item_id where p.character_id=$1 and i.slug=$2",
      [cid, slug],
    )
  ).rows[0]!.n;
}
async function add(slug: string, qty: number) {
  await db.query(
    "insert into player_inventory(user_id,character_id,item_id,quantity) select $1,$2,id,$3 from inventory_items where slug=$4 on conflict(character_id,item_id) do update set quantity=excluded.quantity",
    [uid, cid, qty, slug],
  );
}
async function ready(id: string) {
  await db.query(
    "update adire_craft_jobs set started_at=now()-interval '2 minutes',ready_at=now()-interval '1 second' where id=$1",
    [id],
  );
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions; create schema realtime;
    create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
    create function realtime.topic() returns text language sql stable as $$select ''::text$$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$begin return;end$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  const journal = JSON.parse(readFileSync("drizzle/migrations/meta/_journal.json", "utf8"));
  // Match the existing full-database test fixture's historical migration exclusions.
  for (const { tag } of journal.entries.filter(
    (e: { tag: string }) =>
      ![
        "0075_remove_orphaned_player_data",
        "0083_studio_room_layout",
        "0084_other_homes_room_layout",
        "0077_market_stall_rent_categories_sales",
        "0079_free_house_placement",
      ].includes(e.tag),
  ))
    await db.exec(readFileSync(`drizzle/migrations/${tag}.sql`, "utf8").replace(/^\uFEFF/, ""));
  // Keep shop checks deterministic; production uses shared real Lagos time, not character.game_time_hour.
  await db.exec(
    `create or replace function public.world_clock() returns jsonb language sql stable as $$ select '{"hour":10,"minute":0,"day":1,"weekday":0}'::jsonb $$`,
  );
  for (const user of [uid, other]) {
    await db.query("insert into auth.users(id) values($1)", [user]);
    await db.query("insert into profiles(id,display_name) values($1,'Crafter')", [user]);
    await db.query(
      "insert into characters(user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,'Crafter','female',22,'ambitious',(select slug from jobs limit 1),'housing')",
      [user],
    );
  }
  cid = (await db.query<{ id: string }>("select id from characters where user_id=$1", [uid]))
    .rows[0]!.id;
  await db.query("insert into wallets(user_id,character_id,balance) values($1,$2,10000)", [
    uid,
    cid,
  ]);
}, 180000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "reset role;delete from adire_craft_jobs;delete from player_inventory;delete from transactions;delete from economy_request_results;",
  );
  await db.query("select set_config('test.user_id',$1,false)", [uid]);
  await db.query(
    "update characters set current_location_id=(select id from locations where slug='city-centre'),inside_home_property_id=null,game_time_hour=10,game_time_minute=0 where id=$1",
    [cid],
  );
  await db.query("update wallets set balance=10000,total_expenses=0 where character_id=$1", [cid]);
  await add("adire_cotton", 4);
  await add("adire_indigo_dye", 2);
  await add("adire_thread", 2);
});
it("buys materials through the real shop RPC, crafts, and sells the output through the existing economy", async () => {
  await db.exec("delete from player_inventory");
  const offers = (
    await db.query<{ id: string; slug: string }>(
      "select si.id,i.slug from shop_items si join shops s on s.id=si.shop_id join inventory_items i on i.id=si.item_id where s.slug='adire-materials' and i.slug in ('adire_cotton','adire_indigo_dye','adire_thread')",
    )
  ).rows;
  expect(offers).toHaveLength(3);
  for (const offer of offers)
    await db.query("select purchase_shop_item($1,$2,$3)", [
      offer.id,
      offer.slug === "adire_cotton" ? 2 : 1,
      nonce(),
    ]);
  expect(
    (
      await db.query<{ n: number }>("select balance::float8 n from wallets where character_id=$1", [
        cid,
      ])
    ).rows[0]!.n,
  ).toBe(8700);
  const job = await start();
  await ready(job.job_id);
  await collect(job.job_id);
  await db.query(
    "select sell_inventory_item(s.id,p.id,1) from shops s,player_inventory p join inventory_items i on i.id=p.item_id where s.slug='adire-materials' and p.character_id=$1 and i.slug='adire_indigo_wrapper'",
    [cid],
  );
  expect(await owned("adire_indigo_wrapper")).toBe(0);
  expect(
    (
      await db.query<{ n: number }>("select balance::float8 n from wallets where character_id=$1", [
        cid,
      ])
    ).rows[0]!.n,
  ).toBe(10300);
  expect((await db.query("select * from transactions")).rows).toHaveLength(4);
});
it("consumes inputs once for overlapping same-request retries and rejects a changed quote", async () => {
  const id = nonce(),
    q = await quote();
  const [a, b] = await Promise.all([start(id), start(id)]);
  expect(a).toEqual(b);
  expect(await owned("adire_cotton")).toBe(2);
  expect(await owned("adire_thread")).toBe(1);
  await expect(
    start(id, "adire-wrapper", { ...(q as object), output_quantity: 10 }),
  ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  await expect(start()).rejects.toThrow("CRAFT_IN_PROGRESS");
});
it("rejects incomplete materials and tampered recipes without consuming any input", async () => {
  await add("adire_thread", 0);
  await expect(start()).rejects.toThrow("MISSING_MATERIALS");
  expect(await owned("adire_cotton")).toBe(4);
  await expect(
    start(nonce(), "adire-wrapper", { ...((await quote()) as object), duration_seconds: 1 }),
  ).rejects.toThrow("RECIPE_CHANGED");
  expect((await db.query("select * from adire_craft_jobs")).rows).toHaveLength(0);
});
it("uses server time and grants the snapshotted output exactly once across collection retries", async () => {
  const job = await start();
  await expect(collect(job.job_id)).rejects.toThrow("CRAFT_NOT_READY");
  await ready(job.job_id);
  await Promise.all([collect(job.job_id), collect(job.job_id)]);
  expect(await owned("adire_indigo_wrapper")).toBe(1);
  await db.query("update characters set current_location_id=null where id=$1", [cid]);
  expect(await collect(job.job_id)).toEqual(job);
  expect(
    await start(
      (
        await db.query<{ request_id: string }>(
          "select request_id from adire_craft_jobs where id=$1",
          [job.job_id],
        )
      ).rows[0]!.request_id,
    ),
  ).toEqual(job);
});
it("blocks full output stacks without losing the ready job", async () => {
  await add("adire_indigo_wrapper", 20);
  await expect(start()).rejects.toThrow("OUTPUT_STACK_FULL");
  await add("adire_indigo_wrapper", 19);
  const job = await start();
  await ready(job.job_id);
  await add("adire_indigo_wrapper", 20);
  await expect(collect(job.job_id)).rejects.toThrow("OUTPUT_STACK_FULL");
  expect(
    (
      await db.query<{ claimed_at: null }>("select claimed_at from adire_craft_jobs where id=$1", [
        job.job_id,
      ])
    ).rows[0]!.claimed_at,
  ).toBeNull();
  await add("adire_indigo_wrapper", 19);
  await collect(job.job_id);
  expect(await owned("adire_indigo_wrapper")).toBe(20);
});
it("requires the correct district and station and refuses home crafting", async () => {
  await db.query("update characters set current_location_id=null where id=$1", [cid]);
  await expect(start()).rejects.toThrow("VISIT_CRAFT_STATION");
  await db.query(
    "update characters set current_location_id=(select id from locations where slug='city-centre') where id=$1",
    [cid],
  );
  const job = await start();
  await ready(job.job_id);
  await expect(collect(job.job_id, "zone-adire-racks")).rejects.toThrow("VISIT_CRAFT_STATION");
  // A real tenancy is used to respect the production foreign key.
  await db.query(
    "insert into player_properties(user_id,character_id,property_id,tenure) select $1,$2,id,'rented' from game_properties limit 1 on conflict do nothing",
    [uid, cid],
  );
  await db.query(
    "update characters set inside_home_property_id=(select id from player_properties where character_id=$1 limit 1) where id=$1",
    [cid],
  );
  await expect(collect(job.job_id)).rejects.toThrow("VISIT_CRAFT_STATION");
});
it("isolates jobs by owner and forbids direct authenticated recipe or reward writes", async () => {
  const job = await start();
  await ready(job.job_id);
  await db.query("select set_config('test.user_id',$1,false)", [other]);
  await expect(collect(job.job_id)).rejects.toThrow("CRAFT_NOT_FOUND");
  await db.exec("set role authenticated");
  expect((await db.query("select * from adire_craft_jobs")).rows).toHaveLength(0);
  await expect(db.query("update adire_craft_jobs set claimed_at=null")).rejects.toThrow(
    /permission denied/,
  );
  await expect(db.query("update adire_recipes set output_quantity=50")).rejects.toThrow(
    /permission denied/,
  );
  await db.exec("reset role");
  await db.query("select set_config('test.user_id','',false)");
  await expect(start()).rejects.toThrow("UNAUTHORIZED");
});
it("keeps a job output unchanged when its recipe is edited afterwards", async () => {
  const job = await start();
  await ready(job.job_id);
  await db.exec("update adire_recipes set output_quantity=3 where id='adire-wrapper'");
  try {
    await collect(job.job_id);
    expect(await owned("adire_indigo_wrapper")).toBe(1);
  } finally {
    await db.exec("update adire_recipes set output_quantity=1 where id='adire-wrapper'");
  }
});
it("rolls input consumption back when saving the job fails", async () => {
  await db.exec(
    "alter table adire_craft_jobs add constraint reject_test_job check(recipe_id<>'adire-wrapper')",
  );
  try {
    await expect(start()).rejects.toThrow("reject_test_job");
    expect(await owned("adire_cotton")).toBe(4);
    expect(await owned("adire_thread")).toBe(2);
  } finally {
    await db.exec("alter table adire_craft_jobs drop constraint reject_test_job");
  }
});
it("shows owned ingredient counts and both seeded stations through the catalogue RPC", async () => {
  for (const zone of ["zone-adire-vats", "zone-adire-racks"]) {
    const state = (
      await db.query<{
        r: { recipes: Array<{ available: boolean; materials: Array<{ owned: number }> }> };
      }>("select my_adire_crafting($1) r", [zone])
    ).rows[0]!.r;
    expect(state.recipes).toHaveLength(1);
    expect(state.recipes[0]!.available).toBe(true);
    expect(state.recipes[0]!.materials.map((m) => m.owned).sort()).toEqual([2, 2, 4]);
  }
  expect(readFileSync("supabase/migrations/20261118133000_adire_crafting.sql", "utf8")).toBe(
    readFileSync("drizzle/migrations/0107_adire_crafting.sql", "utf8"),
  );
});

it("buys, equips, replaces and removes real clothing with server ownership checks", async () => {
  const offers = (
    await db.query<{ id: string; item_id: string; location_id: string; effects: unknown }>(
      "select si.id,si.item_id,s.location_id,i.effects from shop_items si join shops s on s.id=si.shop_id join inventory_items i on i.id=si.item_id where s.category='clothing' and i.slug='indigo_adire_shirt' limit 1",
    )
  ).rows;
  expect(offers).toHaveLength(1);
  const offer = offers[0]!;
  await db.query("update characters set current_location_id=$1 where id=$2", [
    offer.location_id,
    cid,
  ]);
  await db.query("select purchase_shop_item($1,1,$2)", [offer.id, nonce()]);
  const entry = (
    await db.query<{ id: string }>(
      "select id from player_inventory where character_id=$1 and item_id=$2",
      [cid, offer.item_id],
    )
  ).rows[0]!;
  await db.query("select set_config('test.user_id',$1,false)", [other]);
  await expect(db.query("select equip_inventory_item($1,'top')", [entry.id])).rejects.toThrow(
    "You do not own this item",
  );
  await db.query("select set_config('test.user_id',$1,false)", [uid]);
  await db.query("select equip_inventory_item($1,'top')", [entry.id]);
  expect(
    (
      await db.query<{ item_id: string }>(
        "select item_id from player_equipment where character_id=$1 and slot='top'",
        [cid],
      )
    ).rows[0]!.item_id,
  ).toBe(offer.item_id);
  const replacement = (
    await db.query<{ id: string; item_id: string }>(
      "select si.id,si.item_id from shop_items si join inventory_items i on i.id=si.item_id where si.shop_id=(select shop_id from shop_items where id=$1) and i.slug='city_cream_tee'",
      [offer.id],
    )
  ).rows[0]!;
  await db.query("select purchase_shop_item($1,1,$2)", [replacement.id, nonce()]);
  const replacementEntry = (
    await db.query<{ id: string }>(
      "select id from player_inventory where character_id=$1 and item_id=$2",
      [cid, replacement.item_id],
    )
  ).rows[0]!;
  await db.query("select equip_inventory_item($1,'top')", [replacementEntry.id]);
  expect(
    (
      await db.query<{ item_id: string }>(
        "select item_id from player_equipment where character_id=$1 and slot='top'",
        [cid],
      )
    ).rows[0]!.item_id,
  ).toBe(replacement.item_id);
  await db.query("select unequip_item('top')");
  expect(
    (
      await db.query("select id from player_inventory where character_id=$1 and item_id=$2", [
        cid,
        offer.item_id,
      ])
    ).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select id from player_equipment where character_id=$1 and slot='top'", [cid]))
      .rows,
  ).toHaveLength(0);
});

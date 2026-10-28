// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect } from "vitest";
let db: PGlite;
async function denied(work: () => Promise<unknown>, message: string) {
  await db.exec("savepoint denial");
  await expect(work()).rejects.toThrow(message);
  await db.exec("rollback to denial;release denial");
}
const uid = "11111111-1111-4111-8111-111111111111";
const id = (n: number) => n.toString(16).padStart(8, "0") + "-1111-4111-8111-111111111111";
type Page = {
  items: { id: string; ownerName: string; name: string; goods: string }[];
  nextCursor: string | null;
};
async function call<T = Page>(
  sql = "public.get_public_player_stalls()",
  params: unknown[] = [],
): Promise<T> {
  return (await db.query<{ value: T }>("select " + sql + " value", params)).rows[0]!.value;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema extensions;create schema realtime;
  create table auth.users(id uuid primary key,is_anonymous boolean not null default false);create table realtime.messages(id bigint generated always as identity);
  create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
  create function realtime.topic() returns text language sql stable as $$select ''::text$$;
  create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$begin return;end$$;
  grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
  for (const file of readdirSync("drizzle/migrations")
    .filter((f) => f.endsWith(".sql") && !f.startsWith("0075_"))
    .sort())
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/20261027104102_stall_passive_income.sql", "utf8"),
  );

  await db.exec(
    readFileSync("supabase/migrations/20261028143246_public_player_stall_discovery.sql", "utf8"),
  );
  for (let n = 0; n < 58; n++) {
    const account = n === 0 ? uid : id(n);
    await db.query("insert into auth.users(id) values($1)", [account]);
    await db.query("insert into profiles(id) values($1)", [account]);
    await db.query(
      "insert into characters(user_id,name,gender,age,personality) values($1,$2,'female',21,'creative')",
      [account, "Owner " + n],
    );
    await db.query(
      "insert into player_stalls(id,user_id,character_id,name,goods,is_open) select $1,user_id,id,$2,'Crafts',$3 from characters where user_id=$4",
      [id(n), "Sign " + n, n < 56, account],
    );
  }
  await db.exec("insert into wallets(user_id,character_id) select user_id,id from characters;");
}, 180000);
beforeEach(async () => {
  await db.exec("begin");
  await db.query("select set_config('test.user_id',$1,false)", [uid]);
});
afterEach(async () => {
  await db.exec("rollback;reset role;");
});
afterAll(async () => {
  await db?.close();
});
describe("public stall directory database", () => {
  it("projects display fields only, omits own/closed stalls and paginates without duplicates", async () => {
    const all: Page["items"] = [];
    let cursor: string | null = null;
    do {
      const page: Page = await call("public.get_public_player_stalls($1,20)", [cursor]);
      all.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    expect(all).toHaveLength(55);
    expect(new Set(all.map((s) => s.id)).size).toBe(55);
    expect(all[0]).toEqual({ id: id(1), ownerName: "Owner 1", name: "Sign 1", goods: "Crafts" });
    expect(all.every((s) => Object.keys(s).sort().join(",") === "goods,id,name,ownerName")).toBe(
      true,
    );
    expect(all.some((s) => [id(0), id(56), id(57)].includes(s.id))).toBe(false);
    const defaultPage = await call();
    expect(defaultPage.items).toHaveLength(20);
    expect(defaultPage.nextCursor).toBe(id(20));
  });
  it("bounds pages, rejects malformed cursors, and accepts a deleted cursor as a keyset boundary", async () => {
    expect((await call("public.get_public_player_stalls(null,50)")).items).toHaveLength(50);
    for (const limit of [0, 51, null, -1])
      await denied(
        () => call("public.get_public_player_stalls(null,$1)", [limit]),
        "INVALID_PAGE_LIMIT",
      );
    await denied(() => call("public.get_public_player_stalls('bad',20)"), "invalid input syntax");
    const first = await call();
    await db.query("delete from player_stalls where id=$1", [first.nextCursor]);
    expect(
      (await call("public.get_public_player_stalls($1,20)", [first.nextCursor])).items[0]!.id,
    ).toBe(id(21));
  });
  it("lets authenticated visitors use the RPC but never read another raw stall row", async () => {
    await db.exec("set role authenticated");
    expect((await call()).items).toHaveLength(20);
    const raw = await db.query<{ user_id: string }>("select * from player_stalls");
    expect(raw.rows).toHaveLength(1);
    expect(raw.rows[0]!.user_id).toBe(uid);
    expect((await db.query("select user_id from player_stalls where id=$1", [id(1)])).rows).toEqual(
      [],
    );
  });
  it("denies direct visitor/owner writes and denies unauthenticated RPC execution", async () => {
    await db.exec("set role authenticated");
    await denied(
      () => db.query("update player_stalls set name='Stolen' where id=$1", [id(1)]),
      "permission denied",
    );
    await denied(
      () => db.query("delete from player_stalls where id=$1", [id(0)]),
      "permission denied",
    );
    await denied(
      () =>
        db.query(
          "insert into player_stalls(user_id,character_id,name,goods) select user_id,id,'Forged','Crafts' from characters where user_id=$1",
          [uid],
        ),
      "permission denied",
    );
  });
  it("denies anonymous accounts, missing identity, and accounts without characters", async () => {
    await db.exec("savepoint gate");
    await db.query("update auth.users set is_anonymous=true where id=$1", [uid]);
    await expect(call()).rejects.toThrow("REGISTERED_ACCOUNT_REQUIRED");
    await db.exec("rollback to gate");
    await db.query("select set_config('test.user_id','',false)");
    await denied(() => call(), "REGISTERED_ACCOUNT_REQUIRED");
    await db.query("insert into auth.users(id) values($1)", [id(99)]);
    await db.query("select set_config('test.user_id',$1,false)", [id(99)]);
    await expect(call()).rejects.toThrow("CHARACTER_REQUIRED");
  });
  it("denies the anon role even with a forged user setting", async () => {
    await db.exec("set role anon");
    await expect(call()).rejects.toThrow("permission denied");
  });
  it("keeps owner save/open/close authority and changes the next listing without changing other stalls", async () => {
    await db.query("select set_config('test.user_id',$1,false)", [id(1)]);
    await db.exec("set role authenticated");
    await call("public.save_player_stall('New sign','Beads',false)");
    await db.exec("reset role");
    await db.query("select set_config('test.user_id',$1,false)", [uid]);
    expect((await call()).items.some((s) => s.id === id(1))).toBe(false);
    await db.query("select set_config('test.user_id',$1,false)", [id(1)]);
    await call("public.save_player_stall('New sign','Beads',true)");
    await db.query("select set_config('test.user_id',$1,false)", [uid]);
    expect((await call()).items[0]).toEqual({
      id: id(1),
      ownerName: "Owner 1",
      name: "New sign",
      goods: "Beads",
    });
    expect((await db.query("select name from player_stalls where id=$1", [id(0)])).rows).toEqual([
      { name: "Sign 0" },
    ]);
  });
  it("is stable and never changes wallets, income records, transactions or ownership", async () => {
    await call("public.save_player_stall('My sign','Crafts',true)");
    const snapshot = async () =>
      call<Record<string, unknown>>(
        String.raw`jsonb_build_object('stalls',(select jsonb_agg(to_jsonb(t) order by id) from player_stalls t),'state',(select jsonb_agg(t) from stall_income_state t),'days',(select jsonb_agg(t) from stall_income_days t),'receipts',(select jsonb_agg(t) from stall_income_receipts t),'wallets',(select jsonb_agg(to_jsonb(t) order by id) from wallets t),'transactions',(select count(*) from transactions))`,
      );
    const before = await snapshot();
    await call();
    await call("public.get_public_player_stalls($1,20)", [id(20)]);
    expect(await snapshot()).toEqual(before);
    expect(
      await call<string>(
        "(select provolatile::text from pg_proc where oid='public.get_public_player_stalls(uuid,integer)'::regprocedure)",
      ),
    ).toBe("s");
  });
});

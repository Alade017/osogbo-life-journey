// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ownerUserId = "f1111111-1111-4111-8111-111111111111";
const ownerCharacterId = "f2222222-2222-4222-8222-222222222222";
const friendUserId = "f3333333-3333-4333-8333-333333333333";
const friendCharacterId = "f4444444-4444-4444-8444-444444444444";
const strangerUserId = "f5555555-5555-4555-8555-555555555555";
const strangerCharacterId = "f6666666-6666-4666-8666-666666666666";
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

async function balanceOf(characterId: string) {
  const { rows } = await db.query<{ balance: string }>(
    "select balance from public.wallets where character_id=$1",
    [characterId],
  );
  return Number(rows[0]!.balance);
}

describe("Stake table recovery", () => {
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
      delete from public.mini_game_whot_games; delete from public.mini_game_boards;
      delete from public.mini_game_seats; delete from public.mini_game_tables;
      delete from public.transactions; delete from public.wallets; delete from public.characters;
      delete from public.profiles; delete from auth.users;`);
    await db.exec(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('whot-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;",
    );
    for (const [userId, characterId, name] of [
      [ownerUserId, ownerCharacterId, "Owner"],
      [friendUserId, friendCharacterId, "Friend"],
    ] as const) {
      await db.query("insert into auth.users(id) values($1)", [userId]);
      await db.query("insert into public.profiles(id,display_name) values($1,$2)", [userId, name]);
      await db.query(
        "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,$2,$3,'female',22,'ambitious','whot-job','housing')",
        [characterId, userId, name],
      );
      await db.query(
        "insert into public.wallets(user_id,character_id,balance) values($1,$2,10000)",
        [userId, characterId],
      );
    }
  });

  it("reports the caller's open table so the lobby can send them back to it", async () => {
    expect(await asUser(ownerUserId, "select public.mini_game_my_table() as result")).toEqual({
      ok: true,
      result: null,
    });
    const created = await asUser(ownerUserId, "select public.mini_game_create_table(250) as result");
    expect(created.ok).toBe(true);
    const mine = await asUser(ownerUserId, "select public.mini_game_my_table() as result");
    expect(mine).toMatchObject({
      ok: true,
      result: { table_id: expect.any(String), status: "open", stake: 250, seat: 1 },
    });
  });

  it("refunds an abandoned open table instead of blocking a new one", async () => {
    expect((await asUser(ownerUserId, "select public.mini_game_create_table(250) as result")).ok).toBe(true);
    expect(await balanceOf(ownerCharacterId)).toBe(9750);
    await db.exec("update public.mini_game_seats set last_active_at = now() - interval '11 minutes'");
    const next = await asUser(ownerUserId, "select public.mini_game_create_table(100) as result");
    expect(next.ok).toBe(true);
    expect(await balanceOf(ownerCharacterId)).toBe(9900);
    const { rows } = await db.query<{ status: string }>(
      "select status from public.mini_game_tables where stake=250",
    );
    expect(rows[0]?.status).toBe("cancelled");
  });

  it("still blocks a player whose table is active", async () => {
    expect((await asUser(ownerUserId, "select public.mini_game_create_table(250) as result")).ok).toBe(true);
    const second = await asUser(ownerUserId, "select public.mini_game_create_table(100) as result");
    expect(second).toEqual({ ok: false, message: expect.stringContaining("already at a table") });
  });

  it("settles a playing table that everyone has left as a draw with both stakes refunded", async () => {
    expect((await asUser(ownerUserId, "select public.mini_game_create_table(500) as result")).ok).toBe(true);
    const tableId = (await db.query<{ id: string }>("select id from public.mini_game_tables")).rows[0]!.id;
    expect((await asUser(friendUserId, "select public.mini_game_join_table($1) as result", [tableId])).ok).toBe(true);
    await db.exec("update public.mini_game_seats set last_active_at = now() - interval '11 minutes'");
    expect((await asUser(ownerUserId, "select public.mini_game_my_table() as result")).ok).toBe(true);
    const { rows } = await db.query<{ status: string; result: string }>(
      "select status, result from public.mini_game_tables where id=$1",
      [tableId],
    );
    expect(rows[0]).toEqual({ status: "finished", result: "draw" });
    expect(await balanceOf(ownerCharacterId)).toBe(10000);
    expect(await balanceOf(friendCharacterId)).toBe(10000);
  });
});

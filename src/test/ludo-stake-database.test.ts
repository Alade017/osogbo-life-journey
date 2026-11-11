// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const ownerUserId = "a1111111-1111-4111-8111-111111111111";
const ownerCharacterId = "a2222222-2222-4222-8222-222222222222";
const friendUserId = "a3333333-3333-4333-8333-333333333333";
const friendCharacterId = "a4444444-4444-4444-8444-444444444444";
const strangerUserId = "a5555555-5555-4555-8555-555555555555";
const strangerCharacterId = "a6666666-6666-4666-8666-666666666666";
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

// The server route runs as service_role, so these calls use that role.
async function asServer<T>(sql: string, params: unknown[] = []): Promise<T> {
  await db.exec("set role service_role");
  try {
    const { rows } = await db.query<{ result: T }>(sql, params);
    return rows[0]!.result;
  } finally {
    await db.exec("reset role");
  }
}

async function tableIdFor(stake: number) {
  const { rows } = await db.query<{ id: string }>(
    "select id from public.mini_game_tables where stake=$1 order by created_at desc limit 1",
    [stake],
  );
  return rows[0]!.id;
}

async function balanceOf(characterId: string) {
  const { rows } = await db.query<{ balance: string }>(
    "select balance from public.wallets where character_id=$1",
    [characterId],
  );
  return Number(rows[0]!.balance);
}

const emptySeeds = (houses: number) => Array.from({ length: houses }, () => [-1, -1, -1, -1]);
const startState = {
  mode: 1,
  seeds: emptySeeds(4),
  turn: 0,
  pending: null,
  lastRoll: null,
  winner: null,
};
const winningState = { ...startState, turn: 1, winner: 0 };

describe("Ludo at stake tables database", () => {
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
    await db.exec(readFileSync("supabase/migrations/20261111150000_ludo_stake_tables.sql", "utf8"));
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  beforeEach(async () => {
    await db.exec(`reset role;
      delete from public.mini_game_ludo_games; delete from public.mini_game_boards;
      delete from public.mini_game_seats; delete from public.mini_game_tables;
      delete from public.transactions; delete from public.wallets; delete from public.characters;
      delete from public.profiles; delete from auth.users;`);
    await db.exec(
      "insert into public.jobs(slug,name,description,salary,energy_cost) values('ludo-job','Test job','Test wage',10000,1) on conflict(slug) do update set salary=excluded.salary;",
    );
    for (const [userId, characterId, name] of [
      [ownerUserId, ownerCharacterId, "Owner"],
      [friendUserId, friendCharacterId, "Friend"],
      [strangerUserId, strangerCharacterId, "Stranger"],
    ] as const) {
      await db.query("insert into auth.users(id) values($1)", [userId]);
      await db.query("insert into public.profiles(id,display_name) values($1,$2)", [userId, name]);
      await db.query(
        "insert into public.characters(id,user_id,name,gender,age,personality,occupation_preference,onboarding_step) values($1,$2,$3,'female',22,'ambitious','ludo-job','housing')",
        [characterId, userId, name],
      );
      await db.query(
        "insert into public.wallets(user_id,character_id,balance) values($1,$2,10000)",
        [userId, characterId],
      );
    }
  });

  async function openLudoTable(mode: 1 | 2 = 1, stake = 100) {
    expect(
      await asUser(ownerUserId, "select public.mini_game_create_ludo_table($1,$2) as result", [
        stake,
        mode,
      ]),
    ).toMatchObject({ ok: true });
    return tableIdFor(stake);
  }

  async function startedLudoTable(mode: 1 | 2 = 1) {
    const tableId = await openLudoTable(mode);
    expect(
      await asUser(friendUserId, "select public.mini_game_join_table($1) as result", [tableId]),
    ).toMatchObject({ ok: true });
    await asServer("select public.mini_game_ludo_init($1, $2::jsonb)", [
      tableId,
      JSON.stringify(startState),
    ]);
    return tableId;
  }

  it("opens a Ludo table with its setup and takes the first stake", async () => {
    const tableId = await openLudoTable(2, 100);
    const { rows } = await db.query<{ game: string; status: string; ludo_mode: number }>(
      "select game,status,ludo_mode from public.mini_game_tables where id=$1",
      [tableId],
    );
    expect(rows[0]).toEqual({ game: "ludo", status: "open", ludo_mode: 2 });
    expect(await balanceOf(ownerCharacterId)).toBe(9900);
  });

  it("refuses a setup that is not single or double house, and a stake outside the range", async () => {
    expect(
      await asUser(
        ownerUserId,
        "select public.mini_game_create_ludo_table($1,$2) as result",
        [100, 3],
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining("Choose single house") });
    expect(
      await asUser(
        ownerUserId,
        "select public.mini_game_create_ludo_table($1,$2) as result",
        [50, 1],
      ),
    ).toMatchObject({ ok: false, message: expect.stringContaining("between 100 and 5000") });
  });

  it("starts the table when the second player joins and records the Ludo label", async () => {
    const tableId = await openLudoTable(1, 250);
    expect(
      await asUser(friendUserId, "select public.mini_game_join_table($1) as result", [tableId]),
    ).toMatchObject({ ok: true });
    const { rows } = await db.query<{ status: string; pot: number }>(
      "select status,pot from public.mini_game_tables where id=$1",
      [tableId],
    );
    expect(rows[0]).toEqual({ status: "playing", pot: 500 });
    expect(await balanceOf(friendCharacterId)).toBe(9750);
  });

  it("shows the game to seated players only, and nothing before the game starts", async () => {
    const tableId = await openLudoTable(1, 100);
    await asUser(friendUserId, "select public.mini_game_join_table($1) as result", [tableId]);
    expect(
      await asUser(ownerUserId, "select public.mini_game_ludo_view($1) as result", [tableId]),
    ).toMatchObject({ ok: true, result: { started: false, my_seat: 1, mode: 1, version: -1 } });

    await asServer("select public.mini_game_ludo_init($1, $2::jsonb)", [
      tableId,
      JSON.stringify(startState),
    ]);
    const view = await asUser(friendUserId, "select public.mini_game_ludo_view($1) as result", [
      tableId,
    ]);
    expect(view).toMatchObject({
      ok: true,
      result: { started: true, my_seat: 2, version: 0, state: startState },
    });
    expect(
      await asUser(strangerUserId, "select public.mini_game_ludo_view($1) as result", [tableId]),
    ).toMatchObject({ ok: false, message: expect.stringContaining("not at this table") });
  });

  it("starts the game once: a second init changes nothing", async () => {
    const tableId = await startedLudoTable();
    await asServer("select public.mini_game_ludo_init($1, $2::jsonb)", [
      tableId,
      JSON.stringify({ ...startState, turn: 1 }),
    ]);
    const loaded = await asServer<{ version: number; state: { turn: number } }>(
      "select public.mini_game_ludo_load($1) as result",
      [tableId],
    );
    expect(loaded.version).toBe(0);
    expect(loaded.state.turn).toBe(0);
  });

  it("refuses a stale version and a player who is not seated", async () => {
    const tableId = await startedLudoTable();
    await expect(
      asServer("select public.mini_game_ludo_commit($1,$2,$3,$4::jsonb,null) as result", [
        tableId,
        ownerUserId,
        5,
        JSON.stringify(startState),
      ]),
    ).rejects.toThrow(/GAME_CHANGED/);
    await expect(
      asServer("select public.mini_game_ludo_commit($1,$2,$3,$4::jsonb,null) as result", [
        tableId,
        strangerUserId,
        0,
        JSON.stringify(startState),
      ]),
    ).rejects.toThrow(/NOT_SEATED/);
  });

  it("settles the pot to the winner when the server commits a finished game", async () => {
    const tableId = await startedLudoTable();
    const version = await asServer<number>(
      "select public.mini_game_ludo_commit($1,$2,$3,$4::jsonb,$5) as result",
      [tableId, ownerUserId, 0, JSON.stringify(winningState), 1],
    );
    expect(version).toBe(1);
    const { rows } = await db.query<{
      status: string;
      result: string;
      winner_character_id: string;
    }>("select status,result,winner_character_id from public.mini_game_tables where id=$1", [
      tableId,
    ]);
    expect(rows[0]).toEqual({
      status: "finished",
      result: "win",
      winner_character_id: ownerCharacterId,
    });
    // Pot 200 less a 5% fee leaves 190 for the winner.
    expect(await balanceOf(ownerCharacterId)).toBe(9900 + 190);
    expect(await balanceOf(friendCharacterId)).toBe(9900);
  });

  it("keeps the game state from client roles, and only the server may commit", async () => {
    await startedLudoTable();
    await db.exec("set role authenticated");
    try {
      await expect(db.query("select count(*) from public.mini_game_ludo_games")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
    const { rows } = await db.query<{ authenticated: boolean; service: boolean; anon: boolean }>(
      `select has_function_privilege('authenticated','public.mini_game_ludo_commit(uuid,uuid,int,jsonb,smallint)','execute') as authenticated,
        has_function_privilege('service_role','public.mini_game_ludo_commit(uuid,uuid,int,jsonb,smallint)','execute') as service,
        has_function_privilege('anon','public.mini_game_ludo_commit(uuid,uuid,int,jsonb,smallint)','execute') as anon`,
    );
    expect(rows[0]).toEqual({ authenticated: false, service: true, anon: false });
  });
});

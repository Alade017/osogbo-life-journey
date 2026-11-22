// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ACTIVE = "a1111111-1111-4111-8111-111111111111";
const OVERDUE = "b2222222-2222-4222-8222-222222222222";
const ENDED = "c3333333-3333-4333-8333-333333333333";
let db: PGlite;

describe("house walls require an active home", () => {
  beforeAll(async () => {
    db = new PGlite();
    // Minimal stubs for the helpers the migration calls. The function under test is the real one.
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table public.player_houses(
        id uuid primary key default gen_random_uuid(),
        player_id uuid not null, status text not null, walls_closed boolean);
      create function public._process_player_house_status(p uuid) returns void
        language plpgsql as $$ begin return; end $$;
      create function public._audit_house_action(p uuid, a text, b text, c text, d text default null)
        returns void language plpgsql as $$ begin return; end $$;
      create function public._house_error(p_code text) returns jsonb
        language sql immutable as $$ select jsonb_build_object('ok',false,'code',p_code) $$;
    `);
    await db.exec(
      readFileSync(
        "supabase/migrations/20261122240000_house_walls_require_active_home.sql",
        "utf8",
      ),
    );
    await db.query(
      "insert into public.player_houses(player_id,status,walls_closed) values($1,'active',false),($2,'overdue',false),($3,'ended',false)",
      [ACTIVE, OVERDUE, ENDED],
    );
  });

  afterAll(async () => {
    await db?.close();
  });

  async function setWalls(player: string, closed: boolean) {
    const { rows } = await db.query<{ result: { ok: boolean; code?: string } }>(
      "select public.house_set_walls($1,$2) as result",
      [player, closed],
    );
    return rows[0]!.result;
  }

  it("changes the walls of the active home", async () => {
    expect(await setWalls(ACTIVE, true)).toEqual({ ok: true, walls_closed: true });
    const { rows } = await db.query<{ walls_closed: boolean }>(
      "select walls_closed from public.player_houses where player_id=$1",
      [ACTIVE],
    );
    expect(rows[0]!.walls_closed).toBe(true);
  });

  it("rejects overdue homes the same way furniture writes do", async () => {
    expect(await setWalls(OVERDUE, true)).toEqual({ ok: false, code: "NO_ACTIVE_HOUSE" });
    const { rows } = await db.query<{ walls_closed: boolean }>(
      "select walls_closed from public.player_houses where player_id=$1",
      [OVERDUE],
    );
    expect(rows[0]!.walls_closed).toBe(false);
  });

  it("rejects ended homes", async () => {
    expect(await setWalls(ENDED, true)).toEqual({ ok: false, code: "NO_ACTIVE_HOUSE" });
  });
});

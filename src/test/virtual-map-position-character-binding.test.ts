// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const oldCharacterId = "22222222-2222-4222-8222-222222222222";
const activeCharacterId = "33333333-3333-4333-8333-333333333333";
let db: PGlite;

describe("character-bound virtual map position RPC", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid
        language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.profiles(id uuid primary key);
      create table public.characters(
        id uuid primary key,
        user_id uuid not null references public.profiles(id),
        created_at timestamptz not null default now()
      );
      insert into public.profiles(id) values ('${userId}');
      insert into public.characters(id,user_id,created_at) values
        ('${oldCharacterId}','${userId}','2026-10-01T00:00:00Z'),
        ('${activeCharacterId}','${userId}','2026-10-02T00:00:00Z');
      create table public.virtual_position_calls(
        id bigint generated always as identity,
        character_id uuid not null,
        latitude double precision not null,
        longitude double precision not null,
        movement_state text not null
      );
      create function public._my_character_id() returns uuid
        language sql stable security definer set search_path=public
        as $$
          select id from public.characters where user_id=auth.uid()
          order by created_at desc,id desc limit 1
        $$;
      create function public.save_player_map_position(
        double precision,double precision,text
      ) returns jsonb language plpgsql security definer set search_path=public as $$
      declare cid uuid:=public._my_character_id();
      begin
        insert into public.virtual_position_calls(character_id,latitude,longitude,movement_state)
        values(cid,$1,$2,$3);
        return jsonb_build_object('character_id',cid,'latitude',$1,'longitude',$2,'movement_state',$3);
      end $$;
      select set_config('request.jwt.claim.sub','${userId}',false);
    `);
    await db.exec(readFileSync(
      "supabase/migrations/20261109170000_bind_local_travel_to_character.sql", "utf8",
    ));
    await db.exec(readFileSync(
      "supabase/migrations/20261109190000_bind_virtual_map_position_to_character.sql", "utf8",
    ));
  });

  afterAll(async () => {
    await db?.close();
  });

  it("saves position for the expected active character", async () => {
    const { rows } = await db.query<{ result: Record<string, unknown> }>(
      "select public.save_player_map_position_for_character(7.76,4.55,'walking',$1) as result",
      [activeCharacterId],
    );
    expect(rows[0]?.result).toMatchObject({
      character_id: activeCharacterId,
      latitude: 7.76,
      longitude: 4.55,
      movement_state: "walking",
    });
  });

  it("rejects a stale queued position before the legacy saver runs", async () => {
    await expect(db.query(
      "select public.save_player_map_position_for_character(7.76,4.55,'idle',$1)",
      [oldCharacterId],
    )).rejects.toThrow(/CHARACTER_CHANGED/);
    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from public.virtual_position_calls",
    );
    expect(rows[0]?.count).toBe(1);
  });

  it("revokes the old client entry point and grants only the bound wrapper", async () => {
    const { rows } = await db.query<{ legacy: boolean; bound: boolean; anon: boolean }>(`
      select
        has_function_privilege('authenticated',
          'public.save_player_map_position(double precision,double precision,text)','execute') as legacy,
        has_function_privilege('authenticated',
          'public.save_player_map_position_for_character(double precision,double precision,text,uuid)','execute') as bound,
        has_function_privilege('anon',
          'public.save_player_map_position_for_character(double precision,double precision,text,uuid)','execute') as anon
    `);
    expect(rows[0]).toEqual({ legacy: false, bound: true, anon: false });
  });
});

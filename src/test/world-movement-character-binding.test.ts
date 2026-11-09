// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const oldCharacterId = "22222222-2222-4222-8222-222222222222";
const activeCharacterId = "33333333-3333-4333-8333-333333333333";
const locationId = "44444444-4444-4444-8444-444444444444";
let db: PGlite;

describe("character-bound fictional-world movement RPCs", () => {
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
      create table public.world_movement_calls(
        id bigint generated always as identity,
        operation text not null,
        character_id uuid not null
      );
      create function public._my_character_id() returns uuid
        language sql stable security definer set search_path=public
        as $

          select id from public.characters where user_id=auth.uid()
          order by created_at desc,id desc limit 1
        $;
      create function public.travel_to_location(uuid,text) returns jsonb
        language sql security definer set search_path=public
        as $ select jsonb_build_object('ok',true) $;
      create function public.save_player_world_position(
        double precision,double precision,text,bigint,uuid
      ) returns jsonb language plpgsql security definer set search_path=public as $$
      declare cid uuid:=public._my_character_id();
      begin
        insert into public.world_movement_calls(operation,character_id) values('save',cid);
        return jsonb_build_object('operation','save','character_id',cid);
      end $$;
      create function public.travel_to_city_location(
        uuid,text,double precision,double precision,bigint,uuid
      ) returns jsonb language plpgsql security definer set search_path=public as $$
      declare cid uuid:=public._my_character_id();
      begin
        insert into public.world_movement_calls(operation,character_id) values('travel',cid);
        return jsonb_build_object('operation','travel','character_id',cid);
      end $$;
      select set_config('request.jwt.claim.sub','${userId}',false);
    `);
    await db.exec(readFileSync(
      "supabase/migrations/20261109150000_canonical_active_character.sql", "utf8",
    ));
    await db.exec(readFileSync(
      "supabase/migrations/20261109170000_bind_local_travel_to_character.sql", "utf8",
    ));
    await db.exec(readFileSync(
      "supabase/migrations/20261109180000_bind_world_movement_to_character.sql", "utf8",
    ));
  });

  afterAll(async () => {
    await db?.close();
  });

  it("runs both world movement operations for the expected active character", async () => {
    const save = await db.query<{ result: Record<string, unknown> }>(
      "select public.save_player_world_position_for_character(1,2,null,0,$1,$2) as result",
      ["55555555-5555-4555-8555-555555555555", activeCharacterId],
    );
    const travel = await db.query<{ result: Record<string, unknown> }>(
      "select public.travel_to_city_location_for_character($1,'danfo',3,4,0,$2,$3) as result",
      [locationId,"66666666-6666-4666-8666-666666666666",activeCharacterId],
    );
    expect(save.rows[0]?.result).toMatchObject({ operation: "save", character_id: activeCharacterId });
    expect(travel.rows[0]?.result).toMatchObject({ operation: "travel", character_id: activeCharacterId });
  });

  it("rejects stale character requests before either legacy movement routine runs", async () => {
    await expect(db.query(
      "select public.save_player_world_position_for_character(1,2,null,0,$1,$2)",
      ["77777777-7777-4777-8777-777777777777",oldCharacterId],
    )).rejects.toThrow(/CHARACTER_CHANGED/);
    await expect(db.query(
      "select public.travel_to_city_location_for_character($1,'danfo',3,4,0,$2,$3)",
      [locationId,"88888888-8888-4888-8888-888888888888",oldCharacterId],
    )).rejects.toThrow(/CHARACTER_CHANGED/);
    const calls = await db.query<{ count: number }>(
      "select count(*)::int as count from public.world_movement_calls",
    );
    expect(calls.rows[0]?.count).toBe(2);
  });

  it("revokes direct authenticated access and exposes only character-bound wrappers", async () => {
    const { rows } = await db.query<{
      save_legacy: boolean; travel_legacy: boolean;
      save_bound: boolean; travel_bound: boolean;
      save_anon: boolean; travel_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated','public.save_player_world_position(double precision,double precision,text,bigint,uuid)','execute') as save_legacy,
        has_function_privilege('authenticated','public.travel_to_city_location(uuid,text,double precision,double precision,bigint,uuid)','execute') as travel_legacy,
        has_function_privilege('authenticated','public.save_player_world_position_for_character(double precision,double precision,text,bigint,uuid,uuid)','execute') as save_bound,
        has_function_privilege('authenticated','public.travel_to_city_location_for_character(uuid,text,double precision,double precision,bigint,uuid,uuid)','execute') as travel_bound,
        has_function_privilege('anon','public.save_player_world_position_for_character(double precision,double precision,text,bigint,uuid,uuid)','execute') as save_anon,
        has_function_privilege('anon','public.travel_to_city_location_for_character(uuid,text,double precision,double precision,bigint,uuid,uuid)','execute') as travel_anon
    `);
    expect(rows[0]).toEqual({
      save_legacy: false, travel_legacy: false,
      save_bound: true, travel_bound: true,
      save_anon: false, travel_anon: false,
    });
  });
});

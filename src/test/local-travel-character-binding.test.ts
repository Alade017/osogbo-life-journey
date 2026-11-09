// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const oldCharacterId = "22222222-2222-4222-8222-222222222222";
const activeCharacterId = "33333333-3333-4333-8333-333333333333";
const destinationId = "44444444-4444-4444-8444-444444444444";
let db: PGlite;

describe("character-bound local travel RPC", () => {
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
      create function public._my_character_id() returns uuid
        language sql stable security definer set search_path=public
        as $$
          select id from public.characters
          where user_id=auth.uid()
          order by created_at desc,id desc limit 1
        $$;
      create table public.travel_calls(id bigint generated always as identity, character_id uuid not null);
      create function public.travel_to_location(p_location_id uuid,p_mode text)
        returns jsonb language plpgsql security definer set search_path=public
        as $function$
        declare cid uuid:=public._my_character_id();
        begin
          insert into public.travel_calls(character_id) values(cid);
          return jsonb_build_object('character_id',cid,'location_id',p_location_id,'mode',p_mode);
        end
        $function$;
      select set_config('request.jwt.claim.sub','${userId}',false);
    `);
    await db.exec(
      readFileSync("supabase/migrations/20261109170000_bind_local_travel_to_character.sql", "utf8"),
    );
  }, 180_000);

  afterAll(async () => {
    await db?.close();
  });

  it("runs local travel only for the expected active character", async () => {
    const { rows } = await db.query<{ result: Record<string, unknown> }>(
      "select public.travel_to_location_for_character($1,'danfo',$2) as result",
      [destinationId, activeCharacterId],
    );
    expect(rows[0]?.result).toEqual({
      character_id: activeCharacterId,
      location_id: destinationId,
      mode: "danfo",
    });
  });

  it("rejects a stale character before invoking the legacy travel RPC", async () => {
    await expect(
      db.query("select public.travel_to_location_for_character($1,'danfo',$2)", [
        destinationId,
        oldCharacterId,
      ]),
    ).rejects.toThrow(/CHARACTER_CHANGED/);
    const { rows } = await db.query<{ count: number }>(
      "select count(*)::int as count from public.travel_calls",
    );
    expect(rows[0]?.count).toBe(1);
  });

  it("removes the direct client entry point and grants only the bound wrapper", async () => {
    const { rows } = await db.query<{
      legacy_authenticated: boolean;
      wrapper_authenticated: boolean;
      wrapper_anon: boolean;
    }>(`
      select
        has_function_privilege('authenticated',
          'public.travel_to_location(uuid,text)','execute') as legacy_authenticated,
        has_function_privilege('authenticated',
          'public.travel_to_location_for_character(uuid,text,uuid)','execute') as wrapper_authenticated,
        has_function_privilege('anon',
          'public.travel_to_location_for_character(uuid,text,uuid)','execute') as wrapper_anon
    `);
    expect(rows[0]).toEqual({
      legacy_authenticated: false,
      wrapper_authenticated: true,
      wrapper_anon: false,
    });
  });
});

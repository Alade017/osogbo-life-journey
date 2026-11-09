// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const oldCharacterId = "22222222-2222-4222-8222-222222222222";
const activeCharacterId = "33333333-3333-4333-8333-333333333333";
const targetCharacterId = "44444444-4444-4444-8444-444444444444";
const locationId = "55555555-5555-4555-8555-555555555555";
const requestId = "66666666-6666-4666-8666-666666666666";
const requirementId = "77777777-7777-4777-8777-777777777777";
let db: PGlite;

describe("character-bound party mutation RPCs", () => {
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
      create table public.party_mutation_calls(
        id bigint generated always as identity, operation text not null
      );
      create function public._party_stub(p_operation text) returns jsonb
        language plpgsql security definer set search_path=public as $$
        begin
          insert into public.party_mutation_calls(operation) values(p_operation);
          return jsonb_build_object('operation',p_operation);
        end $$;
      create function public.enter_club(uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('enter_club') $$;
      create function public.leave_club(uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('leave_club') $$;
      create function public.join_club_activity(text,uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('join_club_activity') $$;
      create function public.buy_drink(text,uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('buy_drink') $$;
      create function public.dance_with_npc(text,uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('dance_with_npc') $$;
      create function public.dance_with_npc_for_character(text,uuid,uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('dance_with_npc_for_character') $$;
      create function public.dance_with_player(uuid,uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('dance_with_player') $$;
      create function public.host_party_event(uuid,text,timestamptz,jsonb,uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('host_party_event') $$;
      create function public.respond_to_event(uuid,uuid) returns jsonb
        language sql security definer set search_path=public
        as $$ select public._party_stub('respond_to_event') $$;
      select set_config('request.jwt.claim.sub','${userId}',false);
    `);
    await db.exec(readFileSync(
      "supabase/migrations/20261109140000_bind_party_mutations_to_character.sql", "utf8",
    ));
  });

  afterAll(async () => {
    await db?.close();
  });

  it("routes every party mutation through the expected active character", async () => {
    const calls = [
      "select public.enter_club_for_character($1,$2)",
      "select public.leave_club_for_character($1,$2)",
      "select public.join_club_activity_for_character('quiz',$1,$2)",
      "select public.buy_drink_for_character('chapman',$1,$2)",
      "select public.dance_with_player_for_character($3,$1,$2)",
      "select public.host_party_event_for_character($4,'Test',$5,'[]'::jsonb,$1,$2)",
      "select public.respond_to_event_for_character($6,$1,$2)",
      "select public.dance_with_npc_for_character_locked('dancer-lola',$1,$2)",
    ];
    for (const sql of calls) {
      await db.query(sql, [requestId,activeCharacterId,targetCharacterId,locationId,"2026-11-10T20:00:00Z",requirementId]);
    }
    const result = await db.query<{ count: number }>(
      "select count(*)::int as count from public.party_mutation_calls",
    );
    expect(result.rows[0]?.count).toBe(calls.length);
  });

  it("rejects stale-character requests before any party mutation executes", async () => {
    const calls = [
      "select public.enter_club_for_character($1,$2)",
      "select public.leave_club_for_character($1,$2)",
      "select public.join_club_activity_for_character('quiz',$1,$2)",
      "select public.buy_drink_for_character('chapman',$1,$2)",
      "select public.dance_with_player_for_character($3,$1,$2)",
      "select public.host_party_event_for_character($4,'Test',$5,'[]'::jsonb,$1,$2)",
      "select public.respond_to_event_for_character($6,$1,$2)",
      "select public.dance_with_npc_for_character_locked('dancer-lola',$1,$2)",
    ];
    for (const sql of calls) {
      await expect(db.query(sql, [requestId,oldCharacterId,targetCharacterId,locationId,"2026-11-10T20:00:00Z",requirementId]))
        .rejects.toThrow(/CHARACTER_CHANGED/);
    }
    const result = await db.query<{ count: number }>(
      "select count(*)::int as count from public.party_mutation_calls",
    );
    expect(result.rows[0]?.count).toBe(calls.length);
  });

  it("denies direct legacy mutation access and grants only bound wrappers", async () => {
    const { rows } = await db.query<{ legacy: boolean; bound: boolean }>(`
      select
        has_function_privilege('authenticated','public.enter_club(uuid)','execute')
          or has_function_privilege('authenticated','public.leave_club(uuid)','execute')
          or has_function_privilege('authenticated','public.join_club_activity(text,uuid)','execute')
          or has_function_privilege('authenticated','public.buy_drink(text,uuid)','execute')
          or has_function_privilege('authenticated','public.dance_with_player(uuid,uuid)','execute')
          or has_function_privilege('authenticated','public.host_party_event(uuid,text,timestamptz,jsonb,uuid)','execute')
          or has_function_privilege('authenticated','public.respond_to_event(uuid,uuid)','execute')
          as legacy,
        has_function_privilege('authenticated','public.enter_club_for_character(uuid,uuid)','execute')
          and has_function_privilege('authenticated','public.leave_club_for_character(uuid,uuid)','execute')
          and has_function_privilege('authenticated','public.join_club_activity_for_character(text,uuid,uuid)','execute')
          and has_function_privilege('authenticated','public.buy_drink_for_character(text,uuid,uuid)','execute')
          and has_function_privilege('authenticated','public.dance_with_player_for_character(uuid,uuid,uuid)','execute')
          and has_function_privilege('authenticated','public.host_party_event_for_character(uuid,text,timestamptz,jsonb,uuid,uuid)','execute')
          and has_function_privilege('authenticated','public.respond_to_event_for_character(uuid,uuid,uuid)','execute')
          and has_function_privilege('authenticated','public.dance_with_npc_for_character_locked(text,uuid,uuid)','execute')
          as bound
    `);
    expect(rows[0]).toEqual({ legacy: false, bound: true });
  });
});

// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const otherUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const characterId = "22222222-2222-4222-8222-222222222222";
const otherCharacterId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const branchId = "33333333-3333-4333-8333-333333333333";
const streetId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const migration = "supabase/migrations/20261105020855_bank_accounts.sql";
let db: PGlite;

describe("bank accounts", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create function auth.uid() returns uuid
      language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create table public.locations(
        id uuid primary key,
        name text not null,
        slug text not null,
        type text not null,
        is_active boolean not null default true
      );
      create table public.characters(
        id uuid primary key,
        user_id uuid not null,
        current_location_id uuid,
        created_at timestamptz not null default now()
      );
      create table public.game_places(
        id uuid primary key,
        location_id uuid not null,
        category text not null
      );
      create table public.map_landmark_actions(
        landmark_id text not null,
        id text not null,
        is_active boolean not null default true,
        primary key(landmark_id, id)
      );
      create function public._my_character_id() returns uuid
      language sql security definer
      as $$ select id from public.characters where user_id = auth.uid()
        order by created_at desc limit 1 $$;
      create function public.deposit_cash(p_amount bigint) returns jsonb
      language sql security definer
      as $$ select jsonb_build_object('amount', p_amount, 'action', 'deposit') $$;
      create function public.withdraw_cash(p_amount bigint) returns jsonb
      language sql security definer
      as $$ select jsonb_build_object('amount', p_amount, 'action', 'withdraw') $$;
    `);
    await db.query(
      `insert into public.map_landmark_actions(landmark_id,id) values
       ('cedar-bank','cedar-budgeting'),('meridian-bank','meridian-budgeting')`,
    );
    await db.exec(readFileSync(migration, "utf8"));
    await db.query(
      "insert into public.locations(id,name,slug,type) values($1,'Cedar Bank','cedar-bank','bank'),($2,'Town Street','town-street','district')",
      [branchId, streetId],
    );
    await db.query(
      `insert into public.characters(id,user_id,current_location_id) values
       ($1,$2,$3),($4,$5,$3)`,
      [characterId, userId, streetId, otherCharacterId, otherUserId],
    );
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("only opens an account at a bank branch and returns the same account on retry", async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    await expect(db.query("select public.open_bank_account()")).rejects.toThrow(
      "VISIT_BANK_BRANCH",
    );

    await db.query("update public.characters set current_location_id=$1 where id=$2", [
      branchId,
      characterId,
    ]);
    await expect(
      db.query("select public._require_bank_location($1)", [characterId]),
    ).resolves.toBeDefined();
    await db.query("update public.characters set current_location_id=$1 where id=$2", [
      streetId,
      characterId,
    ]);
    await expect(
      db.query("select public._require_bank_location($1)", [characterId]),
    ).rejects.toThrow("Visit a bank or ATM");
    await db.query("update public.characters set current_location_id=$1 where id=$2", [
      branchId,
      characterId,
    ]);
    const first = await db.query<{ account: Record<string, unknown> }>(
      "select public.open_bank_account() as account",
    );
    const second = await db.query<{ account: Record<string, unknown> }>(
      "select public.open_bank_account() as account",
    );
    expect(first.rows[0]?.account).toEqual(second.rows[0]?.account);
    expect(first.rows[0]?.account).toMatchObject({
      account_number: expect.stringMatching(/^\d{10}$/),
      branch_location_id: branchId,
      branch_name: "Cedar Bank",
    });
  });

  it("deactivates the old bank activities", async () => {
    const { rows } = await db.query<{ is_active: boolean }>(
      "select is_active from public.map_landmark_actions order by landmark_id",
    );
    expect(rows).toEqual([{ is_active: false }, { is_active: false }]);
  });

  it("keeps account rows private and requires an opened account for bank transfers", async () => {
    const privileges = await db.query<{
      row_security: boolean;
      can_select: boolean;
      can_call_legacy_deposit: boolean;
      can_call_bank_deposit: boolean;
    }>(`
      select
        (select relrowsecurity from pg_class where oid='public.bank_accounts'::regclass) as row_security,
        has_table_privilege('authenticated','public.bank_accounts','select') as can_select,
        has_function_privilege('authenticated','public.deposit_cash(bigint)','execute') as can_call_legacy_deposit,
        has_function_privilege('authenticated','public.bank_deposit_cash(bigint)','execute') as can_call_bank_deposit
    `);
    expect(privileges.rows[0]).toEqual({
      row_security: true,
      can_select: false,
      can_call_legacy_deposit: false,
      can_call_bank_deposit: true,
    });

    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [otherUserId]);
    const hidden = await db.query<{ account: Record<string, unknown> | null }>(
      "select public.my_bank_account() as account",
    );
    expect(hidden.rows[0]?.account).toBeNull();
    await expect(db.query("select public.bank_deposit_cash(250)")).rejects.toThrow(
      "BANK_ACCOUNT_REQUIRED",
    );
  });

  it("routes deposits and withdrawals through the existing wallet RPCs", async () => {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [userId]);
    const deposit = await db.query<{ result: { action: string; amount: number } }>(
      "select public.bank_deposit_cash(250) as result",
    );
    const withdrawal = await db.query<{ result: { action: string; amount: number } }>(
      "select public.bank_withdraw_cash(125) as result",
    );
    expect(deposit.rows[0]?.result).toEqual({ action: "deposit", amount: 250 });
    expect(withdrawal.rows[0]?.result).toEqual({ action: "withdraw", amount: 125 });
  });
});

// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const userId = "11111111-1111-4111-8111-111111111111";
const characterId = "22222222-2222-4222-8222-222222222222";
const locationId = "33333333-3333-4333-8333-333333333333";
const walletId = "44444444-4444-4444-8444-444444444444";
const landmarkId = "schedule-test-place";
let db: PGlite;

const action = (start: number, end: number) => ({
  id: "schedule-test-action",
  label: "Read a public guide",
  description: "Read a short fictional guide.",
  time_cost_minutes: 15,
  money_minor: { min: 0, max: 0 },
  mood_effect: 1,
  requirement: "Travel here first",
  open_hours: { start, end },
});

describe("shared map activity schedules", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create table public.locations(
        id uuid primary key, name text not null, description text not null default '',
        is_active boolean not null default true
      );
      create table public.characters(
        id uuid primary key, user_id uuid not null, created_at timestamptz not null default now(),
        current_location_id uuid, is_adult boolean not null default false,
        game_day integer not null default 1, game_time_hour integer not null default 0,
        game_time_minute integer not null default 0, game_weekday integer not null default 0,
        happiness integer not null default 50, hunger integer not null default 50,
        updated_at timestamptz not null default now()
      );
      create table public.map_landmarks(
        id text primary key, district_id text not null, location_id uuid not null,
        is_available boolean not null default true, min_age integer not null default 0
      );
      create table public.wallets(
        id uuid primary key, character_id uuid not null, balance bigint not null,
        total_expenses bigint not null default 0, total_income bigint not null default 0,
        updated_at timestamptz not null default now()
      );
      create table public.map_place_action_receipts(
        character_id uuid not null, request_id uuid not null, landmark_id text not null,
        action_id text not null, response jsonb, created_at timestamptz not null default now(),
        primary key(character_id, request_id)
      );
      create table public.map_landmark_actions(
        landmark_id text not null, id text not null, definition jsonb not null,
        sort_order integer not null default 0, is_active boolean not null default true,
        primary key(landmark_id, id)
      );
      create table public.activities(
        id uuid primary key, name text not null, description text not null default '',
        location_id uuid, is_available boolean not null default true
      );
      create table public.jobs(
        id uuid primary key, name text not null, salary bigint not null default 0,
        location_id uuid, sort_order integer not null default 0, slug text, place_id uuid,
        is_available boolean not null default true
      );
      create table public.character_jobs(
        character_id uuid not null, job_id uuid not null, is_current boolean not null default false
      );
      create table public.game_places(id uuid primary key, location_id uuid);
      create table public.transactions(
        id uuid primary key default gen_random_uuid(), user_id uuid not null, wallet_id uuid not null,
        character_id uuid not null, amount bigint not null, kind text not null, category text not null,
        description text not null
      );
    `);
    await db.exec(
      readFileSync("supabase/migrations/20261101145505_map_activity_schedules.sql", "utf8"),
    );
    await db.query("insert into public.locations(id,name) values($1,'Schedule test location')", [
      locationId,
    ]);
    await db.query(
      `insert into public.characters(id,user_id,current_location_id,is_adult,game_time_hour)
       values($1,$2,$3,true,0)`,
      [characterId, userId, locationId],
    );
    await db.query(
      "insert into public.map_landmarks(id,district_id,location_id) values($1,'test',$2)",
      [landmarkId, locationId],
    );
    await db.query("insert into public.wallets(id,character_id,balance) values($1,$2,1000)", [
      walletId,
      characterId,
    ]);
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("enforces start-inclusive/end-exclusive, overnight, all-day and invalid-hour rules", async () => {
    async function isOpen(definition: unknown, hour: number) {
      const { rows } = await db.query<{ open: boolean | null }>(
        "select public._map_activity_is_open($1::jsonb,$2::integer) as open",
        [JSON.stringify(definition), hour],
      );
      return rows[0]?.open;
    }

    const daytime = { open_hours: { start: 6, end: 21 } };
    expect(await isOpen(daytime, 5)).toBe(false);
    expect(await isOpen(daytime, 6)).toBe(true);
    expect(await isOpen(daytime, 20)).toBe(true);
    expect(await isOpen(daytime, 21)).toBe(false);
    const overnight = { open_hours: { start: 18, end: 3 } };
    expect(await isOpen(overnight, 17)).toBe(false);
    expect(await isOpen(overnight, 18)).toBe(true);
    expect(await isOpen(overnight, 2)).toBe(true);
    expect(await isOpen(overnight, 3)).toBe(false);
    expect(await isOpen({ open_hours: { start: 0, end: 24 } }, 23)).toBe(true);
    expect(await isOpen({ open_hours: { start: 8, end: 8 } }, 2)).toBe(true);
    expect(await isOpen({ open_hours: { start: 6.5, end: 21 } }, 10)).toBeNull();
    expect(await isOpen({ open_hours: { start: 6, end: 25 } }, 10)).toBeNull();
    expect(await isOpen({}, 10)).toBeNull();
  });

  it("projects shared time and rejects closed actions without mutation, then replays receipts after closing", async () => {
    const { rows: clockRows } = await db.query<{
      clock: { day: number; hour: number };
    }>("select public._map_schedule_clock()->'clock' as clock");
    const clock = clockRows[0]!.clock;
    const personalHour = (clock.hour + 12) % 24;
    await db.query("update public.characters set game_time_hour=$1 where id=$2", [
      personalHour,
      characterId,
    ]);

    const { rows: detailsRows } = await db.query<{ result: Record<string, unknown> }>(
      "select public.map_get_landmark_details($1,$2) as result",
      [userId, landmarkId],
    );
    const details = detailsRows[0]!.result;
    const schedule = details["schedule"] as {
      clock: { day: number; hour: number };
      actions: { id: string; open: boolean | null }[];
    };
    expect(schedule.clock.hour).toBe(clock.hour);
    expect(schedule.actions).toEqual([]);
    const afterDetails = await db.query<{
      game_time_hour: number;
      game_time_minute: number;
      balance: number;
      transactions: number;
    }>(
      `select character.game_time_hour, character.game_time_minute, wallet.balance,
        (select count(*)::integer from public.transactions) as transactions
       from public.characters character join public.wallets wallet
         on wallet.character_id=character.id where character.id=$1`,
      [characterId],
    );
    expect(afterDetails.rows[0]).toEqual({
      game_time_hour: personalHour,
      game_time_minute: 0,
      balance: 1000,
      transactions: 0,
    });

    const closedDefinition = action((clock.hour + 1) % 24, (clock.hour + 2) % 24);
    await db.query(
      `insert into public.map_landmark_actions(landmark_id,id,definition)
       values($1,$2,$3::jsonb)`,
      [landmarkId, closedDefinition.id, JSON.stringify(closedDefinition)],
    );
    const closedDetails = await db.query<{ result: Record<string, unknown> }>(
      "select public.map_get_landmark_details($1,$2) as result",
      [userId, landmarkId],
    );
    const closedSchedule = (
      closedDetails.rows[0]!.result["schedule"] as {
        actions: { id: string; open: boolean | null }[];
      }
    )["actions"];
    expect(closedSchedule).toEqual([
      {
        id: closedDefinition.id,
        start: closedDefinition.open_hours.start,
        end: closedDefinition.open_hours.end,
        open: false,
      },
    ]);

    await expect(
      db.query("select public.perform_map_place_action($1,$2,$3,$4,$5::jsonb)", [
        userId,
        landmarkId,
        closedDefinition.id,
        "55555555-5555-4555-8555-555555555555",
        JSON.stringify(action(0, 24)),
      ]),
    ).rejects.toThrow(/PLACE_CLOSED/);
    const afterRejection = await db.query<{ game_time_hour: number; receipts: number }>(
      `select character.game_time_hour,
        (select count(*)::integer from public.map_place_action_receipts) as receipts
       from public.characters character where character.id=$1`,
      [characterId],
    );
    expect(afterRejection.rows[0]?.game_time_hour).toBe(personalHour);
    expect(afterRejection.rows[0]?.receipts).toBe(0);

    const openDefinition = action(0, 24);
    await db.query(
      `update public.map_landmark_actions set definition=$1::jsonb
       where landmark_id=$2 and id=$3`,
      [JSON.stringify(openDefinition), landmarkId, openDefinition.id],
    );
    const requestId = "66666666-6666-4666-8666-666666666666";
    const first = await db.query<{ result: Record<string, unknown> }>(
      "select public.perform_map_place_action($1,$2,$3,$4,'{}'::jsonb) as result",
      [userId, landmarkId, openDefinition.id, requestId],
    );
    const receipt = first.rows[0]!.result;
    const afterAction = await db.query<{
      game_time_hour: number;
      game_time_minute: number;
      happiness: number;
    }>("select game_time_hour,game_time_minute,happiness from public.characters where id=$1", [
      characterId,
    ]);
    expect(afterAction.rows[0]?.game_time_hour).toBe(personalHour);
    expect(afterAction.rows[0]?.game_time_minute).toBe(15);
    expect(afterAction.rows[0]?.happiness).toBe(51);

    await db.query(
      `update public.map_landmark_actions set definition=$1::jsonb
       where landmark_id=$2 and id=$3`,
      [JSON.stringify(closedDefinition), landmarkId, openDefinition.id],
    );
    const replay = await db.query<{ result: Record<string, unknown> }>(
      "select public.perform_map_place_action($1,$2,$3,$4,'{}'::jsonb) as result",
      [userId, landmarkId, openDefinition.id, requestId],
    );
    expect(replay.rows[0]?.result).toEqual(receipt);
    const afterReplay = await db.query<{
      game_time_hour: number;
      game_time_minute: number;
      happiness: number;
      receipts: number;
    }>(
      `select character.game_time_hour, character.game_time_minute, character.happiness,
        (select count(*)::integer from public.map_place_action_receipts) as receipts
       from public.characters character where character.id=$1`,
      [characterId],
    );
    expect(afterReplay.rows[0]).toEqual({
      game_time_hour: personalHour,
      game_time_minute: 15,
      happiness: 51,
      receipts: 1,
    });

    const grants = await db.query<{
      authenticated: boolean;
      service_role: boolean;
      details_authenticated: boolean;
      clock_authenticated: boolean;
    }>(
      `select has_function_privilege('authenticated',
        'public.perform_map_place_action(uuid,text,text,uuid,jsonb)','execute') as authenticated,
       has_function_privilege('service_role',
        'public.perform_map_place_action(uuid,text,text,uuid,jsonb)','execute') as service_role,
       has_function_privilege('authenticated',
        'public.map_get_landmark_details(uuid,text)','execute') as details_authenticated,
       has_function_privilege('authenticated',
        'public._map_schedule_clock()','execute') as clock_authenticated`,
    );
    expect(grants.rows[0]).toEqual({
      authenticated: false,
      service_role: true,
      details_authenticated: false,
      clock_authenticated: false,
    });
  });
});

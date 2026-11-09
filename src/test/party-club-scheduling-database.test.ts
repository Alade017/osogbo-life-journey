// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let db: PGlite;
const userId = "11111111-1111-4111-8111-111111111111";
let characterId: string;
let clubId: string;
let eventCenterId: string;

const user = () => db.query("select set_config('test.user_id',$1,false)", [userId]);
const clock = (time: string) =>
  db.query("update test_party_clock set stamp=$1::timestamp", [`2026-10-26 ${time}:00`]);

async function enter(requestId: string) {
  return (
    await db.query<{ result: { visit_id: string; location_id: string; expires_at: string } }>(
      "select public.enter_club($1::uuid) result",
      [requestId],
    )
  ).rows[0]!.result;
}

async function visitCount() {
  return (
    await db.query<{ count: number }>(
      "select count(*)::int count from public.club_visits where character_id=$1 and ended_at is null",
      [characterId],
    )
  ).rows[0]!.count;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create schema auth;create schema extensions;create schema realtime;
    create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.user_id',true),'')::uuid$$;
    create function realtime.topic() returns text language sql stable as $$select ''::text$$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$begin return;end$$;
    grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);

  for (const file of readdirSync("drizzle/migrations")
    .filter(
      (name) =>
        name.endsWith(".sql") &&
        name !== "0075_remove_orphaned_player_data.sql" &&
        name !== "0077_market_stall_rent_categories_sales.sql",
    )
    .sort()) {
      if (file === "0083_studio_room_layout") {
        // The studio layout migration depends on x/y columns from this Supabase migration.
        await db.exec(
          readFileSync(
            "supabase/migrations/20261102223137_freeform_house_furniture_placement.sql",
            "utf8",
          ),
        );
      }
if (file === "0085_house_floors".sql) {
          // House floors serialize the placement rotation column introduced by this Supabase migration.
          await db.exec(
            readFileSync(
              "supabase/migrations/20261105080000_house_placement_rotation.sql",
              "utf8",
            ),
          );
        }
                await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  }

  for (const file of [
    "20261019100000_party_life.sql",
    "20261019110000_party_clubs_and_activities.sql",
    "20261107190000_party_club_scheduling.sql",
  ]) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  }

  // Replace the shared clock only inside this disposable database. The production RPC
  // continues to read world_clock(), which is backed by the database's Lagos clock.
  await db.exec(`create table public.test_party_clock(stamp timestamp without time zone not null);
    insert into public.test_party_clock values('2026-10-26 17:59:00');
    create or replace function public.world_clock() returns jsonb
    language sql stable set search_path=public as $$
      select jsonb_build_object(
        'hour', extract(hour from stamp)::int,
        'minute', extract(minute from stamp)::int
      ) from public.test_party_clock
    $$;`);

  await db.exec(`insert into auth.users(id) values('${userId}');
    insert into public.profiles(id) values('${userId}');
    insert into public.characters(user_id,name,gender,age,personality)
    values('${userId}','Club Test Player','male',21,'ambitious');`);

  characterId = (
    await db.query<{ id: string }>("select id from public.characters where user_id=$1", [userId])
  ).rows[0]!.id;
  clubId = (
    await db.query<{ location_id: string }>(
      "select location_id from public.party_venues where venue_kind='club' limit 1",
    )
  ).rows[0]!.location_id;
  eventCenterId = (
    await db.query<{ location_id: string }>(
      "select location_id from public.party_venues where venue_kind='event_center' limit 1",
    )
  ).rows[0]!.location_id;
}, 180_000);

beforeEach(async () => {
  await db.exec(
    "reset role;delete from public.club_visits;delete from public.economy_request_results;",
  );
  await db.query(
    "update public.party_venues set opening_hour=18,closing_hour=3 where location_id=$1",
    [clubId],
  );
  await db.query("update public.characters set current_location_id=$1 where id=$2", [
    clubId,
    characterId,
  ]);
  await user();
  await clock("17:59");
});

afterAll(async () => {
  await db?.close();
});

describe("club opening-hours SQL", () => {
  it("backfills clubs to 18:00–03:00 and leaves event centres without club hours", async () => {
    expect(
      (
        await db.query(
          "select opening_hour,closing_hour from public.party_venues where location_id=$1",
          [clubId],
        )
      ).rows[0],
    ).toEqual({ opening_hour: 18, closing_hour: 3 });
    expect(
      (
        await db.query(
          "select opening_hour,closing_hour from public.party_venues where location_id=$1",
          [eventCenterId],
        )
      ).rows[0],
    ).toEqual({ opening_hour: null, closing_hour: null });
  });

  it("rejects entry at 17:59 and creates neither a visit nor a success receipt", async () => {
    await expect(enter("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).rejects.toThrow("closed");
    expect(await visitCount()).toBe(0);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::int count from public.economy_request_results where operation='party_enter_club'",
        )
      ).rows[0]!.count,
    ).toBe(0);
  });

  it("admits entry at 18:00 exactly", async () => {
    await clock("18:00");
    const result = await enter("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    expect(result.location_id).toBe(clubId);
    expect(result.visit_id).toBeTruthy();
    expect(await visitCount()).toBe(1);
  });

  it("keeps the overnight window open at 02:59 and closes it at 03:00 exactly", async () => {
    await clock("02:59");
    const result = await enter("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    expect(result.location_id).toBe(clubId);
    expect(await visitCount()).toBe(1);

    await db.exec("delete from public.club_visits;delete from public.economy_request_results;");
    await clock("03:00");
    await expect(enter("dddddddd-dddd-4ddd-8ddd-dddddddddddd")).rejects.toThrow("closed");
    expect(await visitCount()).toBe(0);
  });

  it("uses the configured venue hours rather than a frontend or venue-specific constant", async () => {
    await db.query(
      "update public.party_venues set opening_hour=19,closing_hour=4 where location_id=$1",
      [clubId],
    );
    await clock("18:30");
    await expect(enter("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee")).rejects.toThrow("closed");
    await clock("19:00");
    expect((await enter("ffffffff-ffff-4fff-8fff-ffffffffffff")).location_id).toBe(clubId);
  });

  it("allows an admitted visitor to continue after closing with a new request", async () => {
    await clock("18:00");
    const first = await enter("11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await clock("03:00");
    const continued = await enter("22222222-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    expect(continued).toEqual(first);
    expect(await visitCount()).toBe(1);
  });

  it("replays a successful entry receipt after closing without creating another visit", async () => {
    await clock("18:00");
    const first = await enter("33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    await clock("03:00");
    expect(await enter("33333333-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).toEqual(first);
    expect(await visitCount()).toBe(1);
  });

  it("does not apply club hours to event centres", async () => {
    await db.query("update public.characters set current_location_id=$1 where id=$2", [
      eventCenterId,
      characterId,
    ]);
    await expect(enter("44444444-aaaa-4aaa-8aaa-aaaaaaaaaaaa")).rejects.toThrow("Travel to a club");
  });

  it("rejects ambiguous schedules and non-null event-centre hours", async () => {
    await expect(
      db.query("update public.party_venues set closing_hour=opening_hour where location_id=$1", [
        clubId,
      ]),
    ).rejects.toThrow();
    await expect(
      db.query("update public.party_venues set opening_hour=18 where location_id=$1", [
        eventCenterId,
      ]),
    ).rejects.toThrow();
  });
});

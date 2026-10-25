// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFileSync, readdirSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { CityEventSnapshot } from "@/lib/city-event-service";
const uid = "11111111-1111-4111-8111-111111111111",
  other = "33333333-3333-4333-8333-333333333333";
let db: PGlite;
const migration = "supabase/migrations/20261025095803_weekly_city_events.sql";
async function clock(value: string) {
  await db.query("update public.test_event_clock set stamp=$1::timestamptz", [value]);
}
async function snapshot() {
  return (await db.query<{ value: CityEventSnapshot }>("select public.get_city_events() as value"))
    .rows[0]!.value;
}
async function join(id: string) {
  return (
    await db.query<{ value: { joined: boolean; duplicate: boolean } }>(
      "select public.join_city_event_occurrence($1::uuid) as value",
      [id],
    )
  ).rows[0]!.value;
}
async function here(slug = "town-market") {
  await db.query(
    "update public.characters set current_location_id=(select id from public.locations where slug=$1) where user_id=auth.uid()",
    [slug],
  );
}
async function state() {
  return (
    await db.query(
      "select id,xp,happiness,energy,hunger,social,reputation from public.characters where user_id=auth.uid()",
    )
  ).rows;
}
beforeAll(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create schema extensions; create schema realtime;
    create table auth.users(id uuid primary key,is_anonymous boolean not null default false);
    create table realtime.messages(id bigint generated always as identity);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id',true),'')::uuid $$;
    create function realtime.topic() returns text language sql stable as $$ select ''::text $$;
    create function realtime.broadcast_changes(text,text,text,text,text,anyelement,anyelement) returns void language plpgsql as $$ begin return; end $$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for (const file of readdirSync("drizzle/migrations")
    .filter((f) => f.endsWith(".sql") && f !== "0075_remove_orphaned_player_data.sql")
    .sort())
    await db.exec(readFileSync(`drizzle/migrations/${file}`, "utf8"));
  await db.exec(readFileSync("supabase/migrations/20261025092415_daily_life_tasks.sql", "utf8"));
  await db.exec(
    readFileSync("supabase/migrations/20261022000000_expanded_town_places.sql", "utf8"),
  );
  await db.exec(readFileSync(migration, "utf8"));
  // Only the disposable database substitutes the clock. No production override exists.
  await db.exec(`create table public.test_event_clock(stamp timestamptz not null);
    insert into public.test_event_clock values('2026-10-28T08:00:00Z');
    create function public.test_event_now() returns timestamptz language sql volatile as $$ select stamp from public.test_event_clock $$;`);
  for (const signature of [
    "public.get_city_events()",
    "public._join_city_event_occurrence(text,uuid)",
  ]) {
    const result = await db.query<{ definition: string }>(
      "select pg_get_functiondef($1::regprocedure) as definition",
      [signature],
    );
    await db.exec(
      result.rows[0]!.definition.replaceAll("clock_timestamp()", "public.test_event_now()"),
    );
  }
  await db.exec(`insert into auth.users(id) values('${uid}'),('${other}');
    insert into public.profiles(id) values('${uid}'),('${other}');
    insert into public.characters(user_id,name,gender,age,personality) values
      ('${uid}','Ade','male',21,'ambitious'),('${other}','Bisi','female',21,'creative');`);
}, 180_000);
beforeEach(async () => {
  await db.exec(`reset role; select set_config('test.user_id','${uid}',false);
    delete from public.city_event_participation; delete from public.city_event_occurrences;
    update auth.users set is_anonymous=false;
    update public.locations set is_active=true where slug in ('town-market','youth-arts-centre');
    update public.map_landmarks set is_available=true where id in ('town-market','youth-arts-centre');`);
  await clock("2026-10-28T08:00:00Z");
  await here();
});
afterAll(async () => {
  await db?.close();
});
describe("server weekly event acceptance", () => {
  it("stores six stable shared occurrences with fictional venues and no duplicate reads", async () => {
    const first = await snapshot();
    expect(first.events).toHaveLength(6);
    expect(first.events[0]).toMatchObject({
      id: "market-day",
      status: "active",
      locationSlug: "town-market",
      districtId: "market-quarter",
      title: "Town Market Day",
    });
    await snapshot();
    expect((await db.query("select * from public.city_event_occurrences")).rows).toHaveLength(6);
    await db.exec(`select set_config('test.user_id','${other}',false)`);
    expect(await snapshot()).toEqual(first);
  });
  it("opens exactly at start and closes exactly at expiry", async () => {
    await clock("2026-10-28T07:59:59Z");
    const before = await snapshot();
    const market = before.events[0]!;
    expect(market.status).toBe("upcoming");
    await expect(join(market.occurrenceId)).rejects.toThrow(/not active/);
    await clock("2026-10-28T08:00:00Z");
    expect((await snapshot()).events[0]!.status).toBe("active");
    await clock("2026-10-28T14:59:59Z");
    expect((await join(market.occurrenceId)).joined).toBe(true);
    await clock("2026-10-28T15:00:00Z");
    await expect(join(market.occurrenceId)).rejects.toThrow(/not active/);
    expect((await snapshot()).events.some((e) => e.occurrenceId === market.occurrenceId)).toBe(
      false,
    );
  });
  it("persists own attendance, preserves the legacy RPC and changes no player stats or wallet", async () => {
    const event = (await snapshot()).events[0]!;
    const before = await state();
    const wallets = await db.query("select * from public.wallets order by character_id");
    expect(await join(event.occurrenceId)).toEqual({ joined: true, duplicate: false });
    expect(await join(event.occurrenceId)).toEqual({ joined: true, duplicate: true });
    expect(
      (
        await db.query<{ v: { duplicate: boolean } }>(
          "select public.join_city_event('market-day') as v",
        )
      ).rows[0]!.v.duplicate,
    ).toBe(true);
    expect((await snapshot()).events[0]!.joined).toBe(true);
    expect(await state()).toEqual(before);
    expect((await db.query("select * from public.wallets order by character_id")).rows).toEqual(
      wallets.rows,
    );
    await db.exec(`select set_config('test.user_id','${other}',false)`);
    expect((await snapshot()).events[0]!.joined).toBe(false);
  });
  it("rejects wrong locations, unknown IDs and inactive venues", async () => {
    const event = (await snapshot()).events[0]!;
    await here("youth-arts-centre");
    await expect(join(event.occurrenceId)).rejects.toThrow(/Travel/);
    await expect(db.query("select public.join_city_event('invented')")).rejects.toThrow(/Unknown/);
    await expect(join(crypto.randomUUID())).rejects.toThrow(/Unknown/);
    await here();
    await db.exec("update public.locations set is_active=false where slug='town-market'");
    expect((await snapshot()).events[0]!.status).toBe("unavailable");
    await expect(join(event.occurrenceId)).rejects.toThrow(/unavailable/);
  });
  it("uses Lagos week rollover and rejects last week's token in a new active window", async () => {
    const old = (await snapshot()).events[0]!;
    await clock("2026-11-01T22:59:59Z");
    await snapshot();
    await clock("2026-11-01T23:00:00Z");
    const next = await snapshot();
    expect(next.events).toHaveLength(6);
    expect(next.events[0]!.startsAt).toContain("2026-11-04");
    await clock("2026-11-04T08:00:00Z");
    await expect(join(old.occurrenceId)).rejects.toThrow(/ended/);
    expect((await join(next.events[0]!.occurrenceId)).joined).toBe(true);
  });
  it("cancels outdoor heavy-rain events but keeps indoor events available", async () => {
    // Test-only weather stub: production uses the existing trusted weather function.
    const original = (
      await db.query<{ definition: string }>(
        "select pg_get_functiondef('public.world_weather_for_day(integer)'::regprocedure) as definition",
      )
    ).rows[0]!.definition;
    await db.exec(
      "create or replace function public.world_weather_for_day(p_day integer) returns text language sql immutable as $$ select 'heavy-rain'::text $$",
    );
    try {
      const market = (await snapshot()).events[0]!;
      expect(market.status).toBe("cancelled");
      await expect(join(market.occurrenceId)).rejects.toThrow(/heavy rain/);
      await clock("2026-10-30T16:00:00Z");
      await here("youth-arts-centre");
      const indoor = (await snapshot()).events.find((e) => e.id === "riverlight-gathering")!;
      expect(indoor.status).toBe("active");
      expect((await join(indoor.occurrenceId)).joined).toBe(true);
    } finally {
      await db.exec(original);
    }
  });
  it("enforces RLS, registered identity and private helper/direct-write restrictions", async () => {
    const event = (await snapshot()).events[0]!;
    await join(event.occurrenceId);
    await db.exec(`select set_config('test.user_id','${other}',false); set role authenticated`);
    expect((await db.query("select * from public.city_event_participation")).rows).toHaveLength(0);
    expect((await db.query("select * from public.city_event_occurrences")).rows).toHaveLength(6);
    await expect(db.exec("update public.city_event_catalog set enabled=false")).rejects.toThrow(
      /permission denied/,
    );
    await expect(db.exec("delete from public.city_event_occurrences")).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      db.exec(
        "insert into public.city_event_participation(character_id,event_id,world_day) values((select id from public.characters where user_id=auth.uid()),'market-day',301)",
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(db.exec("select public._ensure_city_event_occurrences(now())")).rejects.toThrow(
      /permission denied/,
    );
    await db.exec(`reset role; update auth.users set is_anonymous=true where id='${other}'`);
    await expect(snapshot()).rejects.toThrow(/registered/);
    await expect(join(event.occurrenceId)).rejects.toThrow(/registered/);
    await db.exec("select set_config('test.user_id','',false)");
    await expect(snapshot()).rejects.toThrow(/registered/);
    await db.exec("set role anon");
    await expect(snapshot()).rejects.toThrow(/permission denied/);
  });
  it("preserves materialized history and old participation when catalog hours change", async () => {
    const first = (await snapshot()).events[0]!;
    await join(first.occurrenceId);
    await db.exec("update public.city_event_catalog set start_hour=10 where id='market-day'");
    try {
      expect((await snapshot()).events[0]!.startsAt).toBe(first.startsAt);
      expect((await snapshot()).events[0]!.joined).toBe(true);
    } finally {
      await db.exec("update public.city_event_catalog set start_hour=9 where id='market-day'");
    }
  });
});

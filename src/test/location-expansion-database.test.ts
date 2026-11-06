// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migration = "supabase/migrations/20261105090000_expand_east_map_destinations.sql";
let db: PGlite;

describe("east map destination migration", () => {
  beforeAll(async () => {
    db = new PGlite();
    await db.exec(`
      create table public.locations (
        id uuid primary key default gen_random_uuid(),
        slug text unique not null,
        name text not null,
        tagline text not null,
        description text not null,
        district_type text not null,
        map_x integer not null,
        map_y integer not null,
        color text not null,
        planned_features text[] not null,
        sort_order integer not null,
        type text not null check (type in (
          'government','market','shop','restaurant','bank','hospital','police',
          'school','university','entertainment','transport','residential',
          'workplace','landmark','custom'
        )),
        latitude double precision,
        longitude double precision,
        icon text not null,
        is_active boolean not null,
        level_required integer not null,
        metadata jsonb not null,
        map_coordinate_mode text not null,
        travel_fare bigint not null,
        travel_minutes integer not null,
        canvas_x double precision not null,
        canvas_y double precision not null,
        map_category text not null,
        neighbor_slugs text[] not null,
        job_contract_slugs text[] not null,
        entry_loops text[] not null
      );
      create table public.map_districts (
        id text primary key,
        name text not null,
        layout_x integer not null,
        layout_y integer not null
      );
      insert into public.map_districts(id,name,layout_x,layout_y) values
        ('river-quarter','River quarter',560,0),
        ('east-gate','East gate',560,400),
        ('market-quarter','Market quarter',0,0);
      create table public.map_landmarks (
        id text primary key,
        district_id text not null references public.map_districts(id),
        location_id uuid references public.locations(id),
        min_age integer not null default 0,
        is_available boolean not null default true
      );
      create table public.map_location_districts (
        location_id uuid primary key references public.locations(id),
        district_id text not null references public.map_districts(id)
      );
      create table public.map_district_distances (
        from_district_id text not null references public.map_districts(id),
        to_district_id text not null references public.map_districts(id),
        distance_m integer not null,
        primary key(from_district_id,to_district_id)
      );
    `);
    await db.exec(readFileSync(migration, "utf8"));
  }, 60_000);

  afterAll(async () => {
    await db?.close();
  });

  it("creates four active, travel-linked public destinations with complete route distances", async () => {
    const destinations = await db.query<{
      slug: string;
      landmark_id: string;
      district_id: string;
      is_available: boolean;
    }>(`
      select location.slug, landmark.id as landmark_id, mapping.district_id, landmark.is_available
      from public.locations location
      join public.map_landmarks landmark on landmark.location_id=location.id
      join public.map_location_districts mapping on mapping.location_id=location.id
      order by location.slug
    `);
    expect(destinations.rows).toEqual([
      {
        slug: "adire-makers-yard",
        landmark_id: "adire-makers-yard",
        district_id: "east-gate",
        is_available: true,
      },
      {
        slug: "east-transit-terminal",
        landmark_id: "east-transit-terminal",
        district_id: "river-quarter",
        is_available: true,
      },
      {
        slug: "eastside-produce-coop",
        landmark_id: "eastside-produce-coop",
        district_id: "river-quarter",
        is_available: true,
      },
      {
        slug: "neighborhood-play-park",
        landmark_id: "neighborhood-play-park",
        district_id: "east-gate",
        is_available: true,
      },
    ]);

    const routes = await db.query<{ count: number }>(
      "select count(*)::int as count from public.map_district_distances",
    );
    expect(routes.rows[0]?.count).toBe(9);
  });

  it("can safely reapply its seed data without duplicating destinations", async () => {
    await db.exec(readFileSync(migration, "utf8"));
    const counts = await db.query<{ locations: number; landmarks: number; mappings: number }>(`
      select
        (select count(*)::int from public.locations) as locations,
        (select count(*)::int from public.map_landmarks) as landmarks,
        (select count(*)::int from public.map_location_districts) as mappings
    `);
    expect(counts.rows[0]).toEqual({ locations: 4, landmarks: 4, mappings: 4 });
  });
});

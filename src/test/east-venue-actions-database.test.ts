// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import townData from "@/data/osogbo-town.json";

const migration = "supabase/migrations/20261106120000_east_venue_actions.sql";
const tasksMigration = "supabase/migrations/20261106120200_east_venue_tasks.sql";
const venueIds = [
  "east-transit-terminal",
  "eastside-produce-coop",
  "adire-makers-yard",
  "neighborhood-play-park",
];

let db: PGlite;

describe("east venue action seed migration", () => {
  beforeAll(async () => {
    db = new PGlite();
    // Minimal shape of the tables the seed writes to (see drizzle 0073 and the east venue migration).
    await db.exec(`
      create table public.map_landmarks (id text primary key);
      create table public.map_landmark_actions (
        landmark_id text not null references public.map_landmarks(id) on delete cascade,
        id text not null,
        definition jsonb not null,
        sort_order integer not null default 0,
        is_active boolean not null default true,
        primary key (landmark_id, id),
        constraint map_landmark_actions_id_matches check (definition->>'id' = id)
      );
    `);
    await db.exec(
      `insert into public.map_landmarks (id) values ${venueIds.map((id) => `('${id}')`).join(",")};`,
    );
    const sql = readFileSync(migration, "utf8");
    await db.exec(sql);
    await db.exec(sql); // a second run must be a no-op
    await db.exec(readFileSync(tasksMigration, "utf8"));
  }, 30_000);

  afterAll(async () => {
    await db.close();
  });

  it("seeds exactly one active action per east venue", async () => {
    const result = await db.query<{ landmark_id: string; count: number }>(
      `select landmark_id, count(*)::int as count from public.map_landmark_actions
       where is_active group by landmark_id order by landmark_id`,
    );
    expect(result.rows).toEqual(
      venueIds
        .map((id) => ({ landmark_id: id, count: 1 }))
        .sort((a, b) => a.landmark_id.localeCompare(b.landmark_id)),
    );
  });

  it("stores the same definitions as the client catalogue", async () => {
    for (const id of venueIds) {
      const place = townData.landmarks.find((landmark) => landmark.id === id);
      expect(place, id).toBeDefined();
      const row = await db.query<{ definition: unknown }>(
        `select definition from public.map_landmark_actions where landmark_id = $1`,
        [id],
      );
      expect(row.rows[0]?.definition).toEqual(place?.actions[0]);
    }
  });
});

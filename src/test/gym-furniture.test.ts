import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20261108120000_gym_furniture_items.sql"),
  "utf8",
);

const GYM_ITEMS = [
  "treadmill",
  "multi-gym-machine",
  "dumbbells",
  "yoga-mat",
  "dumbbell-rack",
  "full-length-gym-mirror",
  "gym-bag",
];

describe("gym furniture catalogue", () => {
  it.each(GYM_ITEMS)("seeds %s as a priced fitness furniture item", (id) => {
    const row = new RegExp(`\\('${id}','furniture','fitness','${id}',\\d+,true,false\\)`);
    expect(migration).toMatch(row);
  });

  it("seeds no item outside the gym list", () => {
    const ids = [...migration.matchAll(/\('([a-z-]+)','furniture'/g)].map((m) => m[1]);
    expect(ids.sort()).toEqual([...GYM_ITEMS].sort());
  });
});

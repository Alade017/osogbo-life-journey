import { describe, expect, it } from "vitest";
import { WORSHIP_LAYOUTS, getWorshipLayout } from "@/game/worship-layouts";

const SLUGS = ["osogbo-central-mosque", "osogbo-grand-mosque", "oke-fia-community-church"];

describe("worship interiors", () => {
  it("has one layout for each worship place", () => {
    expect(WORSHIP_LAYOUTS.map((layout) => layout.slug).sort()).toEqual([...SLUGS].sort());
    for (const slug of SLUGS) expect(getWorshipLayout(slug)).not.toBeNull();
    expect(getWorshipLayout("town-market")).toBeNull();
  });

  it("gives every place a different hall", () => {
    const sizes = WORSHIP_LAYOUTS.map((layout) => `${layout.hall.width}x${layout.hall.depth}`);
    expect(new Set(sizes).size).toBe(WORSHIP_LAYOUTS.length);
  });

  it("keeps every point inside the hall, away from the walls", () => {
    for (const layout of WORSHIP_LAYOUTS) {
      const halfW = layout.hall.width / 2 - 0.6;
      const halfD = layout.hall.depth / 2 - 0.6;
      const inside = ([x, z]: readonly [number, number]) =>
        Math.abs(x) <= halfW && Math.abs(z) <= halfD;
      const points = [
        layout.prayerSpot,
        layout.spawn,
        ...layout.congregation,
        ...layout.columns,
        ...layout.rows.flatMap((row) => row.xs.map((x) => [x, row.z] as const)),
        [layout.focal.x, layout.focal.z] as const,
      ];
      for (const point of points) expect(inside(point), `${layout.slug} ${point}`).toBe(true);
    }
  });

  it("starts the visitor at the entrance and prays in front of the focal point", () => {
    for (const layout of WORSHIP_LAYOUTS) {
      expect(layout.spawn[1]).toBeGreaterThan(layout.prayerSpot[1]);
      expect(layout.prayerSpot[1]).toBeGreaterThan(layout.focal.z);
    }
  });
});

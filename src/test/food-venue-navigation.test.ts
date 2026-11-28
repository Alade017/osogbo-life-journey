import { describe, expect, it } from "vitest";
import type { VenueFixture } from "@/lib/location-venue-designs";
import { foodVenueNavigation } from "@/game/food-venue-navigation";

const fixture = (id: string, kind: VenueFixture["kind"], x: number, z: number): VenueFixture => ({
  id, label: id, detail: id, kind, position: [x, z],
});
const layouts = [
  { variant: "buka" as const, fixtures: [fixture("counter", "counter", 0, -2.6), fixture("table", "table", 0, 1.2), fixture("wash", "display", -4.2, 0.5)] },
  { variant: "courtyard" as const, fixtures: [fixture("counter", "counter", -2.7, -1.3), fixture("table", "table", 0, 0.8), fixture("planter", "planter", 2.8, -0.6)] },
];
describe("food venue navigation", () => {
  it("spawns in a walkable entrance area and routes to each fixture approach", () => {
    for (const { variant, fixtures } of layouts) {
      const nav = foodVenueNavigation(variant, fixtures);
      const spawn: readonly [number, number] = [nav.spawn[0], nav.spawn[2]];
      expect(nav.canWalk(spawn)).toBe(true);
      for (const item of fixtures) {
        const path = nav.approach(spawn, item);
        expect(path).not.toBeNull();
        for (const point of path ?? []) expect(nav.canWalk(point)).toBe(true);
      }
    }
  });
  it("rejects fixture footprints and points outside the room", () => {
    for (const { variant, fixtures } of layouts) {
      const nav = foodVenueNavigation(variant, fixtures);
      for (const item of fixtures) expect(nav.canWalk(item.position)).toBe(false);
      expect(nav.canWalk([100, 100])).toBe(false);
      expect(nav.route([nav.spawn[0], nav.spawn[2]], [100, 100])).toBeNull();
    }
  });
  it("resolves floor taps on counters and tables to a walkable nearby point", () => {
    for (const { variant, fixtures } of layouts) {
      const nav = foodVenueNavigation(variant, fixtures);
      for (const item of fixtures) {
        const target = nav.nearest(item.position);
        expect(target).not.toBeNull();
        if (target) expect(nav.canWalk(target)).toBe(true);
      }
    }
  });
});

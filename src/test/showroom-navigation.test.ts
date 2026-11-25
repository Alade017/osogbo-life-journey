import { describe, expect, it } from "vitest";
import { getShowroomModels } from "@/data/showroom-models";
import { createShowroomLayout, showroomNavigation, showroomExteriorRoute } from "@/game/showroom-navigation";
import { electronicsDisplays, electronicsNavigation, electronicsExteriorRoute, electronicsExteriorCanWalk, RETAIL_EXTERIOR, RETAIL_ROOM } from "@/game/electronics-navigation";
import type { WalkPoint } from "@/game/grid-walk-path";

function assertClearPath(path: WalkPoint[] | null, canWalk: (point: WalkPoint) => boolean) {
  expect(path).not.toBeNull();
  for (const [index, point] of (path ?? []).entries()) {
    expect(canWalk(point)).toBe(true);
    if (index === 0) continue;
    const previous = path![index - 1]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(point[0] - previous[0], point[1] - previous[1]) / 0.1));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      expect(canWalk([previous[0] * (1 - t) + point[0] * t, previous[1] * (1 - t) + point[1] * t])).toBe(true);
    }
  }
}

describe("commercial venue navigation", () => {
  for (const slug of ["fuel-station", "cinema-event-hall"] as const) {
    it(`reaches every registered vehicle and returns to the entrance: ${slug}`, () => {
      const models = getShowroomModels(slug);
      const layout = createShowroomLayout(models.length);
      const nav = showroomNavigation(layout);
      expect(layout.bays).toHaveLength(models.length);
      expect(showroomExteriorRoute(layout.exteriorSpawn, layout.exteriorDoor, layout)).not.toBeNull();
      for (const [index, bay] of layout.bays.entries()) {
        expect(nav.canWalk([bay.x, bay.z])).toBe(false);
        const path = nav.approach(layout.entrance, index);
        assertClearPath(path, nav.canWalk);
        const target = path?.at(-1);
        expect(target).toBeDefined();
        if (target) assertClearPath(nav.route(target, layout.entrance), nav.canWalk);
      }
      expect(nav.approach(layout.entrance, models.length)).toBeNull();
    });
  }
  for (const slug of ["post-office-cafe", "harvest-tech-hub"] as const) {
    it(`reaches every registered product and returns to the doorway: ${slug}`, () => {
      const products = getShowroomModels(slug);
      const displays = electronicsDisplays(products.length);
      const nav = electronicsNavigation(displays);
      for (const [index, display] of displays.entries()) {
        expect(nav.canWalk([display.x, display.z])).toBe(false);
        const path = nav.approach(RETAIL_ROOM.spawn, index);
        assertClearPath(path, nav.canWalk);
        const target = path?.at(-1);
        expect(target).toBeDefined();
        if (target) assertClearPath(nav.route(target, RETAIL_ROOM.doorway), nav.canWalk);
      }
      expect(nav.approach(RETAIL_ROOM.spawn, products.length)).toBeNull();
    });
  }
});

describe("commercial exterior navigation", () => {
  it("connects the electronics forecourt to the doorway in both directions", () => {
    assertClearPath(electronicsExteriorRoute(RETAIL_EXTERIOR.spawn, RETAIL_EXTERIOR.door), electronicsExteriorCanWalk);
    assertClearPath(electronicsExteriorRoute(RETAIL_EXTERIOR.door, RETAIL_EXTERIOR.spawn), electronicsExteriorCanWalk);
    const nav = electronicsNavigation(electronicsDisplays(getShowroomModels("post-office-cafe").length));
    assertClearPath(nav.route(RETAIL_ROOM.doorway, RETAIL_ROOM.spawn), nav.canWalk);
    expect(RETAIL_EXTERIOR.threshold).toEqual([0, RETAIL_ROOM.depth / 2]);
    expect(electronicsExteriorRoute(RETAIL_EXTERIOR.spawn, RETAIL_EXTERIOR.threshold)).toBeNull();
    expect(electronicsExteriorRoute(RETAIL_EXTERIOR.spawn, [0, RETAIL_EXTERIOR.spawn[1] + RETAIL_EXTERIOR.depth])).toBeNull();
    expect(electronicsExteriorRoute(RETAIL_EXTERIOR.spawn, [RETAIL_ROOM.width, RETAIL_EXTERIOR.spawn[1]])).toBeNull();
    expect(electronicsExteriorRoute(RETAIL_EXTERIOR.spawn, [NaN, 0])).toBeNull();
  });
  for (const slug of ["fuel-station", "cinema-event-hall"] as const) {
    it(`keeps exterior walking separate from the doorway crossing: ${slug}`, () => {
      const layout = createShowroomLayout(getShowroomModels(slug).length);
      expect(showroomExteriorRoute(layout.exteriorDoor, layout.exteriorSpawn, layout)).not.toBeNull();
      expect(layout.threshold).toEqual([0, layout.depth / 2]);
      expect(showroomExteriorRoute(layout.exteriorSpawn, layout.threshold, layout)).toBeNull();
      expect(showroomExteriorRoute(layout.exteriorSpawn, [layout.width, layout.exteriorSpawn[1]], layout)).toBeNull();
      expect(showroomExteriorRoute(layout.exteriorSpawn, [0, layout.exteriorSpawn[1] + 1], layout)).toBeNull();
      expect(showroomNavigation(layout).canWalk(layout.entrance)).toBe(true);
    });
  }
});

import { describe, expect, it } from "vitest";
import {
  courierRoute,
  headingBetween,
  pointAlongRoute,
  routeLength,
} from "@/components/game/housing/courier-walk";
import type { RoomObstacle } from "@/game/house-navigation";

describe("courier walk", () => {
  it("measures a route and reports the heading of each step", () => {
    const route: [number, number, number][] = [
      [0, 0.06, 0],
      [2, 0.06, 0],
      [2, 0.06, 3],
    ];
    expect(routeLength(route)).toBeCloseTo(5);
    expect(headingBetween(route[0]!, route[1]!)).toBe("east");
    expect(headingBetween(route[1]!, route[2]!)).toBe("south");
  });

  it("places the courier partway along the route and turns with each leg", () => {
    const route: [number, number, number][] = [
      [0, 0.06, 0],
      [2, 0.06, 0],
      [2, 0.06, 3],
    ];
    expect(pointAlongRoute(route, 1).point[0]).toBeCloseTo(1);
    expect(pointAlongRoute(route, 1).heading).toBe("east");
    const later = pointAlongRoute(route, 3.5);
    expect(later.point[0]).toBeCloseTo(2);
    expect(later.point[2]).toBeCloseTo(1.5);
    expect(later.heading).toBe("south");
  });

  it("stops at the end of the route", () => {
    const route: [number, number, number][] = [
      [0, 0.06, 0],
      [0, 0.06, 2],
    ];
    expect(pointAlongRoute(route, 99).point).toEqual([0, 0.06, 2]);
  });

  it("walks around furniture instead of through it", () => {
    const sofa: RoomObstacle = { x: 0, z: 0, w: 2, d: 0.8 };
    const route = courierRoute([0, 0.06, -2], [0, 0.06, 2], 6, 6, [sofa]);
    expect(route.length).toBeGreaterThan(2);
    for (const [x, , z] of route.slice(1, -1)) {
      const inside = Math.abs(x - sofa.x) < sofa.w / 2 && Math.abs(z - sofa.z) < sofa.d / 2;
      expect(inside).toBe(false);
    }
  });
});

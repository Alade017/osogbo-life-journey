import { describe, expect, it } from "vitest";
import {
  CITY_DISTRICTS,
  CITY_ROAD_EDGES,
  CITY_ROAD_NODES,
  cityDistrictForLocation,
  cityEntranceForLocation,
  cityIsoDiamond,
  cityWorldToIso,
  findCityRoadPath,
  nearestCityRoadNode,
  stableCityOffset,
} from "@/lib/city-world";

describe("fictional city world model", () => {
  it("projects stable world coordinates into an isometric scene", () => {
    expect(cityWorldToIso({ x: 7, y: 5 })).toEqual({ x: 562, y: 298 });
    expect(cityWorldToIso({ x: 7, y: 5 }, 18).y).toBe(280);
    expect(cityIsoDiamond({ x: 7, y: 5 }, { x: 2, y: 1 })).toHaveLength(4);
  });

  it("defines connected road edges and routes around closed segments", () => {
    expect(CITY_ROAD_NODES.length).toBe(195);
    expect(CITY_ROAD_EDGES.length).toBeGreaterThan(300);
    const route = findCityRoadPath({ x: 3, y: 4 }, { x: 9, y: 8 });
    expect(route?.[0]).toEqual({ x: 3, y: 4 });
    expect(route?.at(-1)).toEqual({ x: 9, y: 8 });
    expect(route?.length).toBeGreaterThan(2);
    expect(
      route?.some(
        (point, index) =>
          index > 0 && point.x === route[index - 1]!.x && point.y === route[index - 1]!.y,
      ),
    ).toBe(false);
  });

  it("uses a deterministic nearest road node and location-specific spawn", () => {
    expect(nearestCityRoadNode({ x: 2.4, y: 8.6 })).toBe("road-2-9");
    expect(cityEntranceForLocation("oja-oba")).toEqual({ x: 3, y: 5 });
    expect(cityDistrictForLocation("student-district")).toBe("university");
    expect(cityEntranceForLocation("legacy-unknown")).toEqual({ x: 7, y: 6 });
  });

  it("keeps fallback district and building placement stable across reloads", () => {
    expect(CITY_DISTRICTS).toHaveLength(9);
    expect(stableCityOffset("market_stall_01")).toEqual(stableCityOffset("market_stall_01"));
    expect(stableCityOffset("market_stall_01")).not.toEqual(stableCityOffset("market_stall_02"));
  });
});

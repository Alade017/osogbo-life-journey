import { describe, expect, it } from "vitest";
import {
  CITY_WORLD_BOUNDS,
  CITY_DISTRICTS,
  OSOGBO_WORLD_NODES,
  CITY_ROAD_EDGES,
  CITY_ROAD_NODES,
  cityDistrictForLocation,
  cityEntranceForLocation,
  cityIsoDiamond,
  cityPositionForRecord,
  cityEntranceForRecord,
  cityWorldToIso,
  findCityRoadPath,
  nearestCityRoadNode,
  stableCityOffset,
} from "@/lib/city-world";
import townData from "@/data/osogbo-town.json";

describe("fictional city world model", () => {
  it("defines all blueprint destinations with normalized anchors and valid connections", () => {
    const nodes = Object.values(OSOGBO_WORLD_NODES);
    const slugs = new Set(nodes.map((node) => node.slug));
    expect(nodes).toHaveLength(23);
    expect(slugs.size).toBe(nodes.length);
    for (const node of nodes) {
      expect(node.anchor.x).toBeGreaterThanOrEqual(0);
      expect(node.anchor.x).toBeLessThanOrEqual(1);
      expect(node.anchor.y).toBeGreaterThanOrEqual(0);
      expect(node.anchor.y).toBeLessThanOrEqual(1);
      expect(node.neighbors.length).toBeGreaterThan(0);
      expect(node.neighbors.every((neighbor) => slugs.has(neighbor))).toBe(true);
      expect(node.world.x).toBeGreaterThanOrEqual(0);
      expect(node.world.x).toBeLessThanOrEqual(CITY_WORLD_BOUNDS.maxX);
      expect(node.world.y).toBeGreaterThanOrEqual(0);
      expect(node.world.y).toBeLessThanOrEqual(CITY_WORLD_BOUNDS.maxY);
    }
    expect(OSOGBO_WORLD_NODES["old-garage"].jobContracts).toContain("driver_rider");
    expect(OSOGBO_WORLD_NODES["government-area"].entryLoops).toContain("work");
    expect(OSOGBO_WORLD_NODES["state-hospital"].entryLoops).toContain("recover");
  });

  it("keeps every published location ID stable", () => {
    expect(Object.keys(OSOGBO_WORLD_NODES).sort()).toEqual(
      [
        "airport-terminal",
        "atiku",
        "city-centre",
        "cultural-district",
        "government-area",
        "industrial-area",
        "isale-osun",
        "oja-oba",
        "oke-baale",
        "oke-fia",
        "old-garage",
        "rural-outskirts",
        "stadium",
        "riverside-food-court",
        "sunrise-health-post",
        "harvest-tech-hub",
        "old-town-library",
        "east-transit-terminal",
        "eastside-produce-coop",
        "adire-makers-yard",
        "neighborhood-play-park",
        "state-hospital",
        "student-district",
      ].sort(),
    );
    for (const [id, node] of Object.entries(OSOGBO_WORLD_NODES)) {
      expect(node.slug).toBe(id);
    }
  });

  it("projects stable world coordinates into an isometric scene", () => {
    expect(cityWorldToIso({ x: 7, y: 5 })).toEqual({ x: 562, y: 298 });
    expect(cityWorldToIso({ x: 7, y: 5 }, 18).y).toBe(280);
    expect(cityIsoDiamond({ x: 7, y: 5 }, { x: 2, y: 1 })).toHaveLength(4);
  });

  it("defines connected road edges and routes around closed segments", () => {
    expect(CITY_ROAD_NODES.length).toBe(357);
    expect(CITY_ROAD_EDGES.length).toBeGreaterThan(650);
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

  it("uses configured map coordinates for newly added location records", () => {
    const location = { slug: "new-waterfront-park", map_x: 41, map_y: 62 };
    expect(cityPositionForRecord(location)).toEqual({ x: 8.2, y: 9.92 });
    expect(cityEntranceForRecord(location)).toEqual({ x: 8.2, y: 9.92 });
    expect(cityPositionForRecord({ ...location, canvas_x: 0.1, canvas_y: 0.2 })).toEqual({
      x: 2,
      y: 3.2,
    });
    expect(cityPositionForRecord({ slug: "oja-oba", map_x: 0, map_y: 0 })).toEqual({ x: 3, y: 4 });
  });

  it("keeps fallback district and building placement stable across reloads", () => {
    expect(CITY_DISTRICTS).toHaveLength(11);
    expect(stableCityOffset("market_stall_01")).toEqual(stableCityOffset("market_stall_01"));
    expect(stableCityOffset("market_stall_01")).not.toEqual(stableCityOffset("market_stall_02"));
  });

  it("connects the east-side map landmarks to the extended world network", () => {
    const mapLocationSlugs = new Set(townData.landmarks.map((landmark) => landmark.locationSlug));
    for (const slug of [
      "riverside-food-court",
      "sunrise-health-post",
      "harvest-tech-hub",
      "old-town-library",
      "east-transit-terminal",
      "eastside-produce-coop",
      "adire-makers-yard",
      "neighborhood-play-park",
    ]) {
      expect(mapLocationSlugs.has(slug)).toBe(true);
      expect(OSOGBO_WORLD_NODES[slug as keyof typeof OSOGBO_WORLD_NODES]).toBeDefined();
      expect(cityEntranceForLocation(slug).x).toBeLessThanOrEqual(CITY_WORLD_BOUNDS.maxX);
      expect(cityEntranceForLocation(slug).y).toBeLessThanOrEqual(CITY_WORLD_BOUNDS.maxY);
    }
    expect(cityDistrictForLocation("adire-makers-yard")).toBe("east-commons");
    expect(cityDistrictForLocation("neighborhood-play-park")).toBe("east-commons");
    const eastRoute = findCityRoadPath(
      cityPositionForRecord({
        slug: "atiku",
        map_x: 0,
        map_y: 0,
      }),
      cityEntranceForLocation("sunrise-health-post"),
    );
    expect(eastRoute?.at(-1)).toEqual({ x: 19, y: 2 });
  });
});

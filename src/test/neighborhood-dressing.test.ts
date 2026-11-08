import { describe, expect, it } from "vitest";
import {
  carSpots,
  pedestrianCrossings,
  pedestrianSpots,
  roadMarkings,
  sidewalksAndCurbs,
  streetLightSpots,
  trafficLightSpots,
  vendorSpots,
} from "@/game/neighborhood-dressing";
import { CITY_CENTRE_AREA, NEIGHBORHOOD_SCENE_BOUNDS } from "@/game/neighborhood-model";
import { neighborhoodBuildingFootprint } from "@/game/neighborhood-geometry";

const bounds = NEIGHBORHOOD_SCENE_BOUNDS;

describe("neighbourhood street dressing", () => {
  it("derives markings, kerbs and sidewalks from the area's roads", () => {
    expect(roadMarkings(CITY_CENTRE_AREA, bounds).length).toBeGreaterThan(0);
    const { sidewalks, curbs } = sidewalksAndCurbs(CITY_CENTRE_AREA, bounds);
    expect(sidewalks.length).toBeGreaterThan(0);
    expect(curbs.length).toBe(sidewalks.length);
  });

  it("places street lights and cars along streets, not in lanes", () => {
    expect(streetLightSpots(CITY_CENTRE_AREA, bounds).length).toBeGreaterThan(0);
    expect(carSpots(CITY_CENTRE_AREA, bounds).length).toBeLessThanOrEqual(12);
  });

  it("orients traffic in both directions along horizontal and vertical roads", () => {
    const rotations = new Set(carSpots(CITY_CENTRE_AREA, bounds).map((spot) => spot.rotation));
    expect(rotations.has(0)).toBe(true);
    expect(rotations.has(Math.PI)).toBe(true);
    expect(rotations.has(Math.PI / 2)).toBe(true);
    expect(rotations.has(-Math.PI / 2)).toBe(true);
  });

  it("keeps sidewalks and lamps clear of main building footprints", () => {
    const buildings = CITY_CENTRE_AREA.objects.map((o) => ({
      left: o.x - 57,
      right: o.x + 57,
      top: o.y - 62,
      bottom: o.y - 4,
    }));
    for (const rect of sidewalksAndCurbs(CITY_CENTRE_AREA, bounds).sidewalks)
      for (const b of buildings) {
        const overlapX =
          Math.abs(rect.x - (b.left + b.right) / 2) < (rect.width + (b.right - b.left)) / 2;
        const overlapY =
          Math.abs(rect.y - (b.top + b.bottom) / 2) < (rect.depth + (b.bottom - b.top)) / 2;
        expect(overlapX && overlapY).toBe(false);
      }
    for (const spot of streetLightSpots(CITY_CENTRE_AREA, bounds))
      for (const b of buildings)
        expect(spot.x > b.left && spot.x < b.right && spot.y > b.top && spot.y < b.bottom).toBe(
          false,
        );
  });

  it("keeps crosswalk rectangles clear of complete obstacle footprints", () => {
    for (const crossing of pedestrianCrossings(CITY_CENTRE_AREA)) {
      for (const obstacle of CITY_CENTRE_AREA.obstacles ?? []) {
        const overlaps =
          Math.abs(crossing.x - obstacle.x) <
            (crossing.width + obstacle.width) / 2 + 2 &&
          Math.abs(crossing.y - obstacle.y) <
            (crossing.depth + obstacle.height) / 2 + 2;
        expect(overlaps).toBe(false);
      }
      for (const object of CITY_CENTRE_AREA.objects.filter((item) => item.kind !== "npc")) {
        const footprint = neighborhoodBuildingFootprint(object);
        const overlaps =
          Math.abs(crossing.x - (footprint.left + footprint.width / 2)) <
            (crossing.width + footprint.width) / 2 + 2 &&
          Math.abs(crossing.y - (footprint.top + footprint.height / 2)) <
            (crossing.depth + footprint.height) / 2 + 2;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("does not create crossings where road extents do not meet", () => {
    const vertical = CITY_CENTRE_AREA.roads?.find((road) => road.axis === "vertical");
    const horizontal = CITY_CENTRE_AREA.roads?.find((road) => road.axis === "horizontal");
    expect(vertical).toBeDefined();
    expect(horizontal).toBeDefined();
    const separatedArea = {
      ...CITY_CENTRE_AREA,
      roads: [
        { ...vertical!, start: 1000, end: 1100 },
        { ...horizontal!, start: -500, end: -400 },
      ],
    };
    expect(pedestrianCrossings(separatedArea)).toEqual([]);
  });

  it("derives deterministic traffic signals at clear arterial junctions", () => {
    const signals = trafficLightSpots(CITY_CENTRE_AREA);
    expect(signals.length).toBeGreaterThan(0);
    expect(signals).toEqual(trafficLightSpots(CITY_CENTRE_AREA));
    for (const signal of signals)
      for (const obstacle of CITY_CENTRE_AREA.obstacles ?? []) {
        expect(
          Math.abs(signal.x - obstacle.x) < obstacle.width / 2 + 8 &&
            Math.abs(signal.y - obstacle.y) < obstacle.height / 2 + 8,
        ).toBe(false);
      }
  });

  it("is deterministic for the same area", () => {
    expect(pedestrianSpots(CITY_CENTRE_AREA, bounds)).toEqual(
      pedestrianSpots(CITY_CENTRE_AREA, bounds),
    );
    expect(pedestrianCrossings(CITY_CENTRE_AREA).length).toBeGreaterThan(0);
    expect(vendorSpots(CITY_CENTRE_AREA)).toEqual([...(CITY_CENTRE_AREA.marketStalls ?? [])]);
  });
});

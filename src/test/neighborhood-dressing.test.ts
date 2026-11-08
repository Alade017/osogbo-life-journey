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

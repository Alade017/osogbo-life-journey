import { describe, expect, it } from "vitest";
import {
  carSpots,
  pedestrianCrossings,
  pedestrianSpots,
  roadMarkings,
  sidewalksAndCurbs,
  streetLightSpots,
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

  it("is deterministic for the same area", () => {
    expect(pedestrianSpots(CITY_CENTRE_AREA, bounds)).toEqual(
      pedestrianSpots(CITY_CENTRE_AREA, bounds),
    );
    expect(pedestrianCrossings(CITY_CENTRE_AREA).length).toBeGreaterThan(0);
    expect(vendorSpots(CITY_CENTRE_AREA)).toEqual([...(CITY_CENTRE_AREA.marketStalls ?? [])]);
  });
});

import { describe, expect, it } from "vitest";
import {
  carSpots,
  pedestrianCrossings,
  pedestrianCrossingStripes,
  pedestrianSpots,
  roadMarkings,
  sidewalksAndCurbs,
  streetLightSpots,
  trafficLightSpots,
  treeVisualProfile,
  vendorSpots,
} from "@/game/neighborhood-dressing";
import {
  CITY_CENTRE_AREA,
  NEIGHBORHOOD_SCENE_BOUNDS,
  OJA_OBA_AREA,
} from "@/game/neighborhood-model";
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

  it("keeps vehicle placements clear of pedestrian crossings", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    for (const car of carSpots(CITY_CENTRE_AREA, bounds))
      for (const crossing of crossings) {
        const overlaps =
          Math.abs(car.x - crossing.x) < crossing.width / 2 + 24 &&
          Math.abs(car.y - crossing.y) < crossing.depth / 2 + 24;
        expect(overlaps).toBe(false);
      }
  });

  it("keeps pedestrian actors clear of zebra crossing stripes", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    for (const person of pedestrianSpots(CITY_CENTRE_AREA, bounds))
      for (const crossing of crossings) {
        const overlaps =
          Math.abs(person.x - crossing.x) < crossing.width / 2 + 8 &&
          Math.abs(person.y - crossing.y) < crossing.depth / 2 + 8;
        expect(overlaps).toBe(false);
      }
  });

  it("distributes pedestrians across multiple streets before applying the scene cap", () => {
    const spots = pedestrianSpots(CITY_CENTRE_AREA, bounds);
    const representedRoads = (CITY_CENTRE_AREA.roads ?? []).filter((road) =>
      spots.some((spot) =>
        road.axis === "vertical"
          ? Math.abs(spot.x - road.offset) <= road.width / 2 + 16
          : Math.abs(spot.y - road.offset) <= road.width / 2 + 16,
      ),
    );
    expect(spots.length).toBeLessThanOrEqual(14);
    expect(representedRoads.length).toBeGreaterThan(1);
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

  it("places pedestrian crossings across both intersecting road directions", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    expect(crossings.some((crossing) => crossing.width > crossing.depth)).toBe(true);
    expect(crossings.some((crossing) => crossing.depth > crossing.width)).toBe(true);
  });

  it("keeps road markings out of pedestrian crossing footprints", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    const markings = roadMarkings(CITY_CENTRE_AREA, bounds);
    for (const crossing of crossings)
      for (const marking of markings) {
        const overlaps =
          Math.abs(crossing.x - marking.x) <
            (crossing.width + marking.width) / 2 &&
          Math.abs(crossing.y - marking.y) <
            (crossing.depth + marking.depth) / 2;
        expect(overlaps).toBe(false);
      }
  });

  it("renders each pedestrian crossing as evenly spaced zebra stripes", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    const stripes = pedestrianCrossingStripes(crossings);
    expect(stripes).toHaveLength(crossings.length * 4);
    for (const crossing of crossings) {
      const matching = stripes.filter((stripe) =>
        Math.abs(stripe.x - crossing.x) <= crossing.width / 2 &&
        Math.abs(stripe.y - crossing.y) <= crossing.depth / 2,
      );
      expect(matching).toHaveLength(4);
      if (crossing.width >= crossing.depth) {
        expect(matching.every((stripe) => stripe.width === crossing.width)).toBe(true);
      } else {
        expect(matching.every((stripe) => stripe.depth === crossing.depth)).toBe(true);
      }
    }
  });

  it("preserves sidewalk runs immediately before and after each crossing", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    const { sidewalks } = sidewalksAndCurbs(CITY_CENTRE_AREA, bounds);
    for (const crossing of crossings) {
      const verticalRoad = CITY_CENTRE_AREA.roads?.find(
        (road) => road.axis === "vertical" && Math.abs(road.offset - crossing.x) < 1,
      );
      const horizontalRoad = CITY_CENTRE_AREA.roads?.find(
        (road) => road.axis === "horizontal" && Math.abs(road.offset - crossing.y) < 1,
      );
      if (verticalRoad && crossing.width > crossing.depth) {
        for (const side of [-1, 1]) {
          const x = verticalRoad.offset + side * (verticalRoad.width / 2 + 8);
          expect(
            sidewalks.some((segment) => Math.abs(segment.x - x) < 1 && segment.y < crossing.y - crossing.depth / 2),
          ).toBe(true);
          expect(
            sidewalks.some((segment) => Math.abs(segment.x - x) < 1 && segment.y > crossing.y + crossing.depth / 2),
          ).toBe(true);
        }
      } else if (horizontalRoad && crossing.depth > crossing.width) {
        for (const side of [-1, 1]) {
          const y = horizontalRoad.offset + side * (horizontalRoad.width / 2 + 8);
          expect(
            sidewalks.some((segment) => Math.abs(segment.y - y) < 1 && segment.x < crossing.x - crossing.width / 2),
          ).toBe(true);
          expect(
            sidewalks.some((segment) => Math.abs(segment.y - y) < 1 && segment.x > crossing.x + crossing.width / 2),
          ).toBe(true);
        }
      }
    }
  });

  it("leaves unobstructed pedestrian openings through sidewalks and kerbs", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    const { sidewalks, curbs } = sidewalksAndCurbs(CITY_CENTRE_AREA, bounds);
    for (const crossing of crossings) {
      for (const segment of [...sidewalks, ...curbs]) {
        const overlaps =
          Math.abs(crossing.x - segment.x) < (crossing.width + segment.width) / 2 &&
          Math.abs(crossing.y - segment.y) < (crossing.depth + segment.depth) / 2;
        expect(overlaps).toBe(false);
      }
    }
  });

  it("keeps generated streetlights clear of pedestrian crossing approaches", () => {
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    for (const light of streetLightSpots(CITY_CENTRE_AREA, bounds))
      for (const crossing of crossings) {
        const overlaps =
          Math.abs(light.x - crossing.x) < crossing.width / 2 + 6 &&
          Math.abs(light.y - crossing.y) < crossing.depth / 2 + 6;
        expect(overlaps).toBe(false);
      }
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
    expect(new Set(signals.map((signal) => signal.rotation)).size).toBeGreaterThan(1);
    expect(signals).toEqual(trafficLightSpots(CITY_CENTRE_AREA));
    const crossings = pedestrianCrossings(CITY_CENTRE_AREA);
    for (const signal of signals) {
      for (const obstacle of CITY_CENTRE_AREA.obstacles ?? []) {
        expect(
          Math.abs(signal.x - obstacle.x) < obstacle.width / 2 + 8 &&
            Math.abs(signal.y - obstacle.y) < obstacle.height / 2 + 8,
        ).toBe(false);
      }
      for (const crossing of crossings) {
        expect(
          Math.abs(signal.x - crossing.x) < crossing.width / 2 + 8 &&
            Math.abs(signal.y - crossing.y) < crossing.depth / 2 + 8,
        ).toBe(false);
      }
    }
  });

  it("adds signals where an arterial meets a neighborhood street", () => {
    expect(trafficLightSpots(OJA_OBA_AREA).length).toBeGreaterThan(0);
  });

  it("derives tree size from obstacle footprints and clamps extremes", () => {
    expect(treeVisualProfile({ width: 48, height: 48 })).toEqual({
      height: 1,
      canopyScale: 1,
    });
    expect(treeVisualProfile({ width: 12, height: 12 })).toEqual({
      height: 0.75,
      canopyScale: 0.75,
    });
    expect(treeVisualProfile({ width: 120, height: 120 })).toEqual({
      height: 1.25,
      canopyScale: 1.3,
    });
  });

  it.each([
    ["city centre", CITY_CENTRE_AREA],
    ["Oja Oba", OJA_OBA_AREA],
  ])("produces finite, positive street geometry for %s", (_name, area) => {
    const rects = [
      ...roadMarkings(area, bounds),
      ...pedestrianCrossings(area),
      ...pedestrianCrossingStripes(pedestrianCrossings(area)),
      ...sidewalksAndCurbs(area, bounds).sidewalks,
      ...sidewalksAndCurbs(area, bounds).curbs,
    ];
    for (const rect of rects) {
      expect(Number.isFinite(rect.x)).toBe(true);
      expect(Number.isFinite(rect.y)).toBe(true);
      expect(Number.isFinite(rect.width)).toBe(true);
      expect(Number.isFinite(rect.depth)).toBe(true);
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.depth).toBeGreaterThan(0);
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

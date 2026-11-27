import { describe, expect, it } from "vitest";
import {
  fillSpares,
  DISTRICT_MAX_SIZE_M,
  DISTRICT_MIN_SIZE_M,
  DISTRICT_SLUGS,
  insideDistrict,
  overlaps,
  roadRect,
  type DistrictRect,
} from "../game/districts/district-layout.ts";
import { OLAIYA_JUNCTION } from "../game/districts/olaiya-junction.ts";

const layout = OLAIYA_JUNCTION;
const half = layout.sizeM / 2;

describe("Olaiya Junction district", () => {
  it("is a compact 300-600 m square district", () => {
    expect(layout.sizeM).toBeGreaterThanOrEqual(DISTRICT_MIN_SIZE_M);
    expect(layout.sizeM).toBeLessThanOrEqual(DISTRICT_MAX_SIZE_M);
  });

  it("stands on one of the eight spec districts", () => {
    expect(DISTRICT_SLUGS).toContain(layout.slug);
    expect(DISTRICT_SLUGS).toHaveLength(8);
  });

  it("keeps all 14 town-map places, each with a unique id", () => {
    expect(layout.places).toHaveLength(14);
    expect(new Set(layout.places.map((place) => place.id)).size).toBe(14);
  });

  it("keeps every place, door and lot inside the district", () => {
    for (const rect of [...layout.places, ...layout.doors, ...layout.lots]) {
      expect(insideDistrict(rect, layout.sizeM)).toBe(true);
    }
  });

  it("stands every place on the street, with its access point on a road", () => {
    for (const place of layout.places) {
      const onRoad = layout.roads.some((road) =>
        overlaps(
          { x: place.access.x, z: place.access.z, w: 0.01, d: 0.01 },
          roadRect(road, layout.sizeM),
        ),
      );
      expect(onRoad, place.id).toBe(true);
    }
  });

  it("never lets a place, door or lot sit on a road", () => {
    for (const rect of [...layout.places, ...layout.doors, ...layout.lots]) {
      for (const road of layout.roads) {
        expect(overlaps(rect, roadRect(road, layout.sizeM)), road.id).toBe(false);
      }
    }
  });

  it("keeps places, doors and lots from overlapping one another", () => {
    const solids: DistrictRect[] = [...layout.places, ...layout.doors, ...layout.lots];
    for (let i = 0; i < solids.length; i += 1) {
      for (let j = i + 1; j < solids.length; j += 1) {
        expect(overlaps(solids[i]!, solids[j]!), `${i}-${j}`).toBe(false);
      }
    }
  });

  it("has exits on the district edge, each on a road and to a different district", () => {
    expect(layout.exits.length).toBeGreaterThanOrEqual(4);
    for (const exit of layout.exits) {
      expect(exit.toDistrict).not.toBe(layout.slug);
      expect(DISTRICT_SLUGS).toContain(exit.toDistrict);
      const roadAtEdge = layout.roads.some((road) =>
        road.axis === "vertical"
          ? exit.edge === "north" || exit.edge === "south"
            ? Math.abs(road.offsetM - exit.offsetM) < road.widthM / 2
            : false
          : exit.edge === "east" || exit.edge === "west"
            ? Math.abs(road.offsetM - exit.offsetM) < road.widthM / 2
            : false,
      );
      expect(roadAtEdge, exit.id).toBe(true);
      expect(Math.abs(exit.offsetM)).toBeLessThan(half);
    }
  });

  it("is dense: enough compounds and trees that it is not wide empty ground", () => {
    expect(layout.lots.length + layout.yards.length).toBeGreaterThanOrEqual(30);
    expect(layout.trees.length).toBeGreaterThanOrEqual(30);
  });

  it("mixes corner commercial blocks with single-storey compounds", () => {
    const corners = layout.lots.filter((lot) => lot.archetype === "corner-block");
    const compounds = layout.lots.filter((lot) => lot.archetype === "compound");
    expect(corners.length).toBeGreaterThanOrEqual(4);
    expect(compounds.length).toBeGreaterThan(corners.length);
  });

  it("fills the empty ground with fenced yards and kiosk rows", () => {
    expect(layout.yards.filter((y) => y.kind === "yard").length).toBeGreaterThanOrEqual(10);
    expect(layout.yards.filter((y) => y.kind === "kiosk-row").length).toBeGreaterThanOrEqual(10);
  });

  it("keeps yards and kiosk rows off roads, buildings and each other", () => {
    for (const yard of layout.yards) {
      expect(insideDistrict(yard, layout.sizeM)).toBe(true);
      for (const road of layout.roads) {
        expect(overlaps(yard, roadRect(road, layout.sizeM)), `${yard.kind} ${road.id}`).toBe(false);
      }
      for (const solid of [...layout.places, ...layout.doors, ...layout.lots]) {
        expect(overlaps(yard, solid), `${yard.kind} vs a place, door or lot`).toBe(false);
      }
    }
  });

  it("gives the spare ground market pitches, parking bays and shrub beds", () => {
    const spares = layout.yards.filter((y) => ["market", "parking", "shrub"].includes(y.kind));
    expect(spares.filter((y) => y.kind === "market").length).toBeGreaterThanOrEqual(5);
    expect(spares.filter((y) => y.kind === "parking").length).toBeGreaterThanOrEqual(2);
    expect(spares.filter((y) => y.kind === "shrub").length).toBeGreaterThanOrEqual(2);
    const solid = [...layout.roads.map((r) => roadRect(r, layout.sizeM)), ...layout.places];
    for (const spare of spares) {
      expect(insideDistrict(spare, layout.sizeM, 1)).toBe(true);
      expect(solid.some((rect) => overlaps(spare, rect, 3))).toBe(false);
      expect(layout.lots.some((lot) => overlaps(spare, lot, 0))).toBe(false);
    }
  });

  it("leaves only modest open ground between properties", () => {
    // Samples the district on a 4 m grid. Sidewalk verges beside roads are drawn by the scene,
    // so they count as covered.
    const cell = 4;
    const roadsAsRects = layout.roads.map((r) => roadRect(r, layout.sizeM));
    const occupied = [...layout.lots, ...layout.yards, ...layout.places, ...layout.doors];
    let bare = 0;
    let total = 0;
    for (let x = -half + cell / 2; x < half; x += cell) {
      for (let z = -half + cell / 2; z < half; z += cell) {
        total += 1;
        const at = { x, z, w: 0.01, d: 0.01 };
        const covered =
          occupied.some((rect) => overlaps(at, rect, 0)) ||
          roadsAsRects.some((rect) => overlaps(at, rect, 3));
        if (!covered) bare += 1;
      }
    }
    // Sandy residential yards are intentional; the bound catches large unexplained gaps only.
    expect(bare / total).toBeLessThan(0.25);
  });

  it("places spare ground deterministically", () => {
    const fenced = layout.yards.filter((y) => y.kind === "yard" || y.kind === "kiosk-row");
    const again = fillSpares(
      layout.sizeM,
      layout.roads,
      layout.places,
      layout.doors,
      layout.lots,
      fenced,
    );
    const spares = layout.yards.filter((y) => !["yard", "kiosk-row"].includes(y.kind));
    expect(again).toEqual(spares);
  });

  it("plants a tree cluster inside every fenced yard", () => {
    for (const yard of layout.yards.filter((y) => y.kind === "yard")) {
      const inside = layout.trees.filter(
        (t) => Math.abs(t.x - yard.x) <= yard.w / 2 && Math.abs(t.z - yard.z) <= yard.d / 2,
      );
      expect(inside.length, `yard at ${yard.x},${yard.z}`).toBeGreaterThanOrEqual(2);
    }
  });
});

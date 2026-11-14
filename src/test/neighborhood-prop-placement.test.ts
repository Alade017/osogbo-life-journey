import { describe, expect, it } from "vitest";
import {
  FUEL_AND_GO_AREA,
  NEIGHBORHOOD_AREAS,
  type NeighborhoodArea,
} from "../game/neighborhood-model.ts";
import { dressingPartsFor } from "../components/3d/props/dressing.ts";

const dressed = Object.values(NEIGHBORHOOD_AREAS).filter(
  (area: NeighborhoodArea) => (area.dressing ?? []).length > 0,
);

/** Bounding box of an area's own objects and obstacles, with a margin for dressing. */
function areaExtent(area: NeighborhoodArea) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const object of area.objects) {
    xs.push(object.x);
    ys.push(object.y);
  }
  for (const box of area.obstacles ?? []) {
    xs.push(box.x - box.width / 2, box.x + box.width / 2);
    ys.push(box.y - box.height / 2, box.y + box.height / 2);
  }
  const margin = 160;
  return {
    minX: Math.min(...xs) - margin,
    maxX: Math.max(...xs) + margin,
    minY: Math.min(...ys) - margin,
    maxY: Math.max(...ys) + margin,
  };
}

function inside(
  point: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
  gap: number,
) {
  return (
    Math.abs(point.x - box.x) < box.width / 2 + gap &&
    Math.abs(point.y - box.y) < box.height / 2 + gap
  );
}

describe("neighbourhood dressing", () => {
  it("dresses the market and the filling station", () => {
    expect(dressed.map((area) => area.slug)).toEqual(
      expect.arrayContaining(["oja-oba", "fuel-and-go"]),
    );
  });

  it("keeps every decorative prop within the area's own extent", () => {
    for (const area of dressed) {
      const extent = areaExtent(area);
      for (const item of area.dressing ?? []) {
        const label = `${area.slug} ${item.id}`;
        expect(item.x, label).toBeGreaterThanOrEqual(extent.minX);
        expect(item.x, label).toBeLessThanOrEqual(extent.maxX);
        expect(item.y, label).toBeGreaterThanOrEqual(extent.minY);
        expect(item.y, label).toBeLessThanOrEqual(extent.maxY);
      }
    }
  });

  it("never places a prop on an obstacle, a hero object or a road", () => {
    for (const area of dressed) {
      for (const item of area.dressing ?? []) {
        const label = `${area.slug} ${item.id}`;
        for (const box of area.obstacles ?? []) {
          expect(inside(item, box, 16), `${label} on ${box.id}`).toBe(false);
        }
        for (const object of area.objects) {
          expect(
            inside(item, { ...object, width: 40, height: 40 }, 16),
            `${label} on ${object.id}`,
          ).toBe(false);
        }
        for (const road of area.roads ?? []) {
          const onRoad =
            road.axis === "vertical"
              ? Math.abs(item.x - road.offset) < road.width / 2
              : Math.abs(item.y - road.offset) < road.width / 2;
          expect(onRoad, `${label} on ${road.id}`).toBe(false);
        }
      }
    }
  });

  it("gives every dressing kind drawable parts", () => {
    for (const area of dressed) {
      for (const item of area.dressing ?? []) {
        expect(dressingPartsFor(item.kind).length, `${area.slug} ${item.kind}`).toBeGreaterThan(0);
      }
    }
    expect(FUEL_AND_GO_AREA.dressing?.length).toBeGreaterThan(0);
  });
});

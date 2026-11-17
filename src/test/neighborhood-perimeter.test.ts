import { describe, expect, it } from "vitest";
import {
  NEIGHBORHOOD_AREAS,
  NEIGHBORHOOD_SIZE,
  type NeighborhoodObstacle,
} from "../game/neighborhood-model.ts";
import { perimeterObstacles } from "../game/neighborhood-model.ts";

// Generated areas come from one template, so they all carry its landmark obstacle.
const generated = Object.values(NEIGHBORHOOD_AREAS).filter((area) =>
  (area.obstacles ?? []).some((item) => item.id === "district-landmark"),
);

function overlaps(
  a: NeighborhoodObstacle,
  b: { x: number; y: number; width: number; height: number },
) {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2
  );
}

describe("perimeter filler", () => {
  it("covers the outer edge of every generated neighbourhood", () => {
    expect(generated.length).toBeGreaterThan(0);
    for (const area of generated) {
      const perimeter = (area.obstacles ?? []).filter((item) => item.id.startsWith("perimeter-"));
      expect(perimeter.length, area.slug).toBeGreaterThan(0);
    }
  });

  it("keeps every filler building inside the neighbourhood", () => {
    for (const area of generated) {
      for (const item of (area.obstacles ?? []).filter((o) => o.id.startsWith("perimeter-"))) {
        expect(item.x - item.width / 2, area.slug).toBeGreaterThanOrEqual(0);
        expect(item.x + item.width / 2, area.slug).toBeLessThanOrEqual(NEIGHBORHOOD_SIZE.width);
        expect(item.y - item.height / 2, area.slug).toBeGreaterThanOrEqual(0);
        expect(item.y + item.height / 2, area.slug).toBeLessThanOrEqual(NEIGHBORHOOD_SIZE.height);
      }
    }
  });

  it("never overlaps a road surface, a hero object or a fixed obstacle", () => {
    for (const area of generated) {
      const fixed = (area.obstacles ?? []).filter((o) => !o.id.startsWith("perimeter-"));
      for (const item of (area.obstacles ?? []).filter((o) => o.id.startsWith("perimeter-"))) {
        for (const road of area.roads ?? []) {
          const edge =
            road.axis === "vertical"
              ? {
                  x: road.offset,
                  y: NEIGHBORHOOD_SIZE.height / 2,
                  width: road.width,
                  height: NEIGHBORHOOD_SIZE.height,
                }
              : {
                  x: NEIGHBORHOOD_SIZE.width / 2,
                  y: road.offset,
                  width: NEIGHBORHOOD_SIZE.width,
                  height: road.width,
                };
          expect(overlaps(item, edge), `${area.slug} ${item.id} on ${road.id}`).toBe(false);
        }
        for (const object of area.objects ?? []) {
          expect(
            overlaps(item, { x: object.x, y: object.y, width: 40, height: 40 }),
            `${area.slug} ${item.id} on ${object.id}`,
          ).toBe(false);
        }
        for (const box of fixed) {
          expect(overlaps(item, box), `${area.slug} ${item.id} on ${box.id}`).toBe(false);
        }
      }
    }
  });

  it("is deterministic for the same seed", () => {
    const area = generated[0]!;
    const once = perimeterObstacles(42, area.roads ?? [], area.objects ?? [], []);
    const twice = perimeterObstacles(42, area.roads ?? [], area.objects ?? [], []);
    expect(twice).toEqual(once);
  });
});

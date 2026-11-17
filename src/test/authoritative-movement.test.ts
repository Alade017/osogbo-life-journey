import { describe, expect, it } from "vitest";
import {
  canRestoreNeighborhoodCheckpoint,
  canOccupyNeighborhoodPoint,
  parseMovementIntent,
  PLAYER_SPEED,
  stepAuthoritativePosition,
} from "@/game/authoritative-movement";
import { neighborhoodAreaForSlug, toWorld } from "@/game/neighborhood-model";

const origin = { x: 7, y: 6 };

describe("authoritative neighborhood movement", () => {
  it("accepts only bounded cardinal and diagonal movement intents", () => {
    expect(parseMovementIntent({ x: 1, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(parseMovementIntent({ x: -1, y: 1 })).toEqual({ x: -1, y: 1 });
    expect(parseMovementIntent({ x: 0.5, y: 0 })).toBeNull();
    expect(parseMovementIntent({ x: 2, y: 0 })).toBeNull();
    expect(parseMovementIntent({ x: Number.NaN, y: 0 })).toBeNull();
    expect(parseMovementIntent(null)).toBeNull();
  });

  it("normalizes diagonal movement to the same speed as cardinal movement", () => {
    const start = { x: 7, y: 6 };
    const cardinal = stepAuthoritativePosition(start, { x: 1, y: 0 }, 0.05, origin);
    const diagonal = stepAuthoritativePosition(start, { x: 1, y: 1 }, 0.05, origin);
    expect(Math.hypot(cardinal.x - start.x, cardinal.y - start.y)).toBeCloseTo(PLAYER_SPEED * 0.05);
    expect(Math.hypot(diagonal.x - start.x, diagonal.y - start.y)).toBeCloseTo(PLAYER_SPEED * 0.05);
  });

  it("keeps movement within world bounds", () => {
    expect(stepAuthoritativePosition({ x: 23.99, y: 10 }, { x: 1, y: 0 }, 0.1, origin).x).toBe(24);
    expect(stepAuthoritativePosition({ x: 10, y: 19.99 }, { x: 0, y: 1 }, 0.1, origin).y).toBe(20);
    expect(stepAuthoritativePosition({ x: 0, y: 10 }, { x: -1, y: 0 }, 0.1, origin).x).toBe(0);
    expect(stepAuthoritativePosition({ x: 10, y: 0 }, { x: 0, y: -1 }, 0.1, origin).y).toBe(0);
  });

  it("restores only in-bounds, navigable saved checkpoints", () => {
    const area = neighborhoodAreaForSlug("student-district");
    const building = area.objects.find((object) => object.kind === "market")!;
    const blocked = toWorld({ x: building.x, y: building.y - 35 }, origin);
    expect(
      canRestoreNeighborhoodCheckpoint({ x: 5, y: 9 }, origin, area.objects, area.obstacles),
    ).toBe(true);
    expect(canRestoreNeighborhoodCheckpoint(blocked, origin, area.objects, area.obstacles)).toBe(
      false,
    );
    expect(
      canRestoreNeighborhoodCheckpoint({ x: 25, y: 9 }, origin, area.objects, area.obstacles),
    ).toBe(false);
    expect(canRestoreNeighborhoodCheckpoint({ x: 24, y: 20 }, origin, [], [])).toBe(true);
  });

  it("blocks solid obstacles on the server movement model", () => {
    const area = neighborhoodAreaForSlug("city-centre");
    const solid = area.obstacles![0]!;
    const blocked = toWorld({ x: solid.x, y: solid.y }, origin);
    expect(canOccupyNeighborhoodPoint(blocked, origin, area.objects, area.obstacles)).toBe(false);
    const moved = stepAuthoritativePosition(
      blocked,
      { x: -1, y: 0 },
      0.05,
      origin,
      area.objects,
      area.obstacles,
    );
    expect(moved).toEqual(blocked);
  });

  it("uses the destination area's collision layout on the server", () => {
    const cityObjects = neighborhoodAreaForSlug("city-centre").objects;
    const marketObjects = neighborhoodAreaForSlug("oja-oba").objects;
    const marketShop = marketObjects.find((object) => object.id === "market")!;
    const insideMarketFootprint = toWorld({ x: marketShop.x, y: marketShop.y - 45 }, origin);
    expect(canOccupyNeighborhoodPoint(insideMarketFootprint, origin, marketObjects)).toBe(false);
    expect(canOccupyNeighborhoodPoint(insideMarketFootprint, origin, cityObjects)).toBe(true);
  });

  it("uses generated district obstacles as shared server collision footprints", () => {
    const district = neighborhoodAreaForSlug("student-district");
    const cityObjects = neighborhoodAreaForSlug("city-centre").objects;
    const solid = district.obstacles![0]!;
    const insideFootprint = toWorld({ x: solid.x, y: solid.y }, origin);
    expect(
      canOccupyNeighborhoodPoint(insideFootprint, origin, district.objects, district.obstacles),
    ).toBe(false);
    expect(canOccupyNeighborhoodPoint(insideFootprint, origin, cityObjects)).toBe(true);
  });

  it("blocks Olaiya's obstacles while keeping the spawn walkable", () => {
    const area = neighborhoodAreaForSlug("city-centre");
    const solid = area.obstacles![0]!;
    expect(
      canOccupyNeighborhoodPoint(toWorld(solid, origin), origin, area.objects, area.obstacles),
    ).toBe(false);
    expect(
      canOccupyNeighborhoodPoint(
        toWorld({ x: 320, y: 300 }, origin),
        origin,
        area.objects,
        area.obstacles,
      ),
    ).toBe(true);
  });
});

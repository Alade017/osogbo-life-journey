import { describe, expect, it } from "vitest";
import {
  MALL_OBSTACLES,
  MALL_RESTRICTED_ZONES,
  canWalkInMall,
  findMallPath,
  restrictedZoneAt,
} from "@/game/osun-mall-layout";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";

const ENTRANCE: [number, number] = [0, 5.5];

describe("Osun Mall layout", () => {
  it("has an obstacle for every mall fixture so the scene and walking stay in step", () => {
    const fixtureIds = getLocationVenueDesign("osun-mall", "Osun Mall").fixtures.map((f) => f.id);
    const obstacleIds = new Set(MALL_OBSTACLES.map((rect) => rect.id));
    for (const id of fixtureIds) expect(obstacleIds.has(id), id).toBe(true);
  });

  it("lets visitors stand in the open hall, including the entrance", () => {
    expect(canWalkInMall(ENTRANCE)).toBe(true);
    expect(canWalkInMall([0, 0])).toBe(true);
  });

  it("blocks shelves, tills and seats", () => {
    expect(canWalkInMall([4, -4.5])).toBe(false);
    expect(canWalkInMall([4, 3.3])).toBe(false);
    expect(canWalkInMall([-4.6, 4.5])).toBe(false);
  });

  it("keeps the staff room and control room out of bounds for everyone", () => {
    expect(canWalkInMall([7, -6])).toBe(false);
    expect(canWalkInMall([-7, -5])).toBe(false);
    expect(restrictedZoneAt([7, -6])?.id).toBe("staff-room");
    expect(restrictedZoneAt([-7, -5])?.id).toBe("control-room");
    expect(restrictedZoneAt([0, 0])).toBeNull();
  });

  it("finds a route from the entrance across the hall", () => {
    const path = findMallPath(ENTRANCE, [-6, 2]);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual([-6, 2]);
  });

  it("routes around shelves rather than through them", () => {
    const path = findMallPath([0, -2.5], [4, -6]) ?? [];
    expect(path.length).toBeGreaterThan(1);
    for (const point of path) {
      expect(canWalkInMall(point), JSON.stringify(point)).toBe(true);
    }
  });

  it("refuses routes into restricted rooms", () => {
    expect(findMallPath(ENTRANCE, [7, -6])).toBeNull();
    expect(findMallPath(ENTRANCE, [-7, -5])).toBeNull();
  });

  it("never routes a visitor through a restricted zone", () => {
    const path = findMallPath([-7, -2], [7, -2]) ?? [];
    expect(path.length).toBeGreaterThan(1);
    for (const point of path) {
      for (const zone of MALL_RESTRICTED_ZONES) {
        const inside =
          point[0] >= zone.minX &&
          point[0] <= zone.maxX &&
          point[1] >= zone.minZ &&
          point[1] <= zone.maxZ;
        expect(inside, JSON.stringify(point)).toBe(false);
      }
    }
  });
});

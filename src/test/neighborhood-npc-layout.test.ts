import { describe, expect, it } from "vitest";
import { NEIGHBORHOOD_SCENE_BOUNDS } from "@/game/neighborhood-geometry";
import { neighborhoodNpcDestinationPoint, neighborhoodNpcPath, neighborhoodNpcSpawnPoint } from "@/game/neighborhood-npc-layout";

describe("neighborhood NPC spawn distribution", () => {
  const slots = [
    { x: 100, y: 100 },
    { x: 300, y: 100 },
    { x: 500, y: 100 },
  ];

  it("uses authored slots before generating overflow positions", () => {
    expect(neighborhoodNpcSpawnPoint(slots, 0)).toEqual(slots[0]);
    expect(neighborhoodNpcSpawnPoint(slots, 1)).toEqual(slots[1]);
    expect(neighborhoodNpcSpawnPoint(slots, 2)).toEqual(slots[2]);
  });

  it("deterministically distributes additional NPCs around the authored anchors", () => {
    const first = neighborhoodNpcSpawnPoint(slots, 3);
    expect(first).toEqual(neighborhoodNpcSpawnPoint(slots, 3));
    expect(first).not.toEqual(slots[0]);
    expect(neighborhoodNpcSpawnPoint(slots, 4)).not.toEqual(neighborhoodNpcSpawnPoint(slots, 5));
  });

  it("supports more scheduled NPCs than authored placeholder slots", () => {
    const positions = Array.from({ length: 6 }, (_, index) =>
      neighborhoodNpcSpawnPoint(slots, index),
    );
    expect(positions.every(Boolean)).toBe(true);
    expect(new Set(positions.map((point) => point && String(point.x) + ":" + String(point.y))).size).toBe(6);
  });

  it("keeps spawn anchors tied to catalog identity when the active population changes", () => {
    const firstCharacterSpawn = neighborhoodNpcSpawnPoint(slots, 0);
    const laterCharacterSpawn = neighborhoodNpcSpawnPoint(slots, 4);
    expect(neighborhoodNpcSpawnPoint(slots, 0)).toEqual(firstCharacterSpawn);
    expect(neighborhoodNpcSpawnPoint(slots, 4)).toEqual(laterCharacterSpawn);
    expect(firstCharacterSpawn).not.toEqual(laterCharacterSpawn);
  });

  it("keeps an NPC destination stable when the active population changes", () => {
    const destination = { x: 320, y: 300 };
    const firstCharacterPoint = neighborhoodNpcDestinationPoint(destination, 0);
    const laterCharacterPoint = neighborhoodNpcDestinationPoint(destination, 4);
    expect(neighborhoodNpcDestinationPoint(destination, 0)).toEqual(firstCharacterPoint);
    expect(neighborhoodNpcDestinationPoint(destination, 4)).toEqual(laterCharacterPoint);
    expect(firstCharacterPoint).not.toEqual(destination);
    expect(neighborhoodNpcDestinationPoint(destination, -1)).toBeNull();
  });

  it("keeps NPC destinations clear of building and obstacle footprints", () => {
    const occupied = [{ left: 70, top: 70, width: 180, height: 180 }];
    const point = neighborhoodNpcDestinationPoint({ x: 100, y: 100 }, 0, occupied);
    expect(point).not.toBeNull();
    expect(
      point!.x >= 48 && point!.x <= 272 && point!.y >= 48 && point!.y <= 272,
    ).toBe(false);
  });

  it("returns null when every deterministic destination candidate is blocked", () => {
    const occupied = [{ left: -10_000, top: -10_000, width: 20_000, height: 20_000 }];
    expect(neighborhoodNpcDestinationPoint({ x: 100, y: 100 }, 0, occupied)).toBeNull();
  });

  it("moves overflow candidates clear of building and obstacle footprints", () => {
    const occupied = [{ left: 70, top: 70, width: 180, height: 180 }];
    const point = neighborhoodNpcSpawnPoint([{ x: 100, y: 100 }], 0, occupied);
    expect(point).not.toBeNull();
    expect(
      point!.x >= 48 && point!.x <= 272 && point!.y >= 48 && point!.y <= 272,
    ).toBe(false);
  });

  it("returns null when every deterministic candidate is blocked", () => {
    const occupied = [{ left: -10_000, top: -10_000, width: 20_000, height: 20_000 }];
    expect(neighborhoodNpcSpawnPoint([{ x: 100, y: 100 }], 0, occupied)).toBeNull();
  });

  it("keeps spawn positions inside scene bounds", () => {
    const point = neighborhoodNpcSpawnPoint([{ x: NEIGHBORHOOD_SCENE_BOUNDS.left, y: 0 }], 0);
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThanOrEqual(NEIGHBORHOOD_SCENE_BOUNDS.left + 21);
    expect(point!.x).toBeLessThanOrEqual(
      NEIGHBORHOOD_SCENE_BOUNDS.left + NEIGHBORHOOD_SCENE_BOUNDS.width - 21,
    );
  });

  it("keeps destination positions inside scene bounds", () => {
    const point = neighborhoodNpcDestinationPoint(
      { x: NEIGHBORHOOD_SCENE_BOUNDS.left, y: 0 },
      0,
    );
    expect(point).not.toBeNull();
    expect(point!.x).toBeGreaterThanOrEqual(NEIGHBORHOOD_SCENE_BOUNDS.left + 21);
    expect(point!.x).toBeLessThanOrEqual(
      NEIGHBORHOOD_SCENE_BOUNDS.left + NEIGHBORHOOD_SCENE_BOUNDS.width - 21,
    );
  });

  it("keeps spawn positions separated from already assigned NPCs", () => {
    const point = neighborhoodNpcSpawnPoint([{ x: 100, y: 100 }], 0, [], [{ x: 100, y: 100 }]);
    expect(point).not.toBeNull();
    expect(Math.hypot(point!.x - 100, point!.y - 100)).toBeGreaterThanOrEqual(42);
  });

  it("keeps destination positions separated from other NPC destinations", () => {
    const point = neighborhoodNpcDestinationPoint(
      { x: 100, y: 100 },
      0,
      [],
      [{ x: 100, y: 100 }],
    );
    expect(point).not.toBeNull();
    expect(Math.hypot(point!.x - 100, point!.y - 100)).toBeGreaterThanOrEqual(42);
  });

  it("routes around a blocking obstacle instead of crossing its footprint", () => {
    const route = neighborhoodNpcPath(
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      [{ left: 70, top: -30, width: 60, height: 60 }],
    );
    expect(route).not.toBeNull();
    expect(route!.length).toBeGreaterThan(2);
    expect(
      route!.some(
        (point) =>
          point.x >= 48 && point.x <= 152 && point.y >= -52 && point.y <= 52,
      ),
    ).toBe(false);
  });

  it("returns null when no route exists inside the scene bounds", () => {
    const route = neighborhoodNpcPath(
      { x: NEIGHBORHOOD_SCENE_BOUNDS.left + 20, y: 0 },
      { x: NEIGHBORHOOD_SCENE_BOUNDS.left + 20, y: 100 },
      [{ left: NEIGHBORHOOD_SCENE_BOUNDS.left - 100, top: -1000, width: 200, height: 2000 }],
    );
    expect(route).toBeNull();
  });

  it("returns null when there are no anchors or the index is invalid", () => {
    expect(neighborhoodNpcSpawnPoint([], 0)).toBeNull();
    expect(neighborhoodNpcSpawnPoint(slots, -1)).toBeNull();
    expect(neighborhoodNpcSpawnPoint(slots, 1.5)).toBeNull();
  });
});

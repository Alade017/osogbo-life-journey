import { describe, expect, it } from "vitest";
import { NEIGHBORHOOD_SCENE_BOUNDS } from "@/game/neighborhood-geometry";
import { neighborhoodNpcAvoidanceStep, neighborhoodNpcDestinationPoint, neighborhoodNpcPath, neighborhoodNpcSpawnPoint } from "@/game/neighborhood-npc-layout";

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

  it("keeps every returned path segment clear of obstacle footprints", () => {
    const start = { x: 0, y: 0 };
    const destination = { x: 200, y: 0 };
    const obstacle = { left: 70, top: -30, width: 60, height: 60 };
    const route = neighborhoodNpcPath(start, destination, [obstacle]);
    expect(route).not.toBeNull();
    const points = [start, ...route!];
    for (let segment = 1; segment < points.length; segment += 1) {
      const from = points[segment - 1]!;
      const to = points[segment]!;
      const samples = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 8));
      for (let sample = 0; sample <= samples; sample += 1) {
        const progress = sample / samples;
        const x = from.x + (to.x - from.x) * progress;
        const y = from.y + (to.y - from.y) * progress;
        expect(
          x >= obstacle.left - 22 &&
          x <= obstacle.left + obstacle.width + 22 &&
          y >= obstacle.top - 22 &&
          y <= obstacle.top + obstacle.height + 22,
        ).toBe(false);
      }
    }
  });

  it("routes around a previously reserved NPC corridor", () => {
    const reserved = [
      { x: 0, y: 0 },
      { x: 200, y: 0 },
    ];
    const route = neighborhoodNpcPath(
      { x: 100, y: -200 },
      { x: 100, y: 200 },
      [],
      NEIGHBORHOOD_SCENE_BOUNDS,
      [reserved],
    );
    expect(route).not.toBeNull();
    const points = [{ x: 100, y: -200 }, ...route!];
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1]!;
      const b = points[index]!;
      const crosses = (a.x <= 100 && b.x >= 100) || (b.x <= 100 && a.x >= 100);
      if (crosses) {
        const progress = b.x === a.x ? 0 : (100 - a.x) / (b.x - a.x);
        const y = a.y + (b.y - a.y) * progress;
        expect(Math.abs(y)).toBeGreaterThanOrEqual(21);
      }
    }
  });

  it("returns null when no route exists inside the scene bounds", () => {
    const route = neighborhoodNpcPath(
      { x: NEIGHBORHOOD_SCENE_BOUNDS.left + 20, y: 0 },
      { x: NEIGHBORHOOD_SCENE_BOUNDS.left + 20, y: 100 },
      [{ left: NEIGHBORHOOD_SCENE_BOUNDS.left - 100, top: -1000, width: 200, height: 2000 }],
    );
    expect(route).toBeNull();
  });

  it("keeps a live movement step outside another actor's separation radius", () => {
    const next = neighborhoodNpcAvoidanceStep(
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      [{ x: 1, y: 0 }],
      0.5,
      0.85,
    );
    expect(Math.hypot(next.x - 1, next.y)).toBeGreaterThanOrEqual(0.85);
  });

  it("rejects a step whose swept segment clips a nearby actor", () => {
    const current = { x: 0, y: 0 };
    const next = neighborhoodNpcAvoidanceStep(
      current,
      { x: 10, y: 0 },
      [{ x: 0.25, y: 0 }],
      0.5,
      0.4,
    );
    expect(next).toEqual(current);
  });

  it("waits in place when every live movement alternative is occupied", () => {
    const current = { x: 0, y: 0 };
    const next = neighborhoodNpcAvoidanceStep(
      current,
      { x: 10, y: 0 },
      [
        { x: 0.5, y: 0 },
        { x: -0.5, y: 0 },
        { x: 0, y: 0.5 },
        { x: 0, y: -0.5 },
      ],
      0.5,
      0.85,
    );
    expect(next).toEqual(current);
  });

  it("returns null when there are no anchors or the index is invalid", () => {
    expect(neighborhoodNpcSpawnPoint([], 0)).toBeNull();
    expect(neighborhoodNpcSpawnPoint(slots, -1)).toBeNull();
    expect(neighborhoodNpcSpawnPoint(slots, 1.5)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { neighborhoodNpcSpawnPoint } from "@/game/neighborhood-npc-layout";

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

  it("returns null when there are no anchors or the index is invalid", () => {
    expect(neighborhoodNpcSpawnPoint([], 0)).toBeNull();
    expect(neighborhoodNpcSpawnPoint(slots, -1)).toBeNull();
    expect(neighborhoodNpcSpawnPoint(slots, 1.5)).toBeNull();
  });
});

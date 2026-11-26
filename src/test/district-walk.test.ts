import { describe, expect, it } from "vitest";
import {
  WALKER_RADIUS_M,
  WALKER_SPAWN,
  blocked,
  lerpAngle,
  moveFromInput,
  moveWalker,
  solidsFor,
} from "../game/districts/district-walk.ts";
import { OLAIYA_JUNCTION as L } from "../game/districts/olaiya-junction.ts";

const solids = solidsFor(L);
const half = L.sizeM / 2;

describe("Olaiya walking", () => {
  it("starts the walker on open ground", () => {
    expect(blocked(WALKER_SPAWN.x, WALKER_SPAWN.z, solids)).toBe(false);
  });

  it("stops at a house wall instead of walking through it", () => {
    const lot = L.lots.find((l) => l.archetype === "compound")!;
    const front = lot.z + lot.d / 2;
    const end = moveWalker({ x: lot.x, z: front + 2 }, 0, -6, solids, half);
    expect(end.z).toBeGreaterThanOrEqual(front + WALKER_RADIUS_M - 0.05);
  });

  it("slides along a wall when pushed diagonally into it", () => {
    const lot = L.lots.find((l) => l.archetype === "compound")!;
    const front = lot.z + lot.d / 2;
    const end = moveWalker({ x: lot.x - 5, z: front + 2 }, 4, -4, solids, half);
    expect(end.x).toBeGreaterThan(lot.x - 5);
    expect(end.z).toBeGreaterThanOrEqual(front + WALKER_RADIUS_M - 0.05);
  });

  it("keeps the walker inside the district", () => {
    const end = moveWalker({ x: 0, z: 0 }, 1000, 1000, [], half);
    expect(end.x).toBeLessThanOrEqual(half - 1);
    expect(end.z).toBeLessThanOrEqual(half - 1);
  });

  it("lets a walker reach every shop access point from the spawn", () => {
    const cell = 2;
    const n = L.sizeM / cell;
    const toCell = (v: number) => Math.round((v + half - cell / 2) / cell);
    const open = (i: number, j: number) => {
      const x = -half + cell / 2 + i * cell;
      const z = -half + cell / 2 + j * cell;
      return !blocked(x, z, solids);
    };
    const start = [toCell(WALKER_SPAWN.x), toCell(WALKER_SPAWN.z)] as const;
    const seen = new Set<string>([`${start[0]},${start[1]}`]);
    const queue: [number, number][] = [[start[0], start[1]]];
    while (queue.length) {
      const [i, j] = queue.shift()!;
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const a = i + di;
        const b = j + dj;
        if (a < 0 || b < 0 || a >= n || b >= n) continue;
        const key = `${a},${b}`;
        if (seen.has(key) || !open(a, b)) continue;
        seen.add(key);
        queue.push([a, b]);
      }
    }
    for (const place of L.places) {
      expect(seen.has(`${toCell(place.access.x)},${toCell(place.access.z)}`), place.id).toBe(true);
    }
  });
});

describe("walk input", () => {
  const none = { forward: false, back: false, left: false, right: false };

  it("does not move with no keys held", () => {
    expect(moveFromInput(none, 0, 1)).toEqual({ dx: 0, dz: 0 });
  });

  it("walks away from the camera when forward is held", () => {
    // Camera yaw 0 sits on the +z side, so forward is -z.
    const { dx, dz } = moveFromInput({ ...none, forward: true }, 0, 1);
    expect(dx).toBeCloseTo(0);
    expect(dz).toBeCloseTo(-1);
  });

  it("strafes right in the camera's frame", () => {
    const { dx, dz } = moveFromInput({ ...none, right: true }, 0, 1);
    expect(dx).toBeCloseTo(1);
    expect(dz).toBeCloseTo(0);
  });

  it("follows the camera when it turns", () => {
    const { dx, dz } = moveFromInput({ ...none, forward: true }, Math.PI / 2, 1);
    expect(dx).toBeCloseTo(-1);
    expect(dz).toBeCloseTo(0);
  });

  it("keeps diagonal speed equal to straight speed", () => {
    const { dx, dz } = moveFromInput({ ...none, forward: true, right: true }, 0.7, 2);
    expect(Math.hypot(dx, dz)).toBeCloseTo(2);
  });

  it("turns the short way round between angles", () => {
    expect(lerpAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.5)).toBeCloseTo(Math.PI, 5);
    expect(lerpAngle(0, 1, 0.5)).toBeCloseTo(0.5);
  });
});

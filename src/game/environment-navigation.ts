import type { VenueFixture } from "@/lib/location-venue-designs";
import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

export const ENVIRONMENT_STAGE = { width: 9, depth: 7 } as const;
const PLAYER_CLEARANCE = 0.3;
const APPROACH_GAP = 0.5;

const FOOTPRINTS: Record<VenueFixture["kind"], { width: number; depth: number }> = {
  counter: { width: 2.1, depth: 1.1 },
  table: { width: 2.1, depth: 1.45 },
  bench: { width: 1.8, depth: 0.75 },
  shelf: { width: 1.8, depth: 0.85 },
  screen: { width: 1.1, depth: 0.55 },
  display: { width: 1.4, depth: 1.1 },
  planter: { width: 1.1, depth: 1.1 },
  seat: { width: 1.8, depth: 0.75 },
};

export function environmentStageToModel(
  point: WalkPoint,
  scaleX: number,
  scaleZ: number,
): [number, number] {
  return [point[0] * scaleX, point[1] * scaleZ];
}

export function environmentModelToStage(
  point: WalkPoint,
  scaleX: number,
  scaleZ: number,
): [number, number] {
  return [point[0] / scaleX, point[1] / scaleZ];
}

/** Collision-aware walking for GLB environments. Coordinates match the 9×7 authored fixture stage. */
export function environmentNavigation(fixtures: readonly VenueFixture[]) {
  const obstacles = fixtures.map((fixture) => ({
    x: fixture.position[0],
    z: fixture.position[1],
    ...FOOTPRINTS[fixture.kind],
  }));

  const canWalk = ([x, z]: WalkPoint) =>
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) < ENVIRONMENT_STAGE.width / 2 - PLAYER_CLEARANCE &&
    Math.abs(z) < ENVIRONMENT_STAGE.depth / 2 - PLAYER_CLEARANCE &&
    obstacles.every(
      (item) =>
        Math.abs(x - item.x) > item.width / 2 + PLAYER_CLEARANCE ||
        Math.abs(z - item.z) > item.depth / 2 + PLAYER_CLEARANCE,
    );

  const route = (from: WalkPoint, to: WalkPoint) =>
    findGridWalkPath(from, to, canWalk);

  function nearest(point: WalkPoint): WalkPoint | null {
    if (!point.every(Number.isFinite)) return null;
    const snapped: WalkPoint = [
      Math.round(point[0] * 2) / 2,
      Math.round(point[1] * 2) / 2,
    ];
    if (canWalk(snapped)) return snapped;
    for (let radius = 0.5; radius <= 2.5; radius += 0.5) {
      for (let dx = -radius; dx <= radius; dx += 0.5) {
        for (const dz of [-radius, radius]) {
          const candidate: WalkPoint = [snapped[0] + dx, snapped[1] + dz];
          if (canWalk(candidate)) return candidate;
        }
      }
      for (let dz = -radius + 0.5; dz < radius; dz += 0.5) {
        for (const dx of [-radius, radius]) {
          const candidate: WalkPoint = [snapped[0] + dx, snapped[1] + dz];
          if (canWalk(candidate)) return candidate;
        }
      }
    }
    return null;
  }

  function approach(from: WalkPoint, fixture: VenueFixture): WalkPoint[] | null {
    const footprint = FOOTPRINTS[fixture.kind];
    const [x, z] = fixture.position;
    const gap = APPROACH_GAP + PLAYER_CLEARANCE;
    const candidates: WalkPoint[] = [
      [x, z + footprint.depth / 2 + gap],
      [x, z - footprint.depth / 2 - gap],
      [x - footprint.width / 2 - gap, z],
      [x + footprint.width / 2 + gap, z],
    ];
    let best: WalkPoint[] | null = null;
    for (const target of candidates) {
      if (!canWalk(target)) continue;
      const path = route(from, target);
      if (path && (!best || path.length < best.length)) best = path;
    }
    return best;
  }

  return {
    canWalk,
    route,
    nearest,
    approach,
    spawn: [0, ENVIRONMENT_STAGE.depth / 2 - 0.65] as WalkPoint,
  };
}

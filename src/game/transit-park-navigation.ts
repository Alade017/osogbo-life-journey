import type { VenueFixture } from "@/lib/location-venue-designs";
import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

const HALF_WIDTH = 5.5;
const HALF_DEPTH = 4;
const CLEARANCE = 0.3;
const FOOTPRINTS: Record<VenueFixture["kind"], { width: number; depth: number }> = {
  counter: { width: 1.8, depth: 0.7 },
  table: { width: 2.1, depth: 1.1 },
  bench: { width: 1.9, depth: 0.7 },
  shelf: { width: 1.2, depth: 0.7 },
  screen: { width: 1.7, depth: 0.3 },
  display: { width: 1.2, depth: 0.7 },
  planter: { width: 0.8, depth: 0.8 },
  seat: { width: 1.9, depth: 0.7 },
};

export const TRANSIT_PARK_SPAWN: WalkPoint = [0, 3.25];

/** Pedestrian routes avoid the rendered minibuses, fixture footprints and shelter supports. */
export function transitParkNavigation(fixtures: readonly VenueFixture[]) {
  const obstacles = [
    ...fixtures.map((fixture) => ({
      x: fixture.position[0],
      z: fixture.position[1],
      ...FOOTPRINTS[fixture.kind],
    })),
    { x: -2.3, z: -2.1, width: 1.65, depth: 3.0 },
    { x: 2.3, z: -2.1, width: 1.65, depth: 3.0 },
    ...[-4.8, 4.8].map((x) => ({ x, z: 1.15, width: 0.3, depth: 0.3 })),
  ];
  const canWalk = ([x, z]: WalkPoint) =>
    Math.abs(x) < HALF_WIDTH - CLEARANCE &&
    Math.abs(z) < HALF_DEPTH - CLEARANCE &&
    obstacles.every(
      (o) =>
        Math.abs(x - o.x) > o.width / 2 + CLEARANCE ||
        Math.abs(z - o.z) > o.depth / 2 + CLEARANCE,
    );
  const route = (from: WalkPoint, to: WalkPoint) => findGridWalkPath(from, to, canWalk);

  function approach(from: WalkPoint, fixture: VenueFixture): WalkPoint[] | null {
    const footprint = FOOTPRINTS[fixture.kind];
    const [x, z] = fixture.position;
    const gap = CLEARANCE + 0.45;
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

  function nearest(point: WalkPoint): WalkPoint | null {
    if (!point.every(Number.isFinite)) return null;
    const snapped: WalkPoint = [Math.round(point[0] * 2) / 2, Math.round(point[1] * 2) / 2];
    if (canWalk(snapped)) return snapped;
    for (let radius = 0.5; radius <= 3; radius += 0.5) {
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

  return { canWalk, route, nearest, approach };
}

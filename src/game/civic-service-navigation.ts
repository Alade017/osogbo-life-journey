import type { VenueFixture } from "@/lib/location-venue-designs";
import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

const BOUNDS = { halfWidth: 6.92, halfDepth: 5.42 } as const;
const PLAYER_CLEARANCE = 0.28;
const APPROACH_GAP = 0.48;
const FOOTPRINTS: Record<VenueFixture["kind"], { width: number; depth: number }> = {
  counter: { width: 3.2, depth: 0.95 },
  table: { width: 2.4, depth: 1.1 },
  bench: { width: 2.4, depth: 1.4 },
  shelf: { width: 1.2, depth: 0.65 },
  screen: { width: 1.8, depth: 0.2 },
  display: { width: 1.2, depth: 0.7 },
  planter: { width: 0.7, depth: 0.7 },
  seat: { width: 2.4, depth: 1.4 },
};

export const CIVIC_SERVICE_SPAWN: WalkPoint = [0, 3.8];

/** Mirrors the civic scene shell and keeps the staff-only office behind its L-shaped partition. */
export function civicServiceNavigation(fixtures: readonly VenueFixture[]) {
  const obstacles = [
    ...fixtures.map((fixture) => ({
      x: fixture.position[0],
      z: fixture.position[1],
      ...FOOTPRINTS[fixture.kind],
    })),
    // Entrance threshold and the two planters are rendered into the civic shell.
    { x: 0, z: 5.1, width: 2.4, depth: 0.65 },
    { x: -6.1, z: 4.4, width: 0.9, depth: 0.9 },
    { x: 6.1, z: 4.4, width: 0.9, depth: 0.9 },
  ];

  const canWalk = ([x, z]: WalkPoint) => {
    if (
      Math.abs(x) >= BOUNDS.halfWidth - PLAYER_CLEARANCE ||
      Math.abs(z) >= BOUNDS.halfDepth - PLAYER_CLEARANCE
    ) return false;

    const verticalPartition =
      Math.abs(x - 0.8) <= 0.06 + PLAYER_CLEARANCE &&
      z >= -5.5 - PLAYER_CLEARANCE &&
      z <= -2.7 + PLAYER_CLEARANCE;
    const horizontalPartition =
      Math.abs(z + 2.2) <= 0.06 + PLAYER_CLEARANCE &&
      x >= 0.85 - PLAYER_CLEARANCE &&
      x <= 7 + PLAYER_CLEARANCE;
    if (verticalPartition || horizontalPartition) return false;

    return obstacles.every(
      (obstacle) =>
        Math.abs(x - obstacle.x) > obstacle.width / 2 + PLAYER_CLEARANCE ||
        Math.abs(z - obstacle.z) > obstacle.depth / 2 + PLAYER_CLEARANCE,
    );
  };

  const route = (from: WalkPoint, to: WalkPoint) => findGridWalkPath(from, to, canWalk);

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

  return { canWalk, route, nearest, approach };
}

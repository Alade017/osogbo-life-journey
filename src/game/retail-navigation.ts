import type { VenueFixture } from "@/lib/location-venue-designs";
import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

const HALF_WIDTH = 8;
const HALF_DEPTH = 7;
const PLAYER_CLEARANCE = 0.3;
const APPROACH_GAP = 0.5;

// These footprints match the meshes rendered by RetailInteriorScene, not the
// smaller generic furniture proxies used by the basic venue scene.
const RETAIL_FOOTPRINTS: Record<VenueFixture["kind"], { width: number; depth: number }> = {
  counter: { width: 3.7, depth: 1.25 },
  shelf: { width: 3.6, depth: 0.85 },
  seat: { width: 2.3, depth: 0.65 },
  display: { width: 2, depth: 1.6 },
  table: { width: 2, depth: 1.6 },
  bench: { width: 2.3, depth: 0.65 },
  screen: { width: 1.2, depth: 0.8 },
  planter: { width: 1.2, depth: 0.85 },
};

/** Navigation for the 16×14 retail gallery, matching rendered fixtures and queue guides. */
export function retailNavigation(fixtures: readonly VenueFixture[]) {
  const obstacles = [
    ...fixtures.map((fixture) => ({
      x: fixture.position[0],
      z: fixture.position[1],
      ...RETAIL_FOOTPRINTS[fixture.kind],
    })),
    // Queue-guide bases are wider than their metal posts.
    { x: 2.4, z: 5.5, width: 0.35, depth: 0.35 },
    { x: 5.6, z: 5.5, width: 0.35, depth: 0.35 },
  ];

  const canWalk = ([x, z]: WalkPoint) =>
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x > -HALF_WIDTH + PLAYER_CLEARANCE + 0.18 &&
    x < HALF_WIDTH - PLAYER_CLEARANCE - 0.18 &&
    z > -HALF_DEPTH + PLAYER_CLEARANCE + 0.18 &&
    z < HALF_DEPTH - PLAYER_CLEARANCE - 0.18 &&
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
    const footprint = RETAIL_FOOTPRINTS[fixture.kind];
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

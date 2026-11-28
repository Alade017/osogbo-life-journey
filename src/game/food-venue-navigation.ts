import { findGridWalkPath, type WalkPoint } from "@/game/grid-walk-path";
import { FOOD_VENUE_LAYOUTS, type FoodVenueVariant } from "@/game/food-venue-layout";
import type { VenueFixture } from "@/lib/location-venue-designs";

type Solid = { x: number; z: number; width: number; depth: number };
const PLAYER_RADIUS = 0.32;
const APPROACH_GAP = 0.62;

function fixtureSolid(fixture: VenueFixture): Solid {
  const footprint = fixture.kind === "counter"
    ? { width: 5.8, depth: 1.15 }
    : fixture.kind === "table"
      ? { width: 3.2, depth: 2.5 }
      : { width: 1.2, depth: 0.85 };
  return { x: fixture.position[0], z: fixture.position[1], ...footprint };
}

/** Collision geometry follows the oversized serving line and bench-table models in BukaInteriorScene. */
export function foodVenueNavigation(variant: FoodVenueVariant, fixtures: readonly VenueFixture[]) {
  const { width, depth } = FOOD_VENUE_LAYOUTS[variant];
  const solids = fixtures.map(fixtureSolid);
  const canWalk = ([x, z]: WalkPoint) => {
    if (![x, z].every(Number.isFinite)) return false;
    if (Math.abs(x) > width / 2 - PLAYER_RADIUS || z > depth / 2 - PLAYER_RADIUS || z < -depth / 2 + 0.55) return false;
    return solids.every((solid) =>
      Math.abs(x - solid.x) >= solid.width / 2 + PLAYER_RADIUS ||
      Math.abs(z - solid.z) >= solid.depth / 2 + PLAYER_RADIUS
    );
  };
  const route = (from: WalkPoint, to: WalkPoint) => findGridWalkPath(from, to, canWalk);
  const nearest = (point: WalkPoint): WalkPoint | null => {
    if (canWalk(point)) return point;
    for (let radius = 0.5; radius <= 4; radius += 0.5) {
      const candidates: WalkPoint[] = [
        [point[0] + radius, point[1]], [point[0] - radius, point[1]],
        [point[0], point[1] + radius], [point[0], point[1] - radius],
        [point[0] + radius, point[1] + radius], [point[0] - radius, point[1] + radius],
        [point[0] + radius, point[1] - radius], [point[0] - radius, point[1] - radius],
      ];
      const found = candidates.find(canWalk);
      if (found) return found;
    }
    return null;
  };
  const approach = (from: WalkPoint, fixture: VenueFixture) => {
    const solid = fixtureSolid(fixture);
    const gap = APPROACH_GAP + PLAYER_RADIUS;
    const candidates: WalkPoint[] = [
      [solid.x, solid.z + solid.depth / 2 + gap],
      [solid.x, solid.z - solid.depth / 2 - gap],
      [solid.x - solid.width / 2 - gap, solid.z],
      [solid.x + solid.width / 2 + gap, solid.z],
    ];
    let best: WalkPoint[] | null = null;
    for (const target of candidates) {
      if (!canWalk(target)) continue;
      const path = route(from, target);
      if (path && (!best || path.length < best.length)) best = path;
    }
    return best;
  };
  const spawnPoint: WalkPoint = [0, depth / 2 - 0.8];
  const spawn = nearest(spawnPoint) ?? spawnPoint;
  return { spawn: [spawn[0], 0.06, spawn[1]] as [number, number, number], canWalk, route, nearest, approach };
}

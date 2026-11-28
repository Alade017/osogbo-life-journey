import type { VenueFixture } from "@/lib/location-venue-designs";
import { findGridWalkPath, type WalkPoint } from "@/game/grid-walk-path";

const PLAYER_RADIUS = 0.28;
const APPROACH_GAP = 0.5;
const MARKET_FIXTURE_FOOTPRINTS: Record<VenueFixture["kind"], { width: number; depth: number }> = {
  counter: { width: 2.55, depth: 1.95 },
  shelf: { width: 2.55, depth: 1.95 },
  table: { width: 2.55, depth: 1.95 },
  bench: { width: 1.8, depth: 0.7 },
  seat: { width: 1.8, depth: 0.7 },
  screen: { width: 1.5, depth: 0.55 },
  display: { width: 1.8, depth: 1.2 },
  planter: { width: 1.1, depth: 1.1 },
};

/** Navigation matches the Oja-Oba hall's 11×8 floor, rear wall and authored stall footprints. */
export function marketNavigation(fixtures: readonly VenueFixture[]) {
  const obstacles = fixtures.map((fixture) => ({
    x: fixture.position[0],
    z: fixture.position[1],
    ...MARKET_FIXTURE_FOOTPRINTS[fixture.kind],
  }));
  const canWalk = ([x, z]: WalkPoint) =>
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) < 5.5 - PLAYER_RADIUS &&
    z > -3.55 + PLAYER_RADIUS &&
    z < 3.65 - PLAYER_RADIUS &&
    obstacles.every(
      (item) =>
        Math.abs(x - item.x) > item.width / 2 + PLAYER_RADIUS ||
        Math.abs(z - item.z) > item.depth / 2 + PLAYER_RADIUS,
    );
  const route = (from: WalkPoint, to: WalkPoint) =>
    findGridWalkPath(from, to, canWalk);
  function approach(from: WalkPoint, fixture: VenueFixture) {
    const footprint = MARKET_FIXTURE_FOOTPRINTS[fixture.kind];
    const [x, z] = fixture.position;
    const gap = APPROACH_GAP + PLAYER_RADIUS;
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
  return { canWalk, route, approach };
}

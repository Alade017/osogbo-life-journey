import type { VenueFixture } from "@/lib/location-venue-designs";
import { findGridWalkPath, type WalkPoint } from "@/game/grid-walk-path";

type Footprint = { width: number; depth: number };
const FIXTURE_FOOTPRINTS: Record<VenueFixture["kind"], Footprint> = {
  counter: { width: 1.8, depth: 0.9 },
  table: { width: 1.5, depth: 1.1 },
  bench: { width: 1.4, depth: 0.65 },
  shelf: { width: 1.35, depth: 0.55 },
  screen: { width: 1.35, depth: 0.35 },
  display: { width: 1.25, depth: 0.9 },
  planter: { width: 0.7, depth: 0.7 },
  seat: { width: 0.9, depth: 0.9 },
};

const PLAYER_CLEARANCE = 0.28;
const APPROACH_GAP = 0.48;

/** Grid navigation for the simple rectangular venue shell. Specialized interiors use their own navigation. */
export function venueNavigation(
  fixtures: readonly VenueFixture[],
  width: number,
  depth: number,
) {
  const obstacles = fixtures.map((fixture) => {
    const footprint = FIXTURE_FOOTPRINTS[fixture.kind];
    return {
      x: fixture.position[0],
      z: fixture.position[1],
      width: footprint.width,
      depth: footprint.depth,
    };
  });
  const canWalk = ([x, z]: WalkPoint) =>
    Math.abs(x) < width / 2 - PLAYER_CLEARANCE &&
    Math.abs(z) < depth / 2 - PLAYER_CLEARANCE &&
    // The base venue shell has a solid rear wall and a solid left wall.
    z < depth / 2 - 0.55 &&
    x > -width / 2 + 0.55 &&
    obstacles.every(
      (obstacle) =>
        Math.abs(x - obstacle.x) > obstacle.width / 2 + PLAYER_CLEARANCE ||
        Math.abs(z - obstacle.z) > obstacle.depth / 2 + PLAYER_CLEARANCE,
    );

  const route = (from: WalkPoint, to: WalkPoint) =>
    findGridWalkPath(from, to, canWalk);

  function approach(from: WalkPoint, fixture: VenueFixture) {
    const footprint = FIXTURE_FOOTPRINTS[fixture.kind];
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

  return { canWalk, route, approach };
}

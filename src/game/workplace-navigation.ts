import type { VenueFixture } from "@/lib/location-venue-designs";
import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";
import { WORKPLACE_FOOTPRINTS, WORKPLACE_LAYOUT as layout } from "./workplace-layout";

export const workplaceSpawn: WalkPoint = [0, layout.depth / 2 - 0.75];

// Rectangles are shared with the meshes so changing a partition also changes its collision.
export const workplacePartition = { x: -4.2, z: 2.8, width: 4.8, depth: 0.15 };
export const workplaceGlass = { x: 1.1, z: 1.6, width: 0.06, depth: 1.8 };
export const workplacePlants: readonly WalkPoint[] = [
  [-6.3, -5.2],
  [6.3, -5.2],
  [-6.3, 4.9],
];
const clearance = 0.32;

export function workplaceNavigation(fixtures: readonly VenueFixture[]) {
  const obstacles = [
    workplacePartition,
    workplaceGlass,
    {
      x: -layout.entranceWidth / 2,
      z: layout.depth / 2 - layout.entranceWidth / 2,
      width: 0.12,
      depth: layout.entranceWidth,
    },
    ...workplacePlants.map(([x, z]) => ({ x, z, width: 0.65, depth: 0.65 })),
    ...fixtures.flatMap((f) =>
      f.workplaceFeature
        ? [{ x: f.position[0], z: f.position[1], ...WORKPLACE_FOOTPRINTS[f.workplaceFeature] }]
        : [],
    ),
  ];
  const canWalk = ([x, z]: WalkPoint) =>
    Math.abs(x) < layout.width / 2 - clearance - 0.15 &&
    Math.abs(z) < layout.depth / 2 - clearance - 0.15 &&
    obstacles.every(
      (o) =>
        Math.abs(x - o.x) > o.width / 2 + clearance || Math.abs(z - o.z) > o.depth / 2 + clearance,
    );
  const route = (from: WalkPoint, to: WalkPoint) => findGridWalkPath(from, to, canWalk);
  function approach(from: WalkPoint, fixture: VenueFixture) {
    if (!fixture.workplaceFeature) return null;
    const { width, depth } = WORKPLACE_FOOTPRINTS[fixture.workplaceFeature];
    const [x, z] = fixture.position;
    const margin = clearance + 0.38;
    const points: WalkPoint[] = [
      [x, z + depth / 2 + margin],
      [x, z - depth / 2 - margin],
      [x - width / 2 - margin, z],
      [x + width / 2 + margin, z],
    ];
    let best: WalkPoint[] | null = null;
    for (const point of points) {
      const path = route(from, point);
      if (path && (!best || path.length < best.length)) best = path;
    }
    return best;
  }
  return { canWalk, route, approach };
}

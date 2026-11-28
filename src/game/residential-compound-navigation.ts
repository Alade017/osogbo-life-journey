import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";
import { RESIDENTIAL_COMPOUND, COMPOUND_FEATURES, type CompoundFeatureId } from "./residential-compound";

const HALF_WIDTH = RESIDENTIAL_COMPOUND.width / 2;
const HALF_DEPTH = RESIDENTIAL_COMPOUND.depth / 2;
const CLEARANCE = 0.32;
const APPROACH_GAP = 0.55;

type Obstacle = { x: number; z: number; width: number; depth: number };

// Footprints follow the authored courtyard meshes in ResidentialCompoundScene.
// Decorative walls are represented as solid obstacles; the front gate remains open.
const OBSTACLES: readonly Obstacle[] = [
  { x: 0, z: -9.8, width: 20, depth: 0.3 },
  { x: -9.8, z: 0, width: 0.3, depth: 20 },
  { x: 9.8, z: 0, width: 0.3, depth: 20 },
  { x: -5.8, z: 9.8, width: 8.2, depth: 0.3 },
  { x: 5.8, z: 9.8, width: 8.2, depth: 0.3 },
  { x: -1.7, z: 9.8, width: 0.4, depth: 0.4 },
  { x: 1.7, z: 9.8, width: 0.4, depth: 0.4 },
  // Main private home frontage at z=-5.
  { x: 0, z: -5, width: 6.2, depth: 4.2 },
  // Two neighbouring private frontages, rotated by 90 degrees.
  { x: -7, z: 0, width: 4.2, depth: 6.2 },
  { x: 7, z: 0, width: 4.2, depth: 6.2 },
  // Shared facilities and seating.
  { x: -2.6, z: 1.3, width: 2.6, depth: 1.0 },
  { x: -6.5, z: 6, width: 2.2, depth: 2.2 },
  { x: 5.5, z: 6, width: 3.4, depth: 1.6 },
  { x: 6.3, z: -6.2, width: 3.5, depth: 2.8 },
];

export const RESIDENTIAL_COMPOUND_SPAWN: WalkPoint = [0, 4.4];

export function residentialCompoundNavigation() {
  const canWalk = ([x, z]: WalkPoint) =>
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    x > -HALF_WIDTH + CLEARANCE &&
    x < HALF_WIDTH - CLEARANCE &&
    z > -HALF_DEPTH + CLEARANCE &&
    z < HALF_DEPTH + CLEARANCE &&
    OBSTACLES.every(
      (obstacle) =>
        Math.abs(x - obstacle.x) > obstacle.width / 2 + CLEARANCE ||
        Math.abs(z - obstacle.z) > obstacle.depth / 2 + CLEARANCE,
    );

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

  function approach(from: WalkPoint, featureId: CompoundFeatureId): WalkPoint[] | null {
    const feature = COMPOUND_FEATURES.find((item) => item.id === featureId);
    if (!feature) return null;
    const [x, z] = [feature.x, feature.z];
    const candidates: WalkPoint[] = featureId === "home-entry"
      ? [[0, -2.2], [-1.8, -2.2], [1.8, -2.2]]
      : [
          [x, z + 1.6 + APPROACH_GAP],
          [x, z - 1.6 - APPROACH_GAP],
          [x - 1.8 - APPROACH_GAP, z],
          [x + 1.8 + APPROACH_GAP, z],
        ];
    let best: WalkPoint[] | null = null;
    for (const candidate of candidates) {
      if (!canWalk(candidate)) continue;
      const path = route(from, candidate);
      if (path && (!best || path.length < best.length)) best = path;
    }
    return best;
  }

  return { canWalk, route, nearest, approach };
}

import type { WorldPoint } from "./neighborhood-model";

/** A pedestrian who walks between nearby footpath spots, one after another, forever. */
export type Walker = {
  x: number;
  y: number;
  targets: readonly WorldPoint[];
  next: number;
};

/** How many nearby footpath spots a pedestrian cycles through. */
const WALK_TARGETS = 3;
/** Pedestrians walk at this many street units per second. */
export const WALK_SPEED = 9;

/**
 * Gives each pedestrian a short loop of the nearest other footpath spots. Deterministic, so the
 * street looks the same on every visit.
 */
export function createWalkers(spots: readonly WorldPoint[]): Walker[] {
  return spots.map((spot, index) => {
    const others = spots
      .map((other, otherIndex) => ({
        other,
        distance:
          otherIndex === index
            ? Number.POSITIVE_INFINITY
            : Math.hypot(other.x - spot.x, other.y - spot.y),
      }))
      .filter((entry) => Number.isFinite(entry.distance))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, WALK_TARGETS)
      .map((entry) => entry.other);
    return { x: spot.x, y: spot.y, targets: others, next: 0 };
  });
}

/** Moves a walker along its loop for the given distance; reaching a spot picks the next one. */
export function stepWalker(walker: Walker, distance: number): Walker {
  if (walker.targets.length === 0) return walker;
  let { x, y, next } = walker;
  let remaining = distance;
  // Bounded so a very long frame still ends in a finite number of steps.
  for (let guard = 0; guard < 8 && remaining > 0; guard += 1) {
    const target = walker.targets[next % walker.targets.length];
    if (!target) break;
    const dx = target.x - x;
    const dy = target.y - y;
    const gap = Math.hypot(dx, dy);
    if (gap <= remaining) {
      x = target.x;
      y = target.y;
      remaining -= gap;
      next = (next + 1) % walker.targets.length;
    } else {
      x += (dx / gap) * remaining;
      y += (dy / gap) * remaining;
      remaining = 0;
    }
  }
  return { ...walker, x, y, next };
}

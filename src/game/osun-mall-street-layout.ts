import { findGridWalkPath, type WalkPoint } from "./grid-walk-path.ts";
import { MALL_BODY_RADIUS } from "./osun-mall-layout.ts";

/**
 * The street outside the Osun Mall. Coordinates are [x, z] in scene units. The mall's front
 * building fills the back edge; its door is where a visitor steps back inside.
 */
export const STREET_BOUNDS = { minX: -9.2, maxX: 9.2, minZ: -4.4, maxZ: 6.2 } as const;

/** The mall's front door, on the back edge. Clicking it takes the visitor back inside. */
export const STREET_DOOR: WalkPoint = [0, -4.4];

/** Where a visitor stands after coming out of the door. */
export const STREET_DOOR_FRONT: WalkPoint = [0, -3.4];

/** Where the okada rider waits, beside the stand. */
export const STREET_RIDER_SPOT: WalkPoint = [-5.6, 4.4];

export type StreetRect = { id: string; minX: number; maxX: number; minZ: number; maxZ: number };

/** Kiosks, the okada stand and the shelter. Nobody can walk through them. */
export const STREET_OBSTACLES: readonly StreetRect[] = [
  { id: "front-rail-left", minX: -8.4, maxX: -1.8, minZ: -3.15, maxZ: -3.05 },
  { id: "front-rail-right", minX: 1.8, maxX: 8.4, minZ: -3.15, maxZ: -3.05 },
  { id: "okada-stand", minX: -6.8, maxX: -4.4, minZ: 2.4, maxZ: 3.6 },
  { id: "kiosk", minX: 3.6, maxX: 5.4, minZ: 1.2, maxZ: 2.2 },
  { id: "shelter", minX: -2.8, maxX: -1.2, minZ: 4.6, maxZ: 5.2 },
];

/** Spots where pedestrians stand and chat. They never walk the routes. */
export const STREET_PEDESTRIANS: readonly WalkPoint[] = [
  [-2, 1],
  [2.2, 3.2],
  [6.4, 0],
  [-7.2, 5],
  [0.4, 5.4],
];

function insideRect(point: WalkPoint, rect: StreetRect, radius: number) {
  return (
    point[0] > rect.minX - radius &&
    point[0] < rect.maxX + radius &&
    point[1] > rect.minZ - radius &&
    point[1] < rect.maxZ + radius
  );
}

/** True when a visitor's body can stand here: inside the street and clear of the obstacles. */
export function canWalkOnStreet(point: WalkPoint): boolean {
  const [x, z] = point;
  if (
    x < STREET_BOUNDS.minX + MALL_BODY_RADIUS ||
    x > STREET_BOUNDS.maxX - MALL_BODY_RADIUS ||
    z < STREET_BOUNDS.minZ + MALL_BODY_RADIUS ||
    z > STREET_BOUNDS.maxZ - MALL_BODY_RADIUS
  )
    return false;
  return !STREET_OBSTACLES.some((rect) => insideRect(point, rect, MALL_BODY_RADIUS));
}

/** A route along the street, or null when the destination cannot be reached. */
export function findStreetPath(from: WalkPoint, to: WalkPoint): WalkPoint[] | null {
  if (!canWalkOnStreet(to)) return null;
  return findGridWalkPath(from, to, canWalkOnStreet);
}

/**
 * Where an assigned rider should go. The rider follows the visitor, but only once the visitor has
 * stopped; small moves keep the previous target so the rider does not restart its walk each time.
 */
export function nextRiderTarget(
  previous: WalkPoint | null,
  visitor: WalkPoint,
  visitorMoving: boolean,
): WalkPoint | null {
  if (previous === null) return null;
  if (visitorMoving) return previous;
  const moved = Math.hypot(previous[0] - visitor[0], previous[1] - visitor[1]);
  return moved < 0.3 ? previous : [visitor[0], visitor[1]];
}

import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

/**
 * Walkable floor plan for the Osun Mall interior. Coordinates are [x, z] in scene units,
 * matching the venue fixtures. Shelves, tills and seats are obstacles keyed by fixture id;
 * the staff rooms and control room are restricted zones the player (and the crowd) cannot enter.
 */
export type MallRect = {
  id: string;
  label: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/** Interior walls: the floor runs x -8..8 and z -7..7, with a little margin for walls and thickness. */
export const MALL_BOUNDS = { minX: -7.6, maxX: 7.6, minZ: -6.6, maxZ: 6.6 } as const;

/** Half-width of a visitor's body; keeps paths clear of shelf edges. */
export const MALL_BODY_RADIUS = 0.3;

/** Shop fixtures and furniture. Ids match the Osun Mall venue fixtures. */
export const MALL_OBSTACLES: readonly MallRect[] = [
  { id: "mall-display", label: "Featured display", minX: -5.6, maxX: -3.6, minZ: -0.8, maxZ: 0.8 },
  { id: "mall-shelves", label: "Shop shelves", minX: 2.2, maxX: 5.8, minZ: -4.93, maxZ: -4.07 },
  { id: "mall-essentials", label: "Essentials aisle", minX: 2.2, maxX: 5.8, minZ: -1.73, maxZ: -0.87 },
  {
    id: "mall-gallery-shop",
    label: "Gallery shop display",
    minX: -5.6,
    maxX: -3.6,
    minZ: -5.3,
    maxZ: -3.7,
  },
  { id: "mall-seats", label: "Gallery seats", minX: -5.75, maxX: -3.45, minZ: 4.17, maxZ: 4.83 },
  { id: "mall-checkout", label: "Checkout counter", minX: 2.15, maxX: 5.85, minZ: 2.67, maxZ: 3.93 },
  { id: "queue-post-west", label: "Queue post", minX: 2.1, maxX: 2.7, minZ: 5.2, maxZ: 5.8 },
  { id: "queue-post-east", label: "Queue post", minX: 5.3, maxX: 5.9, minZ: 5.2, maxZ: 5.8 },
];

/** Staff-only rooms. Nobody can walk in; the staff inside stay out of the crowd's routes. */
export const MALL_RESTRICTED_ZONES: readonly MallRect[] = [
  { id: "staff-room", label: "Staff room", minX: 6, maxX: 8, minZ: -7, maxZ: -4.8 },
  { id: "control-room", label: "Control room", minX: -8, maxX: -6.2, minZ: -7, maxZ: -3.6 },
];

function insideRect(point: WalkPoint, rect: MallRect, radius: number) {
  return (
    point[0] > rect.minX - radius &&
    point[0] < rect.maxX + radius &&
    point[1] > rect.minZ - radius &&
    point[1] < rect.maxZ + radius
  );
}

/** The restricted zone a point falls in, if any. Used for the "Staff only" message. */
export function restrictedZoneAt(point: WalkPoint): MallRect | null {
  return MALL_RESTRICTED_ZONES.find((zone) => insideRect(point, zone, MALL_BODY_RADIUS)) ?? null;
}

/** True when a visitor's body can stand at this point: inside the walls, clear of shelves and restricted rooms. */
export function canWalkInMall(point: WalkPoint): boolean {
  const [x, z] = point;
  if (
    x < MALL_BOUNDS.minX + MALL_BODY_RADIUS ||
    x > MALL_BOUNDS.maxX - MALL_BODY_RADIUS ||
    z < MALL_BOUNDS.minZ + MALL_BODY_RADIUS ||
    z > MALL_BOUNDS.maxZ - MALL_BODY_RADIUS
  )
    return false;
  if (MALL_OBSTACLES.some((rect) => insideRect(point, rect, MALL_BODY_RADIUS))) return false;
  return restrictedZoneAt(point) === null;
}

/**
 * A walking route through the mall, or null when the destination cannot be reached
 * (blocked by shelves, or inside a restricted room).
 */
export function findMallPath(from: WalkPoint, to: WalkPoint): WalkPoint[] | null {
  if (!canWalkInMall(to)) return null;
  return findGridWalkPath(from, to, canWalkInMall);
}

/** Where a visitor's walk starts and ends: the main doors on the open front edge. */
export const MALL_ENTRANCE: WalkPoint = [0, 6.2];

/** Spots in front of the shelves and displays where shoppers stop to browse. */
export const MALL_BROWSE_SPOTS: readonly WalkPoint[] = [
  [-1.6, -3.2],
  [-1.6, -0.4],
  [1.2, -3.2],
  [1.2, -0.4],
  [-1.6, 2.6],
  [0.2, 1.9],
];

/** Queue spots in front of the checkout counter, in the order people join the line. */
export const MALL_TILL_QUEUE: readonly WalkPoint[] = [
  [4.5, 4.6],
  [3.5, 4.6],
  [2.5, 4.6],
  [1.5, 4.6],
];

export type MallStaffRole = "till" | "floor" | "security" | "supervisor" | "staff-room" | "control-room";

export type MallStaffMember = {
  id: string;
  role: MallStaffRole;
  position: WalkPoint;
  /** Which way they face, in scene terms. Staff stay put; they never walk the routes. */
  facing: "north" | "south" | "east" | "west";
};

/**
 * Fourteen staff: four tills, four on the floor, two at the entrance, one supervisor, and three
 * in the restricted rooms (out of the player's reach, so they are never walking routes).
 */
export const MALL_STAFF: readonly MallStaffMember[] = [
  { id: "till-1", role: "till", position: [2.6, 2.2], facing: "south" },
  { id: "till-2", role: "till", position: [3.4, 2.2], facing: "south" },
  { id: "till-3", role: "till", position: [4.6, 2.2], facing: "south" },
  { id: "till-4", role: "till", position: [5.4, 2.2], facing: "south" },
  { id: "floor-1", role: "floor", position: [-1.6, -5.6], facing: "east" },
  { id: "floor-2", role: "floor", position: [1.2, -5.6], facing: "west" },
  { id: "floor-3", role: "floor", position: [-2.6, 0.6], facing: "east" },
  { id: "floor-4", role: "floor", position: [2.6, 1.2], facing: "north" },
  { id: "security-1", role: "security", position: [-1.2, 5.8], facing: "north" },
  { id: "security-2", role: "security", position: [1.2, 5.8], facing: "north" },
  { id: "supervisor", role: "supervisor", position: [-3.6, 2.2], facing: "east" },
  { id: "staff-room-1", role: "staff-room", position: [6.6, -5.6], facing: "west" },
  { id: "staff-room-2", role: "staff-room", position: [7.2, -6.2], facing: "north" },
  { id: "control-room-1", role: "control-room", position: [-7, -5], facing: "east" },
];

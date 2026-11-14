import type { MovementIntent } from "./multiplayer-state.ts";
import { canOccupyNeighborhoodPoint, PLAYER_WORLD_BOUNDS } from "./authoritative-movement.ts";
import {
  toScene,
  type NeighborhoodObject,
  type NeighborhoodObstacle,
  type WorldPoint,
} from "./neighborhood-model.ts";

/** Grid spacing in world units (20 scene px at WORLD_SCALE 160). */
export const COMMUTE_GRID_STEP = 0.125;
/** A commute ends once the character is within this many scene pixels of the workplace. */
export const COMMUTE_ARRIVAL_PX = 40;
/** Distance in world units at which a waypoint counts as reached. */
export const COMMUTE_WAYPOINT_TOLERANCE = 0.05;
/** Upper bound on search nodes so a blocked route fails quickly. */
const MAX_SEARCH_NODES = 40000;

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function commuteArrived(point: WorldPoint, origin: WorldPoint, target: WorldPoint) {
  const scene = toScene(point, origin);
  return Math.hypot(scene.x - target.x, scene.y - target.y) <= COMMUTE_ARRIVAL_PX;
}

type SearchNode = { point: WorldPoint; parent: string | null };

/**
 * Breadth-first search on a grid anchored at the start position. Every node and the midpoint of
 * every step must be free of solid obstacles, so the returned waypoints are a walkable path.
 * Returns the waypoints, starting with the start position, or null when no route exists.
 */
export function planCommuteRoute(
  start: WorldPoint,
  target: WorldPoint,
  origin: WorldPoint,
  objects: readonly NeighborhoodObject[],
  obstacles: readonly NeighborhoodObstacle[] = [],
): WorldPoint[] | null {
  const free = (point: WorldPoint) => canOccupyNeighborhoodPoint(point, origin, objects, obstacles);
  if (!free(start)) return null;
  if (commuteArrived(start, origin, target)) return [start];

  const nodes = new Map<string, SearchNode>();
  const queue: string[] = ["0,0"];
  nodes.set("0,0", { point: start, parent: null });
  let head = 0;

  while (head < queue.length) {
    const currentKey = queue[head++]!;
    const current = nodes.get(currentKey)!;
    const [ci, cj] = currentKey.split(",").map(Number) as [number, number];

    for (const [di, dj] of DIRECTIONS) {
      const i = ci + di;
      const j = cj + dj;
      const key = `${i},${j}`;
      if (nodes.has(key)) continue;
      const point = {
        x: start.x + i * COMMUTE_GRID_STEP,
        y: start.y + j * COMMUTE_GRID_STEP,
      };
      if (
        point.x < PLAYER_WORLD_BOUNDS.minX ||
        point.x > PLAYER_WORLD_BOUNDS.maxX ||
        point.y < PLAYER_WORLD_BOUNDS.minY ||
        point.y > PLAYER_WORLD_BOUNDS.maxY
      )
        continue;
      if (!free(point)) continue;
      const midpoint = {
        x: (current.point.x + point.x) / 2,
        y: (current.point.y + point.y) / 2,
      };
      if (!free(midpoint)) continue;

      nodes.set(key, { point, parent: currentKey });
      if (commuteArrived(point, origin, target)) {
        return reconstruct(nodes, key);
      }
      if (nodes.size > MAX_SEARCH_NODES) return null;
      queue.push(key);
    }
  }
  return null;
}

function reconstruct(nodes: Map<string, SearchNode>, endKey: string): WorldPoint[] {
  const route: WorldPoint[] = [];
  let key: string | null = endKey;
  while (key !== null) {
    const node: SearchNode = nodes.get(key)!;
    route.push(node.point);
    key = node.parent;
  }
  return route.reverse();
}

/**
 * Chooses the movement intent that walks toward the next unreached waypoint. Moves along one axis
 * at a time, so the server's collision fallback keeps the character on the planned path.
 */
export function commuteIntent(
  position: WorldPoint,
  route: readonly WorldPoint[],
  index: number,
): { intent: MovementIntent | null; index: number } {
  let next = index;
  while (
    next < route.length &&
    Math.hypot(route[next]!.x - position.x, route[next]!.y - position.y) <=
      COMMUTE_WAYPOINT_TOLERANCE
  )
    next += 1;
  if (next >= route.length) return { intent: null, index: next };

  const target = route[next]!;
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { intent: { x: Math.sign(dx), y: 0 }, index: next };
  }
  return { intent: { x: 0, y: Math.sign(dy) }, index: next };
}

/** Ticks (50 ms each) without progress before the route is planned again. */
export const COMMUTE_STALL_TICKS = 40;
export const COMMUTE_MAX_REPLANS = 3;

export type CommuteContext = {
  origin: WorldPoint;
  objects: readonly NeighborhoodObject[];
  obstacles?: readonly NeighborhoodObstacle[];
};

export type CommutePlan = {
  route: WorldPoint[];
  index: number;
  target: WorldPoint;
  replans: number;
  stalledTicks: number;
  lastPosition: WorldPoint;
};

export type CommuteTick =
  { status: "moving"; intent: MovementIntent } | { status: "arrived" } | { status: "blocked" };

export function createCommutePlan(
  start: WorldPoint,
  target: WorldPoint,
  context: CommuteContext,
): CommutePlan | null {
  const route = planCommuteRoute(
    start,
    target,
    context.origin,
    context.objects,
    context.obstacles ?? [],
  );
  if (!route) return null;
  return {
    route,
    index: 0,
    target: { x: target.x, y: target.y },
    replans: 0,
    stalledTicks: 0,
    lastPosition: { x: start.x, y: start.y },
  };
}

function replan(plan: CommutePlan, position: WorldPoint, context: CommuteContext): boolean {
  if (plan.replans >= COMMUTE_MAX_REPLANS) return false;
  plan.replans += 1;
  const route = planCommuteRoute(
    position,
    plan.target,
    context.origin,
    context.objects,
    context.obstacles ?? [],
  );
  if (!route) return false;
  plan.route = route;
  plan.index = 0;
  plan.stalledTicks = 0;
  return true;
}

/**
 * Advances a commute by one server tick. Returns the movement intent to apply, or a terminal
 * status: arrived at the workplace, or blocked when no progress can be made.
 */
export function advanceCommute(
  plan: CommutePlan,
  position: WorldPoint,
  context: CommuteContext,
): CommuteTick {
  const moved = Math.hypot(position.x - plan.lastPosition.x, position.y - plan.lastPosition.y);
  plan.lastPosition = { x: position.x, y: position.y };
  plan.stalledTicks = moved < 1e-6 ? plan.stalledTicks + 1 : 0;
  if (plan.stalledTicks >= COMMUTE_STALL_TICKS && !replan(plan, position, context)) {
    return { status: "blocked" };
  }

  let step = commuteIntent(position, plan.route, plan.index);
  plan.index = step.index;
  if (!step.intent) {
    if (commuteArrived(position, context.origin, plan.target)) return { status: "arrived" };
    if (!replan(plan, position, context)) return { status: "blocked" };
    step = commuteIntent(position, plan.route, plan.index);
    plan.index = step.index;
    if (!step.intent) {
      return commuteArrived(position, context.origin, plan.target)
        ? { status: "arrived" }
        : { status: "blocked" };
    }
  }
  return { status: "moving", intent: step.intent };
}

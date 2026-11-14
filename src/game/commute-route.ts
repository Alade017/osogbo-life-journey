import type { MovementIntent } from "./multiplayer-state.ts";
import { canOccupyNeighborhoodPoint, PLAYER_WORLD_BOUNDS } from "./authoritative-movement.ts";
import {
  neighborhoodBuildingFootprint,
  neighborhoodObstacleFootprint,
} from "./neighborhood-geometry.ts";
import {
  WORLD_SCALE,
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
/**
 * Sideways drift, in world units, the walker may carry along a segment before it steers back onto
 * the planned line. Without this, drift from one waypoint carries into the next segment, the walker
 * clips a corner the planner never checked, and it stalls and replans.
 */
export const COMMUTE_LANE_TOLERANCE = 0.02;
/**
 * Margin, in world units, that every planned point and step keeps clear of solid obstacles. The
 * walker drifts a little off the line, so a route that only just fits would clip a corner.
 */
export const COMMUTE_CLEARANCE = 0.03;
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

type SearchNode = { point: WorldPoint; parent: string | null; cost: number };

type Rect = { left: number; right: number; top: number; bottom: number };

/** Solid footprints as edges, matching the boxes canOccupyNeighborhoodPoint checks. */
function solidRects(
  objects: readonly NeighborhoodObject[],
  obstacles: readonly NeighborhoodObstacle[],
): Rect[] {
  const rects: Rect[] = [];
  for (const object of objects) {
    // Matches canOccupyNeighborhoodPoint: walk-in doors and NPCs are not solid.
    if (object.kind === "npc" || object.walkIn) continue;
    const footprint = neighborhoodBuildingFootprint(object);
    rects.push({
      left: footprint.left,
      right: footprint.left + footprint.width,
      top: footprint.top,
      bottom: footprint.top + footprint.height,
    });
  }
  for (const obstacle of obstacles) {
    const footprint = neighborhoodObstacleFootprint(obstacle);
    rects.push({
      left: footprint.left,
      right: footprint.left + footprint.width,
      top: footprint.top,
      bottom: footprint.top + footprint.height,
    });
  }
  return rects;
}

/** The walker's body box, in scene pixels, clears every solid rectangle. */
function bodyClear(scene: WorldPoint, solids: readonly Rect[]) {
  const left = scene.x - 8;
  const right = scene.x + 8;
  const top = scene.y + 8;
  const bottom = scene.y + 20;
  return solids.every(
    (solid) =>
      right <= solid.left || left >= solid.right || bottom <= solid.top || top >= solid.bottom,
  );
}

/** Scene pixels to world units, using the same origin mapping as the server's toScene. */
function toWorld(scene: WorldPoint, origin: WorldPoint): WorldPoint {
  const anchor = toScene(origin, origin);
  return {
    x: origin.x + (scene.x - anchor.x) / WORLD_SCALE,
    y: origin.y + (scene.y - anchor.y) / WORLD_SCALE,
  };
}

/** Minimal binary heap of keys ordered by priority, for the open set of the search. */
class MinHeap {
  private items: { key: string; priority: number }[] = [];
  get size() {
    return this.items.length;
  }
  push(key: string, priority: number) {
    const items = this.items;
    items.push({ key, priority });
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if ((items[parent]?.priority ?? 0) <= (items[index]?.priority ?? 0)) break;
      [items[parent], items[index]] = [items[index]!, items[parent]!];
      index = parent;
    }
  }
  pop(): string | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length > 0 && last) {
      items[0] = last;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < items.length && items[left]!.priority < items[smallest]!.priority)
          smallest = left;
        if (right < items.length && items[right]!.priority < items[smallest]!.priority)
          smallest = right;
        if (smallest === index) break;
        [items[smallest], items[index]] = [items[index]!, items[smallest]!];
        index = smallest;
      }
    }
    return top?.key;
  }
}

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
  // Prefer a route with clearance; fall back to the exact fit for tight spots.
  return (
    searchRoute(start, target, origin, objects, obstacles, COMMUTE_CLEARANCE) ??
    searchRoute(start, target, origin, objects, obstacles, 0)
  );
}

function searchRoute(
  start: WorldPoint,
  target: WorldPoint,
  origin: WorldPoint,
  objects: readonly NeighborhoodObject[],
  obstacles: readonly NeighborhoodObstacle[],
  clearance: number,
): WorldPoint[] | null {
  const probes: readonly (readonly [number, number])[] = [
    [0, 0],
    [clearance, 0],
    [-clearance, 0],
    [0, clearance],
    [0, -clearance],
  ];
  // Solid boxes are measured once; each point is then tested against them, and memoised so
  // neighbouring squares that ask about the same point do not repeat the work.
  const solids = solidRects(objects, obstacles);
  const verdicts = new Map<string, boolean>();
  const free = (point: WorldPoint) => {
    const memoKey = `${Math.round(point.x * 1000)},${Math.round(point.y * 1000)}`;
    const known = verdicts.get(memoKey);
    if (known !== undefined) return known;
    const verdict = probes.every(([dx, dy]) =>
      bodyClear(toScene({ x: point.x + dx, y: point.y + dy }, origin), solids),
    );
    verdicts.set(memoKey, verdict);
    return verdict;
  };
  if (!canOccupyNeighborhoodPoint(start, origin, objects, obstacles)) return null;
  if (!free(start) && clearance > 0) return null;
  if (commuteArrived(start, origin, target)) return [start];

  // A* over the grid. The heuristic is the straight-line distance to the workplace, less the
  // arrival radius, which never overestimates the walk, so the route found is still shortest.
  const goal = toWorld(target, origin);
  const heuristic = (point: WorldPoint) =>
    Math.max(0, Math.hypot(point.x - goal.x, point.y - goal.y) - COMMUTE_ARRIVAL_PX / WORLD_SCALE);

  const nodes = new Map<string, SearchNode>();
  const open = new MinHeap();
  nodes.set("0,0", { point: start, parent: null, cost: 0 });
  open.push("0,0", heuristic(start));
  const closed = new Set<string>();

  while (open.size > 0) {
    const currentKey = open.pop()!;
    if (closed.has(currentKey)) continue;
    closed.add(currentKey);
    const current = nodes.get(currentKey)!;
    if (commuteArrived(current.point, origin, target)) return reconstruct(nodes, currentKey);
    const [ci, cj] = currentKey.split(",").map(Number) as [number, number];

    for (const [di, dj] of DIRECTIONS) {
      const i = ci + di;
      const j = cj + dj;
      const key = `${i},${j}`;
      if (closed.has(key)) continue;
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

      const cost = current.cost + COMMUTE_GRID_STEP;
      const known = nodes.get(key);
      if (known && known.cost <= cost) continue;
      nodes.set(key, { point, parent: currentKey, cost });
      if (nodes.size > MAX_SEARCH_NODES) return null;
      open.push(key, cost + heuristic(point));
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
  // Walk along the dominant axis, and steer back onto the segment when the sideways drift grows.
  if (Math.abs(dx) >= Math.abs(dy)) {
    const lane = Math.abs(dy) > COMMUTE_LANE_TOLERANCE ? Math.sign(dy) : 0;
    return { intent: { x: Math.sign(dx), y: lane as 0 | 1 | -1 }, index: next };
  }
  const lane = Math.abs(dx) > COMMUTE_LANE_TOLERANCE ? Math.sign(dx) : 0;
  return { intent: { x: lane as 0 | 1 | -1, y: Math.sign(dy) }, index: next };
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

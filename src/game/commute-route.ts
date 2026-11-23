import type { MovementIntent } from "./multiplayer-state.ts";
import {
  createNeighborhoodOccupancyChecker,
  PLAYER_WORLD_BOUNDS,
} from "./authoritative-movement.ts";
import {
  toScene,
  neighborhoodSceneBounds,
  WORLD_SCALE,
  type NeighborhoodRoad,
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
/** Include the paved shoulder when preferring road access; collision extents stay unchanged. */
const ROAD_SHOULDER_PX = 12;

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

/** Binary heap; work per insertion stays bounded even on large district searches. */
class RouteFrontier {
  private entries: { key: string; score: number; cost: number }[] = [];
  push(entry: { key: string; score: number; cost: number }) {
    const entries = this.entries;
    entries.push(entry);
    let i = entries.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (entries[parent]!.score <= entry.score) break;
      entries[i] = entries[parent]!;
      i = parent;
    }
    entries[i] = entry;
  }
  pop() {
    const first = this.entries[0];
    const last = this.entries.pop();
    if (this.entries.length && last) {
      let i = 0;
      while (i * 2 + 1 < this.entries.length) {
        let child = i * 2 + 1;
        if (
          child + 1 < this.entries.length &&
          this.entries[child + 1]!.score < this.entries[child]!.score
        )
          child++;
        if (last.score <= this.entries[child]!.score) break;
        this.entries[i] = this.entries[child]!;
        i = child;
      }
      this.entries[i] = last;
    }
    return first;
  }
}

/**
 * Collision-validated A*: prefer authored roads/access lanes without making yards impassable.
 * Search is shared by client previews and authoritative server commutes. No direct fallback.
 */
export function planCommuteRoute(
  start: WorldPoint,
  target: WorldPoint,
  origin: WorldPoint,
  objects: readonly NeighborhoodObject[],
  obstacles: readonly NeighborhoodObstacle[] = [],
  roads: readonly NeighborhoodRoad[] = [],
): WorldPoint[] | null {
  const inBounds = (point: WorldPoint) =>
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= PLAYER_WORLD_BOUNDS.minX &&
    point.x <= PLAYER_WORLD_BOUNDS.maxX &&
    point.y >= PLAYER_WORLD_BOUNDS.minY &&
    point.y <= PLAYER_WORLD_BOUNDS.maxY;
  if (!inBounds(start) || ![target.x, target.y, origin.x, origin.y].every(Number.isFinite))
    return null;
  const free = createNeighborhoodOccupancyChecker(origin, objects, obstacles);
  if (!free(start)) return null;
  if (commuteArrived(start, origin, target)) return [start];
  const bounds = neighborhoodSceneBounds(origin);
  const onRoad = (point: WorldPoint) => {
    const scene = toScene(point, origin);
    return roads.some((road) => {
      const vertical = road.axis === "vertical";
      const along = vertical ? scene.y : scene.x;
      const across = vertical ? scene.x : scene.y;
      return (
        Math.abs(across - road.offset) <= road.width / 2 + ROAD_SHOULDER_PX &&
        along >= (road.start ?? (vertical ? bounds.top : bounds.left)) &&
        along <= (road.end ?? (vertical ? bounds.top + bounds.height : bounds.left + bounds.width))
      );
    });
  };
  const estimate = (point: WorldPoint) => {
    const scene = toScene(point, origin);
    return (
      Math.max(0, Math.hypot(scene.x - target.x, scene.y - target.y) - COMMUTE_ARRIVAL_PX) /
      (COMMUTE_GRID_STEP * WORLD_SCALE)
    );
  };
  const nodes = new Map<string, SearchNode>([["0,0", { point: start, parent: null, cost: 0 }]]);
  const frontier = new RouteFrontier();
  frontier.push({ key: "0,0", score: estimate(start), cost: 0 });
  let examined = 0;
  for (let entry = frontier.pop(); entry; entry = frontier.pop()) {
    const current = nodes.get(entry.key)!;
    if (entry.cost !== current.cost) continue;
    if (commuteArrived(current.point, origin, target)) return reconstruct(nodes, entry.key);
    if (++examined > MAX_SEARCH_NODES) return null;
    const [ci, cj] = entry.key.split(",").map(Number) as [number, number];
    for (const [di, dj] of DIRECTIONS) {
      const i = ci + di,
        j = cj + dj;
      const key = `${i},${j}`;
      const point = { x: start.x + i * COMMUTE_GRID_STEP, y: start.y + j * COMMUTE_GRID_STEP };
      if (!inBounds(point) || !free(point)) continue;
      // Sample the whole step so a thin wall cannot fall between valid endpoints.
      let clear = true;
      for (let sample = 1; sample < 5; sample++) {
        const t = sample / 5;
        if (
          !free({
            x: current.point.x + (point.x - current.point.x) * t,
            y: current.point.y + (point.y - current.point.y) * t,
          })
        ) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const cost = current.cost + (roads.length && !onRoad(point) ? 2 : 1);
      const previous = nodes.get(key);
      if (previous && previous.cost <= cost) continue;
      if (!previous && nodes.size >= MAX_SEARCH_NODES) continue;
      nodes.set(key, { point, parent: entry.key, cost });
      frontier.push({ key, score: cost + estimate(point), cost });
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
  roads?: readonly NeighborhoodRoad[];
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
    context.roads ?? [],
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
    context.roads ?? [],
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

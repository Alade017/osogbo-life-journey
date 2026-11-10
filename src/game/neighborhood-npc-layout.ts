import { NEIGHBORHOOD_TILE_SIZE, type GroundRect } from "@/game/neighborhood-geometry";
import { NEIGHBORHOOD_SCENE_BOUNDS } from "@/game/neighborhood-model";
import type { NeighborhoodObject } from "@/game/neighborhood-model";

const NPC_SLOT_SPACING = NEIGHBORHOOD_TILE_SIZE * 0.425;
const NPC_CLEARANCE = 22;
const NPC_SEPARATION = 42;
const SCENE_MARGIN = NPC_SEPARATION / 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type NpcPoint = { x: number; y: number };

/**
 * Build the live corridor reservation from the actor's rendered position and
 * only the waypoints it has not reached yet. Near-duplicate points are omitted
 * so the reservation always describes the actor's actual remaining journey.
 */
export function neighborhoodNpcReservationPath(
  current: NpcPoint | null,
  waypoints: readonly NpcPoint[],
  waypointIndex = 0,
  tolerance = 0.035,
): NpcPoint[] {
  if (!Number.isInteger(waypointIndex) || waypointIndex < 0) return [];
  const remaining = waypoints.slice(waypointIndex);
  if (remaining.length === 0) return [];
  const origin = current ?? remaining[0] ?? null;
  if (!origin) return [];
  return [
    origin,
    ...remaining.filter(
      (point) => Math.hypot(point.x - origin.x, point.y - origin.y) > tolerance,
    ),
  ];
}

function isInsideScene(point: NpcPoint, bounds: GroundRect): boolean {
  return (
    point.x >= bounds.left + SCENE_MARGIN &&
    point.x <= bounds.left + bounds.width - SCENE_MARGIN &&
    point.y >= bounds.top + SCENE_MARGIN &&
    point.y <= bounds.top + bounds.height - SCENE_MARGIN
  );
}

function overlapsFootprint(point: NpcPoint, footprints: readonly GroundRect[]): boolean {
  return footprints.some(
    (footprint) =>
      point.x >= footprint.left - NPC_CLEARANCE &&
      point.x <= footprint.left + footprint.width + NPC_CLEARANCE &&
      point.y >= footprint.top - NPC_CLEARANCE &&
      point.y <= footprint.top + footprint.height + NPC_CLEARANCE,
  );
}

function overlapsNpc(point: NpcPoint, occupiedPoints: readonly NpcPoint[]): boolean {
  return occupiedPoints.some(
    (occupied) => Math.hypot(point.x - occupied.x, point.y - occupied.y) < NPC_SEPARATION,
  );
}

function isAvailable(
  point: NpcPoint,
  occupied: readonly GroundRect[],
  occupiedPoints: readonly NpcPoint[],
  bounds: GroundRect,
): boolean {
  return (
    isInsideScene(point, bounds) &&
    !overlapsFootprint(point, occupied) &&
    !overlapsNpc(point, occupiedPoints)
  );
}

/** Deterministic candidate search shared by spawn and destination positions. */
function clearNpcPoint(
  anchor: Pick<NeighborhoodObject, "x" | "y">,
  index: number,
  occupied: readonly GroundRect[],
  occupiedPoints: readonly NpcPoint[],
  baseRadius: number,
  bounds: GroundRect,
): NpcPoint | null {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const ring = Math.floor(attempt / 8) + 1;
    const angle = index * GOLDEN_ANGLE + (attempt % 8) * GOLDEN_ANGLE;
    const radius = baseRadius * Math.sqrt(ring);
    const candidate = {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    };
    if (isAvailable(candidate, occupied, occupiedPoints, bounds)) return candidate;
  }
  return null;
}

/**
 * Reuse authored NPC anchors first, then deterministically distribute overflow.
 * Candidates remain inside scene bounds and clear structures and other NPCs.
 */
export function neighborhoodNpcSpawnPoint(
  slots: readonly Pick<NeighborhoodObject, "x" | "y">[],
  index: number,
  occupied: readonly GroundRect[] = [],
  occupiedPoints: readonly NpcPoint[] = [],
  bounds: GroundRect = NEIGHBORHOOD_SCENE_BOUNDS,
): NpcPoint | null {
  if (!Number.isInteger(index) || index < 0 || slots.length === 0) return null;
  const anchor = slots[index % slots.length];
  if (!anchor) return null;
  const ring = Math.floor(index / slots.length);
  const angle = index * GOLDEN_ANGLE;
  const initialRadius = ring === 0 ? 0 : NPC_SLOT_SPACING * Math.sqrt(ring);
  const initial = {
    x: anchor.x + Math.cos(angle) * initialRadius,
    y: anchor.y + Math.sin(angle) * initialRadius,
  };
  if (isAvailable(initial, occupied, occupiedPoints, bounds)) return initial;
  return clearNpcPoint(anchor, index, occupied, occupiedPoints, NPC_SLOT_SPACING, bounds);
}

/**
 * Give each catalog character a stable destination offset while keeping it
 * inside scene bounds and clear of structures and other NPC destinations.
 */
export function neighborhoodNpcDestinationPoint(
  destination: Pick<NeighborhoodObject, "x" | "y">,
  catalogIndex: number,
  occupied: readonly GroundRect[] = [],
  occupiedPoints: readonly NpcPoint[] = [],
  bounds: GroundRect = NEIGHBORHOOD_SCENE_BOUNDS,
): NpcPoint | null {
  if (!Number.isInteger(catalogIndex) || catalogIndex < 0) return null;
  const angle = catalogIndex * GOLDEN_ANGLE;
  const radius = NEIGHBORHOOD_TILE_SIZE * 0.45 * Math.sqrt(catalogIndex + 1);
  const initial = {
    x: destination.x + Math.cos(angle) * radius,
    y: destination.y + Math.sin(angle) * radius,
  };
  if (isAvailable(initial, occupied, occupiedPoints, bounds)) return initial;
  return clearNpcPoint(destination, catalogIndex, occupied, occupiedPoints, NPC_SLOT_SPACING, bounds);
}

export const NEIGHBORHOOD_NPC_ACTOR_SEPARATION = 0.85;

const NPC_PATH_GRID = NEIGHBORHOOD_TILE_SIZE / 2;
const PATH_DIRECTIONS = [
  [1, 0], [0, 1], [-1, 0], [0, -1],
  [1, 1], [-1, 1], [-1, -1], [1, -1],
] as const;

function gridKey(x: number, y: number): string {
  return `${x}:${y}`;
}

function segmentsIntersect(
  a: NpcPoint,
  b: NpcPoint,
  c: NpcPoint,
  d: NpcPoint,
): boolean {
  const cross = (p: NpcPoint, q: NpcPoint, r: NpcPoint) =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const onSegment = (p: NpcPoint, q: NpcPoint, r: NpcPoint) =>
    q.x >= Math.min(p.x, r.x) &&
    q.x <= Math.max(p.x, r.x) &&
    q.y >= Math.min(p.y, r.y) &&
    q.y <= Math.max(p.y, r.y);
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  if (abC === 0 && onSegment(a, c, b)) return true;
  if (abD === 0 && onSegment(a, d, b)) return true;
  if (cdA === 0 && onSegment(c, a, d)) return true;
  if (cdB === 0 && onSegment(c, b, d)) return true;
  return (abC > 0) !== (abD > 0) && (cdA > 0) !== (cdB > 0);
}

function overlapsReservedPaths(
  from: NpcPoint,
  to: NpcPoint,
  reservedPaths: readonly (readonly NpcPoint[])[],
): boolean {
  return reservedPaths.some((path) =>
    path.some((point, index) => {
      if (index === 0) return false;
      const previous = path[index - 1]!;
      if (!segmentsIntersect(from, to, previous, point)) return false;
      return Math.min(
        Math.hypot(from.x - previous.x, from.y - previous.y),
        Math.hypot(from.x - point.x, from.y - point.y),
        Math.hypot(to.x - previous.x, to.y - previous.y),
        Math.hypot(to.x - point.x, to.y - point.y),
      ) > NPC_SEPARATION;
    }),
  );
}

function segmentIsClear(
  from: NpcPoint,
  to: NpcPoint,
  occupied: readonly GroundRect[],
  bounds: GroundRect,
  reservedPaths: readonly (readonly NpcPoint[])[] = [],
): boolean {
  if (overlapsReservedPaths(from, to, reservedPaths)) return false;
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const samples = Math.max(1, Math.ceil(distance / 8));
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / samples;
    const point = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };
    if (!isInsideScene(point, bounds) || overlapsFootprint(point, occupied)) return false;
  }
  return true;
}

/**
 * Find a deterministic grid route around static footprints. Diagonal moves are
 * rejected when either adjacent cardinal cell is blocked, preventing corner cuts.
 */
/**
 * Prefer a conflict-free reserved corridor, but do not strand an NPC solely
 * because another scheduled NPC reserved the same narrow passage. Runtime
 * actor avoidance still resolves live proximity when the fallback is used.
 */
export function neighborhoodNpcPathWithFallback(
  start: NpcPoint,
  destination: NpcPoint,
  occupied: readonly GroundRect[] = [],
  bounds: GroundRect = NEIGHBORHOOD_SCENE_BOUNDS,
  reservedPaths: readonly (readonly NpcPoint[])[] = [],
): NpcPoint[] | null {
  return (
    neighborhoodNpcPath(start, destination, occupied, bounds, reservedPaths) ??
    (reservedPaths.length > 0
      ? neighborhoodNpcPath(start, destination, occupied, bounds)
      : null)
  );
}

export function neighborhoodNpcPath(
  start: NpcPoint,
  destination: NpcPoint,
  occupied: readonly GroundRect[] = [],
  bounds: GroundRect = NEIGHBORHOOD_SCENE_BOUNDS,
  reservedPaths: readonly (readonly NpcPoint[])[] = [],
): NpcPoint[] | null {
  const toCell = (point: NpcPoint) => ({
    x: Math.round((point.x - bounds.left) / NPC_PATH_GRID),
    y: Math.round((point.y - bounds.top) / NPC_PATH_GRID),
  });
  const toPoint = (cell: { x: number; y: number }): NpcPoint => ({
    x: bounds.left + cell.x * NPC_PATH_GRID,
    y: bounds.top + cell.y * NPC_PATH_GRID,
  });
  const maxX = Math.floor(bounds.width / NPC_PATH_GRID);
  const maxY = Math.floor(bounds.height / NPC_PATH_GRID);
  const source = toCell(start);
  const goal = toCell(destination);
  const blocked = (x: number, y: number) => {
    if (x < 0 || y < 0 || x > maxX || y > maxY) return true;
    const point = toPoint({ x, y });
    return overlapsFootprint(point, occupied);
  };
  const sourcePoint = toPoint(source);
  const goalPoint = toPoint(goal);
  if (
    blocked(source.x, source.y) ||
    blocked(goal.x, goal.y) ||
    !segmentIsClear(start, sourcePoint, occupied, bounds, reservedPaths) ||
    !segmentIsClear(goalPoint, destination, occupied, bounds, reservedPaths)
  ) return null;

  const heuristic = (x: number, y: number) => Math.hypot(goal.x - x, goal.y - y);
  const open = [{ ...source, cost: 0, score: heuristic(source.x, source.y) }];
  const cameFrom = new Map<string, string>();
  const costs = new Map<string, number>([[gridKey(source.x, source.y), 0]]);
  const cells = new Map<string, { x: number; y: number }>([
    [gridKey(source.x, source.y), source],
  ]);
  const closed = new Set<string>();

  while (open.length) {
    open.sort((a, b) => a.score - b.score || a.y - b.y || a.x - b.x);
    const current = open.shift()!;
    const currentKey = gridKey(current.x, current.y);
    if (closed.has(currentKey)) continue;
    if (current.x === goal.x && current.y === goal.y) {
      const route: NpcPoint[] = [destination];
      let key = currentKey;
      while (cameFrom.has(key)) {
        const cell = cells.get(key)!;
        route.push(toPoint(cell));
        key = cameFrom.get(key)!;
      }
      route.push(start);
      route.reverse();
      return route.slice(1);
    }
    closed.add(currentKey);

    for (const [dx, dy] of PATH_DIRECTIONS) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = gridKey(x, y);
      if (closed.has(key) || blocked(x, y)) continue;
      if (dx !== 0 && dy !== 0 && (blocked(current.x + dx, current.y) || blocked(current.x, current.y + dy))) continue;
      if (!segmentIsClear(toPoint(current), toPoint({ x, y }), occupied, bounds, reservedPaths)) continue;
      const nextCost = current.cost + (dx !== 0 && dy !== 0 ? Math.SQRT2 : 1);
      if (nextCost >= (costs.get(key) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(key, nextCost);
      cameFrom.set(key, currentKey);
      cells.set(key, { x, y });
      open.push({ x, y, cost: nextCost, score: nextCost + heuristic(x, y) });
    }
  }
  return null;
}

/**
 * Resolve one frame of movement against live actor positions. The preferred
 * direction is retained when clear; otherwise the actor tries either side
 * and waits safely when both are occupied.
 */
export function neighborhoodNpcAvoidanceStep(
  current: NpcPoint,
  waypoint: NpcPoint,
  blockers: readonly NpcPoint[],
  maxStep: number,
  minimumSeparation = NEIGHBORHOOD_NPC_ACTOR_SEPARATION,
  occupied: readonly GroundRect[] = [],
  bounds?: GroundRect,
  avoidanceBias = 1,
): NpcPoint {
  const dx = waypoint.x - current.x;
  const dy = waypoint.y - current.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0 || maxStep <= 0) return current;
  const travel = Math.min(distance, maxStep);
  const direction = { x: dx / distance, y: dy / distance };
  // Search a full radial fan so dense crowds and corners can offer a
  // usable escape direction even when the direct and perpendicular steps fail.
  const candidateAngles = Array.from({ length: 16 }, (_, index) =>
    (index * Math.PI * 2) / 16,
  );
  const candidates = candidateAngles.map((angle) => ({
    x: current.x + (direction.x * Math.cos(angle) - direction.y * Math.sin(angle)) * travel,
    y: current.y + (direction.x * Math.sin(angle) + direction.y * Math.cos(angle)) * travel,
  }));
  const clear = candidates.filter((candidate) => {
    const segmentX = candidate.x - current.x;
    const segmentY = candidate.y - current.y;
    const distance = Math.hypot(segmentX, segmentY);
    const samples = Math.max(1, Math.ceil(distance / Math.max(minimumSeparation / 2, 0.1)));
    for (let index = 0; index <= samples; index += 1) {
      const progress = index / samples;
      const point = {
        x: current.x + segmentX * progress,
        y: current.y + segmentY * progress,
      };
      if (
        (bounds &&
          (point.x < bounds.left + minimumSeparation ||
            point.y < bounds.top + minimumSeparation ||
            point.x > bounds.left + bounds.width - minimumSeparation ||
            point.y > bounds.top + bounds.height - minimumSeparation)) ||
        occupied.some((rect) =>
          point.x >= rect.left - minimumSeparation &&
          point.x <= rect.left + rect.width + minimumSeparation &&
          point.y >= rect.top - minimumSeparation &&
          point.y <= rect.top + rect.height + minimumSeparation,
        )
      ) return false;
    }
    return blockers.every((blocker) => {
      const initialDistance = Math.hypot(current.x - blocker.x, current.y - blocker.y);
      const endpointDistance = Math.hypot(candidate.x - blocker.x, candidate.y - blocker.y);
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
      const projection =
        segmentLengthSquared === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                ((blocker.x - current.x) * segmentX +
                  (blocker.y - current.y) * segmentY) /
                  segmentLengthSquared,
              ),
            );
      const closestX = current.x + segmentX * projection;
      const closestY = current.y + segmentY * projection;
      const closestDistance = Math.hypot(closestX - blocker.x, closestY - blocker.y);
      // If actors are already overlapping, allow only a step that separates them further.
      return initialDistance < minimumSeparation
        ? endpointDistance > initialDistance + 0.0001
        : closestDistance >= minimumSeparation;
    });
  });
  if (clear.length === 0) return current;
  clear.sort((a, b) => {
    const distanceA = Math.hypot(a.x - waypoint.x, a.y - waypoint.y);
    const distanceB = Math.hypot(b.x - waypoint.x, b.y - waypoint.y);
    if (Math.abs(distanceA - distanceB) > 0.0001) return distanceA - distanceB;
    // Give equally useful sidesteps a stable character-specific side preference
    // so crowds do not all choose the same side of a blocked corridor.
    const sideA = (a.x - current.x) * direction.y - (a.y - current.y) * direction.x;
    const sideB = (b.x - current.x) * direction.y - (b.y - current.y) * direction.x;
    return (sideB - sideA) * avoidanceBias;
  });
  return clear[0]!;
}


/**
 * Find a short, geometry-safe escape point that maximises clearance from a
 * local crowd. Identity bias breaks ties consistently across frames.
 */
export function neighborhoodNpcCrowdRecoveryPoint(
  current: NpcPoint,
  blockers: readonly NpcPoint[],
  occupied: readonly GroundRect[] = [],
  bounds: GroundRect = NEIGHBORHOOD_SCENE_BOUNDS,
  minimumSeparation = NEIGHBORHOOD_NPC_ACTOR_SEPARATION,
  avoidanceBias = 1,
): NpcPoint | null {
  if (blockers.length === 0) return null;
  const radius = minimumSeparation * 1.8;
  const candidates = Array.from({ length: 24 }, (_, index) => {
    const angle = (index * Math.PI * 2) / 24;
    return {
      x: current.x + Math.cos(angle) * radius,
      y: current.y + Math.sin(angle) * radius,
    };
  }).filter((candidate) => {
    if (!isInsideScene(candidate, bounds) || overlapsFootprint(candidate, occupied)) return false;
    const distance = Math.hypot(candidate.x - current.x, candidate.y - current.y);
    const samples = Math.max(1, Math.ceil(distance / Math.max(minimumSeparation / 2, 0.1)));
    for (let index = 1; index <= samples; index += 1) {
      const progress = index / samples;
      const point = {
        x: current.x + (candidate.x - current.x) * progress,
        y: current.y + (candidate.y - current.y) * progress,
      };
      if (!isInsideScene(point, bounds) || overlapsFootprint(point, occupied)) return false;
    }
    return blockers.every((blocker) => {
      const initial = Math.hypot(current.x - blocker.x, current.y - blocker.y);
      const next = Math.hypot(candidate.x - blocker.x, candidate.y - blocker.y);
      return initial < minimumSeparation ? next > initial + 0.0001 : next >= minimumSeparation;
    });
  });
  candidates.sort((a, b) => {
    const clearanceA = Math.min(...blockers.map((point) => Math.hypot(a.x - point.x, a.y - point.y)));
    const clearanceB = Math.min(...blockers.map((point) => Math.hypot(b.x - point.x, b.y - point.y)));
    if (Math.abs(clearanceA - clearanceB) > 0.0001) return clearanceB - clearanceA;
    const angleA = Math.atan2(a.y - current.y, a.x - current.x);
    const angleB = Math.atan2(b.y - current.y, b.x - current.x);
    return (angleB - angleA) * avoidanceBias;
  });
  return candidates[0] ?? null;
}

/** Stable per-character retry delay prevents a crowd from replanning in lockstep. */
export function neighborhoodNpcReplanDelay(npcId: string): number {
  let hash = 2166136261;
  for (let index = 0; index < npcId.length; index += 1) {
    hash ^= npcId.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return 1.1 + ((hash >>> 0) % 8) * 0.1;
}

/**
 * Select one deterministic yielding actor when two live NPC routes approach
 * each other head-on. Stable identity ordering prevents both actors yielding.
 */
export function neighborhoodNpcYieldPoint(
  npcId: string,
  otherNpcId: string,
  current: NpcPoint,
  waypoint: NpcPoint,
  otherCurrent: NpcPoint,
  otherWaypoint: NpcPoint | undefined,
  minimumSeparation = NEIGHBORHOOD_NPC_ACTOR_SEPARATION,
): NpcPoint | null {
  if (npcId <= otherNpcId || !otherWaypoint) return null;
  const ownX = waypoint.x - current.x;
  const ownY = waypoint.y - current.y;
  const otherX = otherWaypoint.x - otherCurrent.x;
  const otherY = otherWaypoint.y - otherCurrent.y;
  const ownLength = Math.hypot(ownX, ownY);
  const otherLength = Math.hypot(otherX, otherY);
  const proximity = Math.hypot(current.x - otherCurrent.x, current.y - otherCurrent.y);
  if (
    ownLength <= 0.035 ||
    otherLength <= 0.035 ||
    proximity > minimumSeparation * 3.5 ||
    (ownX * otherX + ownY * otherY) / (ownLength * otherLength) > -0.35
  ) return null;

  const side = neighborhoodNpcAvoidanceBias(npcId);
  const perpendicular = { x: -ownY / ownLength, y: ownX / ownLength };
  const away = (current.x - otherCurrent.x) * perpendicular.x +
    (current.y - otherCurrent.y) * perpendicular.y;
  const direction = Math.abs(away) > 0.01 ? Math.sign(away) : side;
  return {
    x: current.x + perpendicular.x * direction * minimumSeparation * 1.35,
    y: current.y + perpendicular.y * direction * minimumSeparation * 1.35,
  };
}

export function neighborhoodNpcAvoidanceBias(npcId: string): number {
  let hash = 0;
  for (let index = 0; index < npcId.length; index += 1) {
    hash = (hash * 31 + npcId.charCodeAt(index)) | 0;
  }
  return (hash & 1) === 0 ? 1 : -1;
}

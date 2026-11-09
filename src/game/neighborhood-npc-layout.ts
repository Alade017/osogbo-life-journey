import {
  NEIGHBORHOOD_SCENE_BOUNDS,
  NEIGHBORHOOD_TILE_SIZE,
  type GroundRect,
} from "@/game/neighborhood-geometry";
import type { NeighborhoodObject } from "@/game/neighborhood-model";

const NPC_SLOT_SPACING = NEIGHBORHOOD_TILE_SIZE * 0.425;
const NPC_CLEARANCE = 22;
const NPC_SEPARATION = 42;
const SCENE_MARGIN = NPC_SEPARATION / 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type NpcPoint = { x: number; y: number };

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
  const abC = cross(a, b, c);
  const abD = cross(a, b, d);
  const cdA = cross(c, d, a);
  const cdB = cross(c, d, b);
  return abC * abD <= 0 && cdA * cdB <= 0;
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

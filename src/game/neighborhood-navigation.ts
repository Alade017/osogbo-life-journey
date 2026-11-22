import { createNeighborhoodOccupancyChecker } from "./authoritative-movement.ts";
import {
  neighborhoodSceneBounds,
  toWorld,
  validCheckpoint,
  type NeighborhoodArea,
  type WorldPoint,
} from "./neighborhood-model.ts";

/** Connected components of authored road surfaces, including bounded access lanes. */
export function neighborhoodRoadComponents(
  area: NeighborhoodArea,
  origin: WorldPoint = { x: 7, y: 6 },
): string[][] {
  const bounds = neighborhoodSceneBounds(origin);
  const roads = (area.roads ?? []).map((road) => {
    const vertical = road.axis === "vertical";
    const start = road.start ?? (vertical ? bounds.top : bounds.left);
    const end = road.end ?? (vertical ? bounds.top + bounds.height : bounds.left + bounds.width);
    return {
      id: road.id,
      left: vertical ? road.offset - road.width / 2 : start,
      right: vertical ? road.offset + road.width / 2 : end,
      top: vertical ? start : road.offset - road.width / 2,
      bottom: vertical ? end : road.offset + road.width / 2,
    };
  });
  const remaining = new Set(roads.map((_, index) => index));
  const components: string[][] = [];
  while (remaining.size) {
    const first = remaining.values().next().value!;
    const queue = [first];
    remaining.delete(first);
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const a = roads[queue[cursor]!]!;
      for (const index of remaining) {
        const b = roads[index]!;
        if (a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top) {
          remaining.delete(index);
          queue.push(index);
        }
      }
    }
    components.push(queue.map((index) => roads[index]!.id));
  }
  return components;
}

/** Offline authoring check; runtime movement remains authoritative in Colyseus. */
export function checkNeighborhoodEntrances(
  area: NeighborhoodArea,
  spawn: WorldPoint,
  origin: WorldPoint,
) {
  const { left, top, width, height } = neighborhoodSceneBounds(origin);
  const step = 8;
  const columns = Math.floor(width / step) + 1;
  const rows = Math.floor(height / step) + 1;
  const totalCells = columns * rows;
  const index = (x: number, y: number) => y * columns + x;
  const point = (x: number, y: number) => ({ x: left + x * step, y: top + y * step });
  const valid = (x: number, y: number) => x >= 0 && y >= 0 && x < columns && y < rows;

  // 0 = unknown, -1 = blocked, 1 = open, 2 = visited.
  // Combining occupancy memoization and BFS visitation avoids rechecking blocked cells.
  const cellStates = new Int8Array(totalCells);
  const canOccupy = createNeighborhoodOccupancyChecker(origin, area.objects, area.obstacles);
  const isOpen = (cell: number) => {
    const cached = cellStates[cell]!;
    if (cached !== 0) return cached > 0;

    const x = cell % columns;
    const y = Math.floor(cell / columns);
    const world = toWorld(point(x, y), origin);
    const open = validCheckpoint(world) && canOccupy(world);
    cellStates[cell] = open ? 1 : -1;
    return open;
  };

  const sx = Math.round((spawn.x - left) / step);
  const sy = Math.round((spawn.y - top) / step);
  if (!valid(sx, sy) || !isOpen(index(sx, sy))) {
    return { spawnClear: false, unreachable: area.objects.map((object) => object.id), visited: 0 };
  }

  // A flat integer queue avoids allocating a tuple for every reachable grid cell.
  const queue = new Int32Array(totalCells);
  let head = 0;
  let tail = 0;
  const start = index(sx, sy);
  cellStates[start] = 2;
  queue[tail++] = start;

  const visit = (x: number, y: number) => {
    if (!valid(x, y)) return;
    const cell = index(x, y);
    const state = cellStates[cell]!;
    if (state === 2 || state === -1 || (state === 0 && !isOpen(cell))) return;
    cellStates[cell] = 2;
    queue[tail++] = cell;
  };

  while (head < tail) {
    const cell = queue[head++]!;
    const x = cell % columns;
    const y = Math.floor(cell / columns);
    visit(x + 1, y);
    visit(x - 1, y);
    visit(x, y + 1);
    visit(x, y - 1);
  }

  // Each target only needs a small local grid search; do not scan every target per BFS cell.
  const pending = new Set(area.objects.map((object) => object.id));
  for (const object of area.objects) {
    const minX = Math.max(0, Math.ceil((object.x - 16 - left) / step));
    const maxX = Math.min(columns - 1, Math.floor((object.x + 16 - left) / step));
    const minY = Math.max(0, Math.ceil((object.y - 16 - top) / step));
    const maxY = Math.min(rows - 1, Math.floor((object.y + 16 - top) / step));
    let reachable = false;

    for (let y = minY; y <= maxY && !reachable; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (
          cellStates[index(x, y)] === 2 &&
          Math.hypot(left + x * step - object.x, top + y * step - object.y) <= 16
        ) {
          reachable = true;
          break;
        }
      }
    }
    if (reachable) pending.delete(object.id);
  }

  return { spawnClear: true, unreachable: [...pending], visited: tail };
}

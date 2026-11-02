import { canOccupyNeighborhoodPoint } from "./authoritative-movement.ts";
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
  const index = (x: number, y: number) => y * columns + x;
  const point = (x: number, y: number) => ({ x: left + x * step, y: top + y * step });
  const valid = (x: number, y: number) => x >= 0 && y >= 0 && x < columns && y < rows;
  const open = (x: number, y: number) => {
    if (!valid(x, y)) return false;
    const world = toWorld(point(x, y), origin);
    return (
      validCheckpoint(world) &&
      canOccupyNeighborhoodPoint(world, origin, area.objects, area.obstacles)
    );
  };
  const sx = Math.round((spawn.x - left) / step);
  const sy = Math.round((spawn.y - top) / step);
  if (!open(sx, sy))
    return { spawnClear: false, unreachable: area.objects.map((object) => object.id), visited: 0 };
  const seen = new Uint8Array(columns * rows);
  const queue: [number, number][] = [[sx, sy]];
  seen[index(sx, sy)] = 1;
  const pending = new Set(area.objects.map((object) => object.id));
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [x, y] = queue[cursor]!;
    const current = point(x, y);
    for (const object of area.objects) {
      if (Math.hypot(current.x - object.x, current.y - object.y) <= 16) pending.delete(object.id);
    }
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (!valid(nx, ny) || seen[index(nx, ny)] || !open(nx, ny)) continue;
      seen[index(nx, ny)] = 1;
      queue.push([nx, ny]);
    }
  }
  return { spawnClear: true, unreachable: [...pending], visited: queue.length };
}

export type RouteCell = readonly [number, number];
export type TownRoute = { cells: RouteCell[]; start: RouteCell; end: RouteCell };
/** Road-only shortest path. Endpoints snap to road access, never draw through plots. */
export function findTownRoute(
  rows: readonly string[],
  origin: RouteCell,
  destination: RouteCell,
): TownRoute | null {
  if (![...origin, ...destination].every(Number.isFinite)) return null;
  const roads: RouteCell[] = [];
  rows.forEach((row, z) =>
    Array.from(row).forEach((tile, x) => {
      if (tile === "r") roads.push([x, z]);
    }),
  );
  if (!roads.length) return null;
  const nearest = (p: RouteCell) =>
    roads.reduce((best, cell) =>
      Math.hypot(cell[0] - p[0], cell[1] - p[1]) < Math.hypot(best[0] - p[0], best[1] - p[1])
        ? cell
        : best,
    );
  const start = nearest(origin),
    end = nearest(destination),
    key = (p: RouteCell) => `${p[0]},${p[1]}`;
  const queue: RouteCell[] = [start],
    parents = new Map<string, RouteCell | null>([[key(start), null]]);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const cell = queue[cursor];
    if (key(cell) === key(end)) {
      const cells: RouteCell[] = [];
      for (
        let current: RouteCell | null = cell;
        current;
        current = parents.get(key(current)) ?? null
      )
        cells.push(current);
      return { cells: cells.reverse(), start, end };
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const next: RouteCell = [cell[0] + dx, cell[1] + dz];
      if (rows[next[1]]?.[next[0]] !== "r" || parents.has(key(next))) continue;
      parents.set(key(next), cell);
      queue.push(next);
    }
  }
  return null;
}
/** Sample by path distance, keeping the moving marker on road segments. */
export function sampleTownRoute(cells: readonly RouteCell[], progress: number): RouteCell | null {
  if (!cells.length) return null;
  const index = Math.max(0, Math.min(1, progress)) * (cells.length - 1),
    i = Math.floor(index),
    a = cells[i],
    b = cells[Math.min(i + 1, cells.length - 1)],
    t = index - i;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

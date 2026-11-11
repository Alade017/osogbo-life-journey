export type TownMobilityRoute = readonly [number, number][];

/** Returns unique grass cells directly beside a road, where sidewalks are rendered. */
export function deriveTownSidewalkCells(rows: readonly string[]): [number, number][] {
  const cells = new Map<string, [number, number]>();
  rows.forEach((row, z) => {
    Array.from(row).forEach((tile, x) => {
      if (tile !== "r") return;
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const sidewalkX = x + dx;
        const sidewalkZ = z + dz;
        if (rows[sidewalkZ]?.[sidewalkX] !== "g") continue;
        cells.set(`${sidewalkX},${sidewalkZ}`, [sidewalkX, sidewalkZ]);
      }
    });
  });
  return [...cells.values()];
}

/**
 * Builds closed mobility loops from the town's road-cell data.
 * A route is emitted only when all four sides of its rectangle are roads.
 */
export function deriveTownMobilityRoutes(
  rows: readonly string[],
  cellSize: number,
  laneOffset = 0,
): TownMobilityRoute[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(laneOffset)) return [];
  const rowCount = rows.length;
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const horizontalRoadRows = rows.flatMap((row, z) =>
    row.length > 0 && Array.from(row).every((tile) => tile === "r") ? [z] : [],
  );
  const verticalRoadColumns = Array.from({ length: columnCount }, (_, x) => x).filter(
    (x) => rows.length > 1 && rows.every((row) => row[x] === "r"),
  );

  const routes: TownMobilityRoute[] = [];
  for (let rowIndex = 0; rowIndex < horizontalRoadRows.length; rowIndex += 1) {
    for (let nextRowIndex = rowIndex + 1; nextRowIndex < Math.min(horizontalRoadRows.length, rowIndex + 2); nextRowIndex += 1) {
      const top = horizontalRoadRows[rowIndex]!;
      const bottom = horizontalRoadRows[nextRowIndex]!;
      for (let columnIndex = 0; columnIndex < verticalRoadColumns.length - 1; columnIndex += 1) {
        for (let nextColumnIndex = columnIndex + 1; nextColumnIndex < Math.min(verticalRoadColumns.length, columnIndex + 2); nextColumnIndex += 1) {
          const left = verticalRoadColumns[columnIndex]!;
          const right = verticalRoadColumns[nextColumnIndex]!;
          const verticalSidesAreRoads = rows.slice(top, bottom + 1).every(
            (row) => row[left] === "r" && row[right] === "r",
          );
          if (!verticalSidesAreRoads) continue;

          const toWorld = (x: number, z: number): [number, number] => [
            (x - (columnCount - 1) / 2) * cellSize,
            (z - (rowCount - 1) / 2) * cellSize,
          ];
          routes.push([
            toWorld(left + laneOffset / cellSize, top + laneOffset / cellSize),
            toWorld(right - laneOffset / cellSize, top + laneOffset / cellSize),
            toWorld(right - laneOffset / cellSize, bottom - laneOffset / cellSize),
            toWorld(left + laneOffset / cellSize, bottom - laneOffset / cellSize),
          ]);
        }
      }
    }
  }
  return routes;
}

/**
 * Derives open pedestrian routes from walkable sidewalk cells beside roads.
 * Building footprints, plots and water are excluded so walkers stay on paths
 * that the town layout actually provides.
 */
export function deriveTownPedestrianRoutes(
  rows: readonly string[],
  cellSize: number,
  blockedCells: readonly (readonly [number, number])[],
  sidewalkWidth = cellSize * 0.28,
): TownMobilityRoute[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(sidewalkWidth) || sidewalkWidth < 0) return [];
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const blocked = new Set(blockedCells.map(([x, z]) => `${x},${z}`));
  const lines = new Map<string, { coordinates: Set<number>; orientation: "h" | "v"; fixed: number; side: number }>();
  const sidewalkOffset = cellSize / 2 + sidewalkWidth / 2;

  rows.forEach((row, z) => {
    Array.from(row).forEach((tile, x) => {
      if (tile !== "r") return;
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
        const sidewalkX = x + dx;
        const sidewalkZ = z + dz;
        if (rows[sidewalkZ]?.[sidewalkX] !== "g") continue;
        if (blocked.has(`${sidewalkX},${sidewalkZ}`)) continue;

        // Keep each side of a road as its own line. Waypoints sit at the
        // centre of the rendered sidewalk strip, not at the grass-cell centre.
        const orientation = dx === 0 ? "h" : "v";
        const side = dx === 0 ? dz : dx;
        const fixed = orientation === "h" ? sidewalkZ : sidewalkX;
        const coordinate = orientation === "h" ? x : z;
        const key = `${orientation}:${fixed}:${side}`;
        const line = lines.get(key) ?? { coordinates: new Set<number>(), orientation, fixed, side };
        line.coordinates.add(coordinate);
        lines.set(key, line);
      }
    });
  });

  const routes: TownMobilityRoute[] = [];
  for (const { coordinates: values, orientation, fixed, side } of lines.values()) {
    const coordinates = [...values].sort((a, b) => a - b);
    let run: number[] = [];

    const appendRun = () => {
      if (run.length >= 3) {
        const points: [number, number][] = run.map((coordinate) => {
          const roadX = orientation === "h" ? coordinate : fixed - side;
          const roadZ = orientation === "h" ? fixed - side : coordinate;
          const x = (roadX - (columnCount - 1) / 2) * cellSize;
          const z = (roadZ - (rows.length - 1) / 2) * cellSize;
          return orientation === "h"
            ? [x, z + side * sidewalkOffset]
            : [x + side * sidewalkOffset, z];
        });
        routes.push(points);
      }
      run = [];
    };

    for (const coordinate of coordinates) {
      if (run.length > 0 && coordinate !== run[run.length - 1]! + 1) appendRun();
      run.push(coordinate);
    }
    appendRun();
  }

  return routes;
}


/**
 * Builds L-shaped pedestrian paths through rendered outer sidewalk-corner tiles.
 * A connector exists only when both adjoining sidewalk strips and their diagonal
 * grass corner are present and unblocked, matching R3FTownSurface geometry.
 */
export function deriveTownPedestrianCornerRoutes(
  rows: readonly string[],
  cellSize: number,
  blockedCells: readonly (readonly [number, number])[] = [],
  sidewalkWidth = cellSize * 0.28,
): TownMobilityRoute[] {
  if (!Number.isFinite(cellSize) || cellSize <= 0 || !Number.isFinite(sidewalkWidth) || sidewalkWidth < 0) return [];
  const columnCount = Math.max(0, ...rows.map((row) => row.length));
  const blocked = new Set(blockedCells.map(([x, z]) => `${x},${z}`));
  const offset = cellSize / 2 + sidewalkWidth / 2;
  const routes: TownMobilityRoute[] = [];

  rows.forEach((row, z) => {
    Array.from(row).forEach((tile, x) => {
      if (tile !== "r") return;
      const centerX = (x - (columnCount - 1) / 2) * cellSize;
      const centerZ = (z - (rows.length - 1) / 2) * cellSize;

      for (const dx of [-1, 1] as const) {
        for (const dz of [-1, 1] as const) {
          const horizontalCell = [x, z + dz] as const;
          const verticalCell = [x + dx, z] as const;
          const diagonalCell = [x + dx, z + dz] as const;
          if (rows[horizontalCell[1]]?.[horizontalCell[0]] !== "r") continue;
          if (rows[verticalCell[1]]?.[verticalCell[0]] !== "r") continue;
          if (rows[diagonalCell[1]]?.[diagonalCell[0]] !== "g") continue;
          if ([horizontalCell, verticalCell, diagonalCell].some(([cellX, cellZ]) => blocked.has(`${cellX},${cellZ}`))) continue;

          routes.push([
            [centerX + dx * cellSize, centerZ + dz * offset],
            [centerX + dx * offset, centerZ + dz * offset],
            [centerX + dx * offset, centerZ + dz * cellSize],
          ]);
        }
      }
    });
  });

  return routes;
}


/**
 * Joins straight sidewalk runs and corner connectors at shared endpoints.
 * Every input segment is retained exactly once; branches become separate
 * pedestrian trails rather than forcing walkers through a road or prop.
 */
export function stitchTownPedestrianRoutes(
  routes: readonly TownMobilityRoute[],
): TownMobilityRoute[] {
  type Point = readonly [number, number];
  type Edge = { id: number; a: Point; b: Point };
  const keyOf = ([x, z]: Point) => `${x.toFixed(5)},${z.toFixed(5)}`;
  const points = new Map<string, Point>();
  const adjacency = new Map<string, Edge[]>();
  const edges: Edge[] = [];
  const edgeKeys = new Set<string>();

  routes.forEach((route) => {
    for (let index = 1; index < route.length; index += 1) {
      const a = route[index - 1]!;
      const b = route[index]!;
      // Invalid authored or generated coordinates must never enter the graph:
      // a single NaN/Infinity waypoint would otherwise poison the NPC transform.
      if (![a[0], a[1], b[0], b[1]].every(Number.isFinite)) continue;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.001) continue;
      const aKey = keyOf(a);
      const bKey = keyOf(b);
      const edgeKey = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      if (edgeKeys.has(edgeKey)) continue;
      edgeKeys.add(edgeKey);
      const edge = { id: edges.length, a, b };
      edges.push(edge);
      points.set(aKey, a);
      points.set(bKey, b);
      adjacency.set(aKey, [...(adjacency.get(aKey) ?? []), edge]);
      adjacency.set(bKey, [...(adjacency.get(bKey) ?? []), edge]);
    }
  });

  const used = new Set<number>();
  const trails: TownMobilityRoute[] = [];
  const walk = (startKey: string, firstEdge: Edge) => {
    const path: Point[] = [points.get(startKey)!];
    let currentKey = startKey;
    let edge: Edge | undefined = firstEdge;
    while (edge && !used.has(edge.id)) {
      used.add(edge.id);
      const currentPoint = points.get(currentKey)!;
      const nextPoint = keyOf(edge.a) === currentKey ? edge.b : edge.a;
      const nextKey = keyOf(nextPoint);
      path.push(nextPoint);
      currentKey = nextKey;
      if ((adjacency.get(currentKey)?.length ?? 0) !== 2) break;
      edge = adjacency.get(currentKey)?.find((candidate) => !used.has(candidate.id));
    }
    if (path.length >= 2) trails.push(path);
  };

  // Start at endpoints and junctions first, so branch points split into safe trails.
  for (const [key, connected] of adjacency) {
    if (connected.length === 2) continue;
    for (const edge of connected) if (!used.has(edge.id)) walk(key, edge);
  }
  // Consume closed loops and any remaining degree-two components.
  for (const edge of edges) {
    if (used.has(edge.id)) continue;
    walk(keyOf(edge.a), edge);
  }
  return trails;
}

/**
 * Coordinates pedestrian access to shared trail endpoints. Requests are queued
 * in arrival order so only one pedestrian occupies a junction clearance zone.
 */
export class TownPedestrianJunctionScheduler {
  private readonly owners = new Map<string, string>();
  private readonly waiters = new Map<string, string[]>();

  request(junctionId: string, pedestrianId: string): boolean {
    const owner = this.owners.get(junctionId);
    if (owner === pedestrianId) return true;
    const queue = this.waiters.get(junctionId) ?? [];
    if (!queue.includes(pedestrianId)) queue.push(pedestrianId);
    this.waiters.set(junctionId, queue);
    if (owner || queue[0] !== pedestrianId) return false;
    this.owners.set(junctionId, pedestrianId);
    queue.shift();
    if (queue.length === 0) this.waiters.delete(junctionId);
    return true;
  }

  release(junctionId: string, pedestrianId: string): void {
    if (this.owners.get(junctionId) === pedestrianId) this.owners.delete(junctionId);
    const queue = this.waiters.get(junctionId);
    if (!queue) return;
    const remaining = queue.filter((id) => id !== pedestrianId);
    if (remaining.length > 0) this.waiters.set(junctionId, remaining);
    else this.waiters.delete(junctionId);
  }
}


/** Measures traversable edges in a closed route, ignoring malformed and degenerate segments. */
export function measureTownMobilityLoop(route: TownMobilityRoute): number {
  if (route.length < 2) return 0;
  return route.reduce((total, point, index) => {
    const next = route[(index + 1) % route.length]!;
    if (![point[0], point[1], next[0], next[1]].every(Number.isFinite)) return total;
    const length = Math.hypot(next[0] - point[0], next[1] - point[1]);
    return Number.isFinite(length) && length >= 0.001 ? total + length : total;
  }, 0);
}


/** Validates an open pedestrian trail before assigning it to an animated character. */
export function isValidTownPedestrianRoute(route: TownMobilityRoute): boolean {
  if (route.length < 2) return false;
  if (!route.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z))) return false;

  let totalLength = 0;
  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1]!;
    const current = route[index]!;
    const segmentLength = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    if (!Number.isFinite(segmentLength) || segmentLength < 0.001) return false;
    totalLength += segmentLength;
  }

  return Number.isFinite(totalLength) && totalLength >= 0.001;
}


/** Scales junction clearance for short trails so both endpoints remain reachable. */
export function townPedestrianClearanceRadius(routeLength: number, preferredRadius = 0.38): number {
  if (!Number.isFinite(routeLength) || routeLength <= 0
    || !Number.isFinite(preferredRadius) || preferredRadius <= 0) return 0;
  return Math.min(preferredRadius, routeLength / 3);
}


/** Rejects traffic loops containing malformed points or no traversable perimeter. */
export function isValidTownMobilityLoop(route: TownMobilityRoute): boolean {
  if (route.length < 3 || !route.every(([x, z]) => Number.isFinite(x) && Number.isFinite(z))) {
    return false;
  }

  const uniquePoints = new Set(route.map(([x, z]) => `${x.toFixed(5)},${z.toFixed(5)}`));
  if (uniquePoints.size < 3) return false;

  let twiceArea = 0;
  for (let index = 0; index < route.length; index += 1) {
    const current = route[index]!;
    const next = route[(index + 1) % route.length]!;
    const edgeLength = Math.hypot(next[0] - current[0], next[1] - current[1]);
    if (!Number.isFinite(edgeLength) || edgeLength < 0.001) return false;
    twiceArea += current[0] * next[1] - next[0] * current[1];
  }

  return Number.isFinite(twiceArea) && Math.abs(twiceArea) >= 0.002;
}

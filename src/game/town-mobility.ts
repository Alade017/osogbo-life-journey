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

export type TownMobilityRoute = readonly [number, number][];

/**
 * Builds closed mobility loops from the town's road-cell data.
 * A route is emitted only when all four sides of its rectangle are roads.
 */
export function deriveTownMobilityRoutes(
  rows: readonly string[],
  cellSize: number,
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
    for (let nextRowIndex = rowIndex + 1; nextRowIndex < horizontalRoadRows.length; nextRowIndex += 1) {
      const top = horizontalRoadRows[rowIndex]!;
      const bottom = horizontalRoadRows[nextRowIndex]!;
      for (let columnIndex = 0; columnIndex < verticalRoadColumns.length; columnIndex += 1) {
        for (let nextColumnIndex = columnIndex + 1; nextColumnIndex < verticalRoadColumns.length; nextColumnIndex += 1) {
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
            toWorld(left + 0.5, top + 0.5),
            toWorld(right + 0.5, top + 0.5),
            toWorld(right + 0.5, bottom + 0.5),
            toWorld(left + 0.5, bottom + 0.5),
          ]);
        }
      }
    }
  }
  return routes;
}

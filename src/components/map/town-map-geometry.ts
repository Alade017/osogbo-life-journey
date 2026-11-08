export const TOWN_MAP_WIDTH = 1200;
export const TOWN_MAP_HEIGHT = 800;
export const TOWN_GRID_COLUMNS = 24;
export const TOWN_GRID_ROWS = 18;

const HALF_TILE_WIDTH = 22;
const HALF_TILE_HEIGHT = 12;

/** Project a grid coordinate into the shared map viewBox. */
export function projectTownCell(col: number, row: number) {
  return {
    x: TOWN_MAP_WIDTH / 2 + (col - row) * HALF_TILE_WIDTH,
    y: 82 + (col + row) * HALF_TILE_HEIGHT,
  };
}

export function townDiamondPoints(
  col: number,
  row: number,
  width = 1,
  depth = 1,
): [number, number][] {
  return [
    projectTownCell(col + width / 2, row),
    projectTownCell(col + width, row + depth / 2),
    projectTownCell(col + width / 2, row + depth),
    projectTownCell(col, row + depth / 2),
  ].map(({ x, y }) => [x, y]);
}

export function pointsAttribute(points: readonly (readonly [number, number])[]) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

/** Invert world 3D scene position into grid cell coordinates (no magic numbers). */
export function scenePositionToGridCell(
  pos: [number, number, number] | readonly [number, number, number],
  columns = TOWN_GRID_COLUMNS,
  rows = TOWN_GRID_ROWS,
  cellSize = 2,
): { col: number; row: number } {
  return {
    col: pos[0] / cellSize + (columns - 1) / 2,
    row: pos[2] / cellSize + (rows - 1) / 2,
  };
}

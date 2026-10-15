export type TownCellKind = "road" | "grass" | "water" | "plot" | "building";

export type TownGridCell = {
  x: number;
  z: number;
  kind: TownCellKind;
  height?: number;
  seed?: number;
  buildingType?: string;
  placeId?: string;
};

export type TownGrid = {
  columns: number;
  rows: number;
  cellSize: number;
  cells: TownGridCell[];
};

export type TownGridLayout = {
  rows: string[];
  cellSize?: number;
  waterCells?: [number, number][];
  plotCells?: [number, number][];
  buildings?: Array<{ placeId: string; x: number; z: number; buildingType: string }>;
  treeCells?: [number, number][];
  carCells?: [number, number][];
};

/** Expands compact JSON rows into explicit cells, applying authored overlays. */
export function expandTownGridLayout(
  layout: TownGridLayout,
  legend: Record<string, TownCellKind>,
): TownGrid {
  if (!layout.rows.length || layout.rows.some((row) => row.length !== layout.rows[0]!.length)) {
    throw new Error("Town grid rows must be non-empty and have equal width");
  }
  const columns = layout.rows[0]!.length;
  const rows = layout.rows.length;
  const byPosition = new Map<string, TownGridCell>();
  const add = (cell: TownGridCell) => byPosition.set(`${cell.x}:${cell.z}`, cell);
  layout.rows.forEach((row, z) => {
    [...row].forEach((key, x) => {
      const kind = legend[key];
      if (!kind) throw new Error(`Unknown town grid cell key: ${key}`);
      add({ x, z, kind, seed: z * columns + x });
    });
  });
  for (const [x, z] of layout.waterCells ?? []) add({ x, z, kind: "water" });
  for (const [x, z] of layout.plotCells ?? []) add({ x, z, kind: "plot" });
  for (const building of layout.buildings ?? []) {
    add({
      x: building.x,
      z: building.z,
      kind: "building",
      buildingType: building.buildingType,
      placeId: building.placeId,
    });
  }
  return { columns, rows, cellSize: layout.cellSize ?? 2, cells: [...byPosition.values()] };
}

export type TownSceneCell = {
  x: number;
  y: number;
  z: number;
  kind: TownCellKind;
  seed?: number;
  buildingType?: string;
  placeId?: string;
};

export type TownBounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type TownTarget = { x: number; z: number };
export type TownViewportHalfSize = { x: number; z: number };
export type TownPointerSample = { x: number; y: number; time: number };

export const TOWN_TAP_MAX_MOVEMENT = 6;
export const TOWN_TAP_MAX_DURATION_MS = 300;

/** Maps each authored JSON cell into the centered Y-up Three.js town grid. */
export function mapTownGridToScene(grid: TownGrid): TownSceneCell[] {
  if (
    !Number.isInteger(grid.columns) ||
    !Number.isInteger(grid.rows) ||
    grid.columns < 1 ||
    grid.rows < 1 ||
    !Number.isFinite(grid.cellSize) ||
    grid.cellSize <= 0
  ) {
    throw new Error("Invalid town grid dimensions");
  }

  const occupied = new Set<string>();
  return grid.cells.map((cell) => {
    if (
      !Number.isInteger(cell.x) ||
      !Number.isInteger(cell.z) ||
      cell.x < 0 ||
      cell.x >= grid.columns ||
      cell.z < 0 ||
      cell.z >= grid.rows
    ) {
      throw new Error(`Town cell is outside the grid: ${cell.x},${cell.z}`);
    }
    const key = `${cell.x}:${cell.z}`;
    if (occupied.has(key)) throw new Error(`Duplicate town cell: ${key}`);
    occupied.add(key);
    if (cell.kind === "building" && !cell.buildingType) {
      throw new Error(`Building cell is missing its type: ${key}`);
    }

    const sceneCell: TownSceneCell = {
      x: (cell.x - (grid.columns - 1) / 2) * grid.cellSize,
      y: cell.height ?? 0,
      z: (cell.z - (grid.rows - 1) / 2) * grid.cellSize,
      kind: cell.kind,
    };
    if (cell.seed !== undefined) sceneCell.seed = cell.seed;
    if (cell.buildingType !== undefined) sceneCell.buildingType = cell.buildingType;
    if (cell.placeId !== undefined) sceneCell.placeId = cell.placeId;
    return sceneCell;
  });
}

/** Clamps the camera target while accounting for the visible half-viewport. */
export function clampTownTarget(
  target: TownTarget,
  bounds: TownBounds,
  viewportHalfSize: TownViewportHalfSize = { x: 0, z: 0 },
): TownTarget {
  const minX = bounds.minX + viewportHalfSize.x;
  const maxX = bounds.maxX - viewportHalfSize.x;
  const minZ = bounds.minZ + viewportHalfSize.z;
  const maxZ = bounds.maxZ - viewportHalfSize.z;
  return {
    x: minX > maxX ? (bounds.minX + bounds.maxX) / 2 : clamp(target.x, minX, maxX),
    z: minZ > maxZ ? (bounds.minZ + bounds.maxZ) / 2 : clamp(target.z, minZ, maxZ),
  };
}

/** A press is a tap only when it stays below the movement and duration limits. */
export function isTownTap(start: TownPointerSample, end: TownPointerSample) {
  const movement = Math.hypot(end.x - start.x, end.y - start.y);
  const duration = end.time - start.time;
  return movement < TOWN_TAP_MAX_MOVEMENT && duration >= 0 && duration <= TOWN_TAP_MAX_DURATION_MS;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

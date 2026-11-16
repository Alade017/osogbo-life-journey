/**
 * Adds a district to the town map and grows the map when there is no free room.
 * Pure data functions: they take the town file and return a new one. Nothing here touches the
 * database or the 3D scene. The 3D map reads its size from the town data, so growth shows up
 * automatically once the file is updated.
 */

export interface TownGridData {
  meta: { grid: { columns: number; rows: number; cellSize: number } };
  grid: {
    rows: string[];
    cellSize: number;
    plotCells: number[][];
    treeCells: number[][];
    carCells: number[][];
    waterCells: number[][];
    buildings: { placeId: string; x: number; z: number; buildingType?: string }[];
  };
  districts: {
    id: string;
    name: string;
    theme: string;
    traffic: string;
    description: string;
    shape: number[][];
    gridArea: { x: number; z: number; width: number; depth: number };
  }[];
  landmarks: { id: string; grid: { x: number; z: number } }[];
}

export interface NewDistrictSpec {
  id: string;
  name: string;
  theme: string;
  traffic: string;
  description: string;
  width: number;
  depth: number;
}

/** Empty cells around a district, so neighbouring districts and houses don't touch. */
const MARGIN = 1;
const CELL_PX = 80; // matches the scale of the authored district outlines

function blockedCells(town: TownGridData) {
  const blocked = new Set<string>();
  const add = (x: number, z: number) => blocked.add(`${x},${z}`);
  for (const [x, z] of [
    ...town.grid.plotCells,
    ...town.grid.treeCells,
    ...town.grid.carCells,
    ...town.grid.waterCells,
  ])
    add(x!, z!);
  for (const building of town.grid.buildings) {
    for (let dz = 0; dz < 2; dz++)
      for (let dx = 0; dx < 2; dx++) add(building.x + dx, building.z + dz);
  }
  for (const landmark of town.landmarks) add(landmark.grid.x, landmark.grid.z);
  for (const district of town.districts) {
    const a = district.gridArea;
    for (let z = a.z; z < a.z + a.depth; z++) for (let x = a.x; x < a.x + a.width; x++) add(x, z);
  }
  return blocked;
}

/** True when every cell of the rectangle is plain grass and not reserved. */
function rectangleIsFree(
  town: TownGridData,
  blocked: Set<string>,
  x0: number,
  z0: number,
  width: number,
  depth: number,
) {
  for (let z = z0; z < z0 + depth; z++) {
    for (let x = x0; x < x0 + width; x++) {
      if (z < 0 || x < 0 || z >= town.grid.rows.length || x >= town.grid.rows[0]!.length)
        return false;
      if (town.grid.rows[z]![x] !== "g" || blocked.has(`${x},${z}`)) return false;
    }
  }
  return true;
}

function rectangleShape(x: number, z: number, width: number, depth: number) {
  return [
    [x * CELL_PX, z * CELL_PX],
    [(x + width) * CELL_PX, z * CELL_PX],
    [(x + width) * CELL_PX, (z + depth) * CELL_PX],
    [x * CELL_PX, (z + depth) * CELL_PX],
  ];
}

/**
 * Returns a new town with the district added. It finds free grass first. If there is none, it
 * extends the map to the east by one strip and places the district there.
 */
export function addDistrictToTown(town: TownGridData, spec: NewDistrictSpec): TownGridData {
  if (town.districts.some((district) => district.id === spec.id)) {
    throw new Error(`District "${spec.id}" already exists.`);
  }
  if (
    !Number.isInteger(spec.width) ||
    !Number.isInteger(spec.depth) ||
    spec.width < 1 ||
    spec.depth < 1
  ) {
    throw new Error("District width and depth must be whole numbers of at least 1.");
  }

  const next: TownGridData = structuredClone(town);
  const blocked = blockedCells(next);
  const needW = spec.width + MARGIN * 2;
  const needD = spec.depth + MARGIN * 2;

  let origin: { x: number; z: number } | null = null;
  search: for (let z = 0; z + needD <= next.grid.rows.length; z++) {
    for (let x = 0; x + needW <= next.grid.rows[0]!.length; x++) {
      if (rectangleIsFree(next, blocked, x, z, needW, needD)) {
        origin = { x, z };
        break search;
      }
    }
  }

  if (!origin) {
    // No room anywhere: add a strip to the east and place the district at its top-left.
    const oldWidth = next.grid.rows[0]!.length;
    const height = next.grid.rows.length;
    const strip = Math.max(needW, 1);
    next.grid.rows = next.grid.rows.map((row) => row + "g".repeat(strip));
    next.meta.grid.columns = oldWidth + strip;
    origin = { x: oldWidth + MARGIN, z: MARGIN };
    if (origin.z + spec.depth > height) {
      throw new Error("The strip is too short for this district; increase the map height first.");
    }
  }

  const area = { x: origin.x + MARGIN, z: origin.z + MARGIN, width: spec.width, depth: spec.depth };
  next.districts.push({
    id: spec.id,
    name: spec.name,
    theme: spec.theme,
    traffic: spec.traffic,
    description: spec.description,
    shape: rectangleShape(area.x, area.z, area.width, area.depth),
    gridArea: area,
  });
  return next;
}

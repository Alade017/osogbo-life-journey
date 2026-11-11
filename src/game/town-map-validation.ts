export type TownMapValidationInput = {
  meta: {
    grid: { columns: number; rows: number; cellSize: number };
    legend: Record<string, string>;
  };
  districts: readonly {
    id: string;
    gridArea: { x: number; z: number; width: number; depth: number };
    shape?: readonly (readonly number[])[];
  }[];
  grid: {
    cellSize: number;
    rows: readonly string[];
    waterCells: readonly (readonly number[])[];
    plotCells: readonly (readonly number[])[];
    buildings: readonly { placeId: string; x: number; z: number }[];
  };
  landmarks: readonly {
    id: string;
    grid: { x: number; z: number };
    x?: number;
    y?: number;
    districtId?: string;
    buildingType?: string;
    mapObjectType?: string;
  }[];
};

/** Validates authored town data before the renderer derives geometry and movement routes. */
export function validateTownMapData(data: TownMapValidationInput): string[] {
  const errors: string[] = [];
  const { columns, rows: expectedRows, cellSize: metaCellSize } = data.meta.grid;
  const { rows, cellSize } = data.grid;
  const tileSymbols = new Set(Object.keys(data.meta.legend));
  const roadSymbol = Object.entries(data.meta.legend).find(([, label]) => label === "road")?.[0];
  const grassSymbol = Object.entries(data.meta.legend).find(([, label]) => label === "grass")?.[0];

  if (!Number.isInteger(columns) || columns < 1) errors.push("Grid column count must be a positive integer.");
  if (!Number.isInteger(expectedRows) || expectedRows < 1) errors.push("Grid row count must be a positive integer.");
  if (!Number.isFinite(metaCellSize) || metaCellSize <= 0 || cellSize !== metaCellSize) {
    errors.push("Grid cell size must be finite, positive and consistent with metadata.");
  }
  if (rows.length !== expectedRows) errors.push("Authored row count does not match grid metadata.");

  rows.forEach((row, z) => {
    if (row.length !== columns) errors.push(`Grid row ${z} has ${row.length} columns; expected ${columns}.`);
    for (const symbol of row) {
      if (!tileSymbols.has(symbol)) errors.push(`Grid row ${z} contains unknown tile symbol "${symbol}".`);
    }
  });

  const inBounds = (x: number, z: number) =>
    Number.isInteger(x) && Number.isInteger(z) && x >= 0 && z >= 0 && x < columns && z < expectedRows;

  const districtIds = new Set<string>();
  for (const district of data.districts) {
    if (!district.id || districtIds.has(district.id)) errors.push(`District ID is missing or duplicated: "${district.id}".`);
    districtIds.add(district.id);
    const { x, z, width, depth } = district.gridArea;
    if (![x, z, width, depth].every(Number.isFinite) || !Number.isInteger(x) || !Number.isInteger(z) ||
      !Number.isInteger(width) || !Number.isInteger(depth) || width < 1 || depth < 1 ||
      x < 0 || z < 0 || x + width > columns || z + depth > expectedRows) {
      errors.push(`District "${district.id}" has an invalid or out-of-bounds grid area.`);
    }
    if (district.shape && (district.shape.length < 3 || district.shape.some(
      (point) => point.length !== 2 || !point.every(Number.isFinite),
    ))) {
      errors.push(`District "${district.id}" has an invalid outline shape.`);
    }
  }

  for (let index = 0; index < data.districts.length; index++) {
    const first = data.districts[index]!;
    for (const second of data.districts.slice(index + 1)) {
      const a = first.gridArea;
      const b = second.gridArea;
      const overlapX = Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width);
      const overlapZ = Math.max(a.z, b.z) < Math.min(a.z + a.depth, b.z + b.depth);
      if (overlapX && overlapZ) {
        errors.push(`District areas "${first.id}" and "${second.id}" overlap.`);
      }
    }
  }

  const landmarkIds = new Set<string>();
  for (const landmark of data.landmarks) {
    if (!landmark.id || landmarkIds.has(landmark.id)) errors.push(`Landmark ID is missing or duplicated: "${landmark.id}".`);
    landmarkIds.add(landmark.id);
    if (!inBounds(landmark.grid.x, landmark.grid.z)) errors.push(`Landmark "${landmark.id}" is outside the map grid.`);
    if ((landmark.x !== undefined && !Number.isFinite(landmark.x)) ||
      (landmark.y !== undefined && !Number.isFinite(landmark.y))) {
      errors.push(`Landmark "${landmark.id}" has invalid label coordinates.`);
    }
    if (landmark.districtId && !districtIds.has(landmark.districtId)) {
      errors.push(`Landmark "${landmark.id}" references unknown district "${landmark.districtId}".`);
    } else if (landmark.districtId) {
      const district = data.districts.find((item) => item.id === landmark.districtId)!;
      const area = district.gridArea;
      if (landmark.grid.x < area.x || landmark.grid.z < area.z ||
        landmark.grid.x >= area.x + area.width || landmark.grid.z >= area.z + area.depth) {
        errors.push(`Landmark "${landmark.id}" is outside its assigned district "${landmark.districtId}".`);
      }
    }
  }

  const buildingIds = new Set<string>();
  for (const building of data.grid.buildings) {
    if (!building.placeId || buildingIds.has(building.placeId)) {
      errors.push(`Building place ID is missing or duplicated: "${building.placeId}".`);
    }
    buildingIds.add(building.placeId);
    const landmark = data.landmarks.find((item) => item.id === building.placeId);
    if (!landmark) {
      errors.push(`Building "${building.placeId}" has no matching landmark.`);
    } else if (landmark.grid.x !== building.x || landmark.grid.z !== building.z) {
      errors.push(`Building "${building.placeId}" does not share its landmark's authored grid anchor.`);
    }
    if (!inBounds(building.x, building.z) || !inBounds(building.x + 1, building.z + 1)) {
      errors.push(`Building "${building.placeId}" footprint is outside the map grid.`);
      continue;
    }
    for (let z = building.z; z <= building.z + 1; z++) {
      for (let x = building.x; x <= building.x + 1; x++) {
        if (roadSymbol && rows[z]?.[x] === roadSymbol) {
          errors.push(`Building "${building.placeId}" overlaps a road at ${x},${z}.`);
        }
      }
    }
  }

  for (const landmark of data.landmarks) {
    if (landmark.buildingType && !buildingIds.has(landmark.id)) {
      errors.push(`Building landmark "${landmark.id}" has no authored building entry.`);
    }
    if (!landmark.buildingType && buildingIds.has(landmark.id)) {
      errors.push(`Map-only landmark "${landmark.id}" must not create a building footprint.`);
    }
    if (!landmark.buildingType && !landmark.mapObjectType) {
      errors.push(`Map-only landmark "${landmark.id}" must declare its map object type.`);
    }
    if (landmark.mapObjectType && !["landmark", "junction", "poi"].includes(landmark.mapObjectType)) {
      errors.push(`Landmark "${landmark.id}" has an unsupported map object type.`);
    }
  }

  const reservedCells = new Set<string>();
  for (const [kind, cells] of [["water", data.grid.waterCells], ["plot", data.grid.plotCells]] as const) {
    for (const cell of cells) {
      const x = cell[0] ?? Number.NaN;
      const z = cell[1] ?? Number.NaN;
      if (cell.length !== 2) errors.push(`${kind} cell must contain exactly two coordinates.`);
      const key = `${x},${z}`;
      if (!inBounds(x, z)) {
        errors.push(`${kind} cell ${key} is outside the map grid.`);
        continue;
      }
      if (reservedCells.has(key)) errors.push(`Map cell ${key} is reserved more than once.`);
      reservedCells.add(key);
      const building = data.grid.buildings.find((item) =>
        x >= item.x && x <= item.x + 1 && z >= item.z && z <= item.z + 1,
      );
      if (building) errors.push(`${kind} cell ${key} overlaps building "${building.placeId}".`);
      if (grassSymbol && rows[z]?.[x] !== grassSymbol) {
        errors.push(`${kind} cell ${key} must be placed on a grass tile, not a road or another terrain tile.`);
      }
    }
  }

  if (roadSymbol) {
    const roadCells: Array<readonly [number, number]> = [];
    rows.forEach((row, z) => {
      [...row].forEach((symbol, x) => {
        if (symbol === roadSymbol) roadCells.push([x, z]);
      });
    });
    if (roadCells.length === 0) errors.push("The authored map must contain a connected road network.");
    if (roadCells.length > 0) {
      const roadKeys = new Set(roadCells.map(([x, z]) => `${x},${z}`));
      const visited = new Set<string>();
      const queue: Array<readonly [number, number]> = [roadCells[0]!];
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const [x, z] = queue[cursor]!;
        const key = `${x},${z}`;
        if (visited.has(key)) continue;
        visited.add(key);
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const next = `${x + dx},${z + dz}`;
          if (roadKeys.has(next) && !visited.has(next)) queue.push([x + dx, z + dz]);
        }
      }
      if (visited.size !== roadCells.length) {
        errors.push(`Road network is disconnected: ${visited.size} of ${roadCells.length} road cells are reachable.`);
      }
    }
  }

  return errors;
}

import townData from "@/data/osogbo-town.json";

/**
 * Turns the hand-authored town grid into a dense 3D city made from the
 * CC0 Kenney City Kit GLBs already shipped under /models/city.
 *
 * Pure and deterministic: the same grid always yields the same city, so the
 * layout never reshuffles between renders or sessions.
 */

export type TownGrid = {
  rows: readonly string[];
  waterCells: readonly (readonly number[])[];
  plotCells: readonly (readonly number[])[];
  buildings: readonly { x: number; z: number }[];
};

export type CityPiece = {
  path: string;
  /** World-space position on the ground plane. */
  x: number;
  z: number;
  /** Rotation around the Y axis, in radians. */
  rotation: number;
  scale: number;
};

export type CityWaterCell = { x: number; z: number };

export type TownCity = {
  pieces: CityPiece[];
  water: CityWaterCell[];
};

const CELL_SIZE = 2;
const ROAD_PREFIX = "/models/city/roads/Models/GLB format";
const COMMERCIAL_PREFIX = "/models/city/commercial/Models/GLB format";
const SUBURBAN_PREFIX = "/models/city/suburban/Models/GLB format";
const CAR_PREFIX = "/models/city/cars/Models/GLB format";

const ROAD_STRAIGHT = `${ROAD_PREFIX}/road-straight.glb`;
const ROAD_CROSSROAD = `${ROAD_PREFIX}/road-crossroad.glb`;

const COMMERCIAL_BLOCKS = [
  "building-a",
  "building-b",
  "building-c",
  "building-d",
  "building-e",
  "building-f",
  "building-g",
  "building-h",
  "building-i",
  "building-j",
  "building-k",
  "building-l",
  "building-m",
  "building-n",
].map((name) => `${COMMERCIAL_PREFIX}/${name}.glb`);

const SKYSCRAPERS = ["building-skyscraper-a", "building-skyscraper-b", "building-skyscraper-c"].map(
  (name) => `${COMMERCIAL_PREFIX}/${name}.glb`,
);

const HOUSES = ["a", "b", "c", "d", "e", "f", "g", "h"].map(
  (letter) => `${SUBURBAN_PREFIX}/building-type-${letter}.glb`,
);

const TREE = `${SUBURBAN_PREFIX}/tree-large.glb`;

const CARS = ["sedan", "taxi", "van", "suv", "delivery", "police"].map(
  (name) => `${CAR_PREFIX}/${name}.glb`,
);

/** Deterministic pseudo-random number in [0, 1) from integer cell coordinates. */
function hash(x: number, z: number, salt: number): number {
  let h =
    Math.imul(x + 101, 374761393) ^ Math.imul(z + 211, 668265263) ^ Math.imul(salt + 7, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pick<T>(items: readonly T[], value: number): T {
  return items[Math.min(items.length - 1, Math.floor(value * items.length))]!;
}

/** Map a grid cell to the world position of its centre. Matches MapCanvas scenePoint. */
export function cellToWorld(x: number, z: number): [number, number] {
  return [(x - 6.5) * CELL_SIZE, (z - 4.5) * CELL_SIZE];
}

export function buildTownCity(grid: TownGrid): TownCity {
  const rows = grid.rows;
  const cols = rows[0]?.length ?? 0;
  const key = (x: number, z: number) => `${x},${z}`;
  const water = new Set(grid.waterCells.map(([x, z]) => key(x!, z!)));
  const plots = new Set(grid.plotCells.map(([x, z]) => key(x!, z!)));
  const landmarks = new Map(grid.buildings.map((b) => [key(b.x, b.z), b]));
  const isRoad = (x: number, z: number) => rows[z]?.[x] === "r";

  const pieces: CityPiece[] = [];
  const cars: CityPiece[] = [];

  for (let z = 0; z < rows.length; z += 1) {
    for (let x = 0; x < cols; x += 1) {
      const [wx, wz] = cellToWorld(x, z);
      const cell = key(x, z);
      const r = hash(x, z, 1);
      const r2 = hash(x, z, 2);
      const quarter = Math.floor(hash(x, z, 3) * 4) * (Math.PI / 2);

      if (water.has(cell)) continue;

      if (isRoad(x, z)) {
        const horizontal = isRoad(x - 1, z) || isRoad(x + 1, z);
        const vertical = isRoad(x, z - 1) || isRoad(x, z + 1);
        const crossing = horizontal && vertical;
        pieces.push({
          path: crossing ? ROAD_CROSSROAD : ROAD_STRAIGHT,
          x: wx,
          z: wz,
          rotation: !crossing && vertical && !horizontal ? Math.PI / 2 : 0,
          scale: CELL_SIZE,
        });
        // Cars drive along the road, offset into one lane.
        if (hash(x, z, 4) < 0.22 && !crossing) {
          const alongVertical = vertical && !horizontal;
          const lane = hash(x, z, 5) < 0.5 ? -0.42 : 0.42;
          const along = (hash(x, z, 6) - 0.5) * 0.6;
          cars.push({
            path: pick(CARS, hash(x, z, 7)),
            x: wx + (alongVertical ? lane : along),
            z: wz + (alongVertical ? along : lane),
            rotation: alongVertical ? 0 : Math.PI / 2,
            scale: 0.55,
          });
        }
        continue;
      }

      const landmark = landmarks.get(cell);
      if (landmark) {
        pieces.push({
          path: pick(SKYSCRAPERS, r),
          x: wx,
          z: wz,
          rotation: quarter,
          scale: CELL_SIZE,
        });
        continue;
      }

      if (plots.has(cell)) {
        pieces.push({
          path: pick(HOUSES, r),
          x: wx,
          z: wz,
          rotation: quarter,
          scale: 1.5,
        });
        if (r2 < 0.5) {
          pieces.push({
            path: TREE,
            x: wx + 0.7,
            z: wz - 0.6,
            rotation: 0,
            scale: 2.2,
          });
        }
        continue;
      }

      // Open grass: mostly small blocks, sometimes a tree, sometimes left open.
      if (r < 0.5) {
        pieces.push({
          path: pick(COMMERCIAL_BLOCKS, r2),
          x: wx,
          z: wz,
          rotation: quarter,
          scale: CELL_SIZE,
        });
      } else if (r < 0.72) {
        pieces.push({
          path: TREE,
          x: wx + (hash(x, z, 8) - 0.5) * 0.9,
          z: wz + (hash(x, z, 9) - 0.5) * 0.9,
          rotation: 0,
          scale: 2.2,
        });
      }
    }
  }

  const waterCells = [...water].map((cell) => {
    const [x, z] = cell.split(",").map(Number) as [number, number];
    const [wx, wz] = cellToWorld(x, z);
    return { x: wx, z: wz };
  });

  return { pieces: [...pieces, ...cars], water: waterCells };
}

export const townCity = buildTownCity({
  rows: townData.grid.rows,
  waterCells: townData.grid.waterCells,
  plotCells: townData.grid.plotCells,
  buildings: townData.grid.buildings,
});

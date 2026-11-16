import { useMemo } from "react";
import town from "@/data/osogbo-town.json";
import { WorldHouse } from "@/components/3d/WorldScene";

type Point = (x: number, z: number) => [number, number, number];

/**
 * Exterior shapes for the six home types from the housing blueprints. Sizes are fractions of the
 * town cell. Duplexes are two storeys, bungalows are wide and low, and the Shared Room is the
 * smallest block (the cheaper version of the Private Room).
 */
export const HOME_TYPE_EXTERIOR = {
  "shared-room": { width: 0.5, depth: 0.5, height: 0.5 },
  "private-room": { width: 0.55, depth: 0.55, height: 0.6 },
  "mini-flat": { width: 0.6, depth: 0.6, height: 0.9 },
  "studio-flat": { width: 0.6, depth: 0.7, height: 0.9 },
  bungalow: { width: 0.75, depth: 0.75, height: 0.55 },
  duplex: { width: 0.65, depth: 0.65, height: 1.4 },
} as const;

export type HomeType = keyof typeof HOME_TYPE_EXTERIOR;

/** Which home types each district uses. Each house picks one from its district's list. */
const DISTRICT_HOME_TYPES: Record<string, readonly HomeType[]> = {
  "market-quarter": ["studio-flat", "mini-flat", "shared-room"],
  "civic-quarter": ["private-room", "mini-flat"],
  "commerce-quarter": ["studio-flat", "duplex"],
  "central-crossing": ["shared-room", "private-room"],
  "garden-quarter": ["bungalow", "private-room"],
  "learning-quarter": ["shared-room", "mini-flat"],
  "transit-quarter": ["private-room", "shared-room"],
  "open-fields": ["bungalow"],
  "river-quarter": ["bungalow", "duplex"],
  "south-quarter": ["mini-flat", "studio-flat", "private-room"],
  "east-gate": ["studio-flat", "duplex"],
  "oja-oba": ["duplex", "studio-flat"],
  ataoja: ["bungalow", "duplex"],
  "oke-baale": ["bungalow", "mini-flat"],
  "aleku-wodo": ["shared-room", "private-room", "mini-flat"],
  "ogo-oluwa": ["bungalow", "private-room"],
  "oke-fia": ["duplex", "bungalow"],
  olaiya: ["mini-flat", "private-room"],
  "isale-aro": ["shared-room", "private-room"],
};

const DEFAULT_TYPES: readonly HomeType[] = ["private-room"];

/** Each district turns its houses this way, so neighbouring districts look different. */
const DISTRICT_ROTATION: Record<string, number> = {
  "civic-quarter": Math.PI / 2,
  "central-crossing": Math.PI / 2,
  "learning-quarter": Math.PI / 2,
  "oke-baale": Math.PI / 2,
  "south-quarter": Math.PI / 2,
  "oke-fia": Math.PI / 2,
  "river-quarter": Math.PI / 4,
  "oja-oba": Math.PI / 4,
  "open-fields": Math.PI / 4,
  "ogo-oluwa": Math.PI / 4,
};

/** A cheap, stable 0..1 value from a cell, so each house varies a little without randomness per render. */
function cellNoise(x: number, z: number, salt: number) {
  const n = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Builds the decorative houses across every district's free grid cells. Each house takes its
 * exterior from its home type. The houses are scenery only: they have no pointer handlers.
 */
export function HouseBlocks3D({ point, cell }: { point: Point; cell: number }) {
  const houses = useMemo(() => {
    const rows = town.grid.rows;
    const blocked = new Set<string>();
    const block = (x: number, z: number) => blocked.add(x + "," + z);
    for (const [x, z] of [
      ...town.grid.plotCells,
      ...town.grid.treeCells,
      ...town.grid.carCells,
      ...town.grid.waterCells,
    ])
      block(x, z);
    for (const building of town.grid.buildings) {
      for (let dz = 0; dz < 2; dz++)
        for (let dx = 0; dx < 2; dx++) block(building.x + dx, building.z + dz);
    }
    for (const landmark of town.landmarks) block(landmark.grid.x, landmark.grid.z);

    const isFree = (x: number, z: number) =>
      z >= 0 &&
      z < rows.length &&
      x >= 0 &&
      x < rows[0]!.length &&
      rows[z]![x] !== "r" &&
      !blocked.has(x + "," + z);

    const out: {
      key: string;
      x: number;
      z: number;
      type: HomeType;
      rotation: number;
    }[] = [];
    for (const district of town.districts) {
      const types = DISTRICT_HOME_TYPES[district.id] ?? DEFAULT_TYPES;
      const rotation = DISTRICT_ROTATION[district.id] ?? 0;
      const area = district.gridArea;
      // Every free cell in the district gets one house. Its type comes from the district's list.
      for (let z = area.z; z < area.z + area.depth; z += 1) {
        for (let x = area.x; x < area.x + area.width; x += 1) {
          if (!isFree(x, z)) continue;
          const pick = Math.floor(cellNoise(x, z, 1) * types.length);
          out.push({
            key: `${district.id}-${x}-${z}`,
            x: x + 0.5,
            z: z + 0.5,
            type: types[pick]!,
            rotation,
          });
        }
      }
    }
    return out;
  }, []);

  return (
    <group name="house-blocks">
      {houses.map((house) => {
        const exterior = HOME_TYPE_EXTERIOR[house.type];
        const jitter = 0.9 + cellNoise(house.x, house.z, 2) * 0.2;
        return (
          <WorldHouse
            key={house.key}
            position={point(house.x, house.z)}
            width={cell * exterior.width}
            depth={cell * exterior.depth}
            height={cell * exterior.height * jitter * 0.95}
            rotation={house.rotation}
            variant="residential"
          />
        );
      })}
    </group>
  );
}

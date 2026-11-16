import { useMemo } from "react";
import town from "@/data/osogbo-town.json";
import { WorldHouse } from "@/components/3d/WorldScene";

type Point = (x: number, z: number) => [number, number, number];

/**
 * Each district gets its own house style, so one street of homes looks different from the next.
 * Height, width and rotation are multiples of the town cell size.
 */
const DISTRICT_HOUSE_STYLE: Record<
  string,
  { height: number; width: number; depth: number; rotation: number; variant: string }
> = {
  "market-quarter": { height: 1.5, width: 1.0, depth: 1.0, rotation: 0, variant: "residential" },
  "civic-quarter": {
    height: 1.1,
    width: 0.95,
    depth: 0.95,
    rotation: Math.PI / 2,
    variant: "residential",
  },
  "commerce-quarter": { height: 1.9, width: 1.0, depth: 0.9, rotation: 0, variant: "residential" },
  "central-crossing": {
    height: 1.3,
    width: 0.9,
    depth: 1.0,
    rotation: Math.PI / 2,
    variant: "residential",
  },
  "garden-quarter": { height: 0.8, width: 0.85, depth: 0.85, rotation: 0, variant: "residential" },
  "learning-quarter": {
    height: 1.2,
    width: 1.0,
    depth: 0.8,
    rotation: Math.PI / 2,
    variant: "residential",
  },
  "transit-quarter": { height: 1.0, width: 0.9, depth: 0.9, rotation: 0, variant: "residential" },
  "open-fields": {
    height: 0.6,
    width: 0.8,
    depth: 0.8,
    rotation: Math.PI / 4,
    variant: "residential",
  },
  "river-quarter": {
    height: 0.9,
    width: 0.9,
    depth: 1.0,
    rotation: Math.PI / 4,
    variant: "residential",
  },
  "south-quarter": {
    height: 1.4,
    width: 1.0,
    depth: 1.0,
    rotation: Math.PI / 2,
    variant: "residential",
  },
  "east-gate": { height: 1.7, width: 0.9, depth: 0.9, rotation: 0, variant: "residential" },
  "oja-oba": { height: 1.6, width: 1.0, depth: 1.0, rotation: Math.PI / 4, variant: "residential" },
  ataoja: { height: 1.0, width: 1.0, depth: 0.9, rotation: 0, variant: "residential" },
  "oke-baale": {
    height: 1.2,
    width: 0.95,
    depth: 0.95,
    rotation: Math.PI / 2,
    variant: "residential",
  },
  "aleku-wodo": { height: 0.9, width: 0.85, depth: 1.1, rotation: 0, variant: "residential" },
  "ogo-oluwa": {
    height: 0.7,
    width: 0.9,
    depth: 0.9,
    rotation: Math.PI / 4,
    variant: "residential",
  },
  olaiya: { height: 1.0, width: 0.9, depth: 0.9, rotation: 0, variant: "residential" },
  "isale-aro": {
    height: 1.3,
    width: 0.85,
    depth: 0.85,
    rotation: Math.PI / 2,
    variant: "residential",
  },
  "oke-fia": {
    height: 1.35,
    width: 0.9,
    depth: 0.85,
    rotation: Math.PI / 2,
    variant: "residential",
  },
};

const FALLBACK_STYLE = { height: 1.0, width: 0.9, depth: 0.9, rotation: 0, variant: "residential" };

/** A cheap, stable 0..1 value from a cell, so each house varies a little without randomness per render. */
function cellNoise(x: number, z: number) {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Builds blocks of decorative houses across every district's free grid cells. The houses are
 * scenery only: they have no pointer handlers, so they can't be clicked.
 */
export function HouseBlocks3D({ point, cell }: { point: Point; cell: number }) {
  const blocks = useMemo(() => {
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
      style: (typeof DISTRICT_HOUSE_STYLE)[string];
    }[] = [];
    for (const district of town.districts) {
      const style = DISTRICT_HOUSE_STYLE[district.id] ?? FALLBACK_STYLE;
      const area = district.gridArea;
      // Every free cell in the district gets one house, so each district fills with its own street of homes.
      for (let z = area.z; z < area.z + area.depth; z += 1) {
        for (let x = area.x; x < area.x + area.width; x += 1) {
          if (!isFree(x, z)) continue;
          out.push({ key: `${district.id}-${x}-${z}`, x: x + 0.5, z: z + 0.5, style });
        }
      }
    }
    return out;
  }, []);

  return (
    <group name="house-blocks">
      {blocks.map((entry) => {
        const jitter = 0.9 + cellNoise(entry.x, entry.z) * 0.2;
        return (
          <WorldHouse
            key={entry.key}
            position={point(entry.x, entry.z)}
            width={cell * entry.style.width * 0.6}
            depth={cell * entry.style.depth * 0.6}
            height={cell * entry.style.height * jitter}
            rotation={entry.style.rotation}
            variant={entry.style.variant}
          />
        );
      })}
    </group>
  );
}

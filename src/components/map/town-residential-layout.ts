export type TownHomeStyle = "compound" | "terrace" | "apartment";
export type TownInfillHome = {
  x: number;
  z: number;
  floors: number;
  rotation: number;
  districtId: string;
  style: TownHomeStyle;
};
export type TownResidentialDistrict = {
  id: string;
  theme: string;
  gridArea: { x: number; z: number; width: number; depth: number };
};
const FRONTAGES = [
  { dx: 0, dz: 1, rotation: 0 },
  { dx: 1, dz: 0, rotation: Math.PI / 2 },
  { dx: 0, dz: -1, rotation: Math.PI },
  { dx: -1, dz: 0, rotation: -Math.PI / 2 },
];

/** District-owned scenery, oriented to streets. Never creates purchasable/server-owned homes. */
export function townResidentialLayout({
  rows,
  buildings,
  landmarks,
  districts = [],
  reserved = [],
  reservedCells = [],
  cell,
  limit = 96,
}: {
  rows: readonly string[];
  buildings: readonly { x: number; z: number }[];
  landmarks: readonly { grid: { x: number; z: number } }[];
  districts?: readonly TownResidentialDistrict[];
  reserved?: readonly (readonly [number, number])[];
  reservedCells?: readonly (readonly number[])[];
  cell: number;
  limit?: number;
}): TownInfillHome[] {
  if (limit <= 0) return [];
  const columns = rows[0]?.length ?? 0;
  const blocks = new Map<string, TownInfillHome[]>();
  for (let z = 1; z < rows.length - 1; z++)
    for (let x = 1; x < columns - 1; x++) {
      if (rows[z]![x] !== "g" || reservedCells.some(([rx, rz]) => x === rx && z === rz)) continue;
      const district = districts.find(
        (d) =>
          x >= d.gridArea.x &&
          x < d.gridArea.x + d.gridArea.width &&
          z >= d.gridArea.z &&
          z < d.gridArea.z + d.gridArea.depth,
      );
      // Leave inter-district margins as open landscape rather than inventing extra blocks.
      if (districts.length && !district) continue;
      const front =
        FRONTAGES.find((d) => rows[z + d.dz]?.[x + d.dx] === "r") ??
        FRONTAGES.find((d) => rows[z + d.dz * 2]?.[x + d.dx * 2] === "r");
      if (!front) continue;
      if (buildings.some((b) => Math.abs(x - b.x - 0.5) < 1.15 && Math.abs(z - b.z - 0.5) < 1.15))
        continue;
      if (landmarks.some((l) => Math.hypot(x - l.grid.x, z - l.grid.z) < 1.05)) continue;
      const worldX = (x - (columns - 1) / 2) * cell,
        worldZ = (z - (rows.length - 1) / 2) * cell;
      if (reserved.some(([rx, rz]) => Math.hypot(worldX - rx, worldZ - rz) < cell * 1.15)) continue;
      const theme = district?.theme ?? "residential";
      // Garden and fringe districts retain open land between compounds.
      if (["leisure", "outskirts", "school"].includes(theme) && (x + z) % 3 !== 0) continue;
      const style: TownHomeStyle =
        theme === "transport" || district?.id === "commerce-quarter"
          ? "apartment"
          : theme === "market" || theme === "residential"
            ? "terrace"
            : "compound";
      const floors =
        style === "apartment" ? 3 : style === "terrace" && theme === "residential" ? 2 : 1;
      const districtId = district?.id ?? "residential-infill";
      const block = blocks.get(districtId) ?? [];
      block.push({ x, z, floors, rotation: front.rotation, districtId, style });
      blocks.set(districtId, block);
    }
  // Distribute the scenery budget across districts, rather than consuming it in the northern rows.
  const result: TownInfillHome[] = [];
  const queues = [...blocks.values()];
  for (let index = 0; result.length < limit; index++) {
    let added = false;
    for (const block of queues) {
      const next = block[index];
      if (next) {
        result.push(next);
        added = true;
        if (result.length >= limit) return result;
      }
    }
    if (!added) break;
  }
  return result;
}

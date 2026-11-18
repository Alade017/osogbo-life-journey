import type { WorldInstance } from "@/components/3d/WorldScene";

/** All authored street/actor coordinates use y=0 as the finished ground level. */
export const TOWN_SURFACE = {
  groundTop: 0,
  landDepth: 0.48,
  bedTop: -0.5,
  waterTop: -0.16,
  waterDepth: 0.08,
} as const;

export function townSurfaceLayout(rows: readonly string[], cell: number) {
  if (!rows.length || cell <= 0 || !Number.isFinite(cell))
    throw new Error("Invalid town terrain dimensions");
  const columns = rows[0]!.length;
  if (!columns || rows.some((row) => row.length !== columns))
    throw new Error("Town terrain rows must have equal widths");
  const land: WorldInstance[] = [];
  const water: WorldInstance[] = [];
  const banks: WorldInstance[] = [];
  rows.forEach((row, z) =>
    Array.from(row).forEach((tile, x) => {
      const worldX = (x - (columns - 1) / 2) * cell;
      const worldZ = (z - (rows.length - 1) / 2) * cell;
      if (tile !== "w") {
        land.push({
          position: [worldX, -TOWN_SURFACE.landDepth / 2, worldZ],
          scale: [cell, TOWN_SURFACE.landDepth, cell],
        });
        return;
      }
      water.push({
        position: [worldX, TOWN_SURFACE.waterTop - TOWN_SURFACE.waterDepth / 2, worldZ],
        scale: [cell, TOWN_SURFACE.waterDepth, cell],
      });
      for (const [dx, dz] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const neighbour = rows[z + dz]?.[x + dx];
        if (!neighbour || neighbour === "w") continue;
        banks.push({
          position: [worldX + dx * (cell / 2 - 0.04), -0.11, worldZ + dz * (cell / 2 - 0.04)],
          scale: dx ? [0.08, 0.3, cell] : [cell, 0.3, 0.08],
        });
      }
    }),
  );
  return { width: columns * cell, depth: rows.length * cell, land, water, banks };
}

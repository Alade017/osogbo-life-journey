import type { MapProperty } from "./MapCanvas";
import town from "@/data/osogbo-town.json";
import { mapTownGridToScene } from "@/lib/town-grid";

const grid = {
  columns: town.grid.rows[0]!.length,
  rows: town.grid.rows.length,
  cellSize: town.grid.cellSize,
};

const models = new Set<MapProperty["type"]>(["compound", "flat", "shophouse"]);
const statuses = new Set<MapProperty["status"]>([
  "owned",
  "current",
  "rent_due",
  "overdue",
  "vacant",
]);

export function mapHousingMarkers(value: unknown): MapProperty[] {
  if (!Array.isArray(value)) throw new Error("The housing map data is unavailable.");
  return value.flatMap((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const row = entry as Record<string, unknown>;
    if (
      typeof row["propertyId"] !== "string" ||
      typeof row["label"] !== "string" ||
      !models.has(row["model"] as MapProperty["type"]) ||
      !statuses.has(row["status"] as MapProperty["status"]) ||
      !Number.isInteger(row["gridX"]) ||
      !Number.isInteger(row["gridZ"]) ||
      ![1, 2, 3].includes(row["tier"] as number)
    )
      return [];
    const x = row["gridX"] as number;
    const z = row["gridZ"] as number;
    if (x < 0 || x >= grid.columns || z < 0 || z >= grid.rows) return [];
    const point = mapTownGridToScene({ ...grid, cells: [{ x, z, kind: "plot" }] })[0]!;
    return [
      {
        id: row["propertyId"],
        label: row["label"],
        type: row["model"] as MapProperty["type"],
        status: row["status"] as MapProperty["status"],
        tier: row["tier"] as MapProperty["tier"],
        position: [point.x, 0, point.z] as [number, number, number],
      },
    ];
  });
}

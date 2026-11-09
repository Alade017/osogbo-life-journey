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

/** Reject an incomplete server payload instead of silently presenting a partial property map. */
export function mapHousingMarkers(value: unknown): MapProperty[] {
  if (!Array.isArray(value)) throw new Error("The housing map data is unavailable.");
  const ids = new Set<string>();

  return value.map((entry: unknown, index): MapProperty => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error(`Housing map row ${index + 1} is invalid.`);
    const row = entry as Record<string, unknown>;
    if (
      typeof row["propertyId"] !== "string" ||
      !row["propertyId"].trim() ||
      typeof row["label"] !== "string" ||
      !row["label"].trim() ||
      !models.has(row["model"] as MapProperty["type"]) ||
      !statuses.has(row["status"] as MapProperty["status"]) ||
      !Number.isInteger(row["gridX"]) ||
      !Number.isInteger(row["gridZ"]) ||
      ![1, 2, 3].includes(row["tier"] as number)
    )
      throw new Error(`Housing map row ${index + 1} has incomplete property details.`);

    const id = row["propertyId"];
    if (ids.has(id)) throw new Error("The housing map contains duplicate property IDs.");
    ids.add(id);

    const x = row["gridX"] as number;
    const z = row["gridZ"] as number;
    if (x < 0 || x >= grid.columns || z < 0 || z >= grid.rows)
      throw new Error(`Housing map property ${id} is outside the town map.`);

    const point = mapTownGridToScene({ ...grid, cells: [{ x, z, kind: "plot" }] })[0];
    if (!point) throw new Error(`Housing map property ${id} could not be positioned.`);

    return {
      id,
      label: row["label"],
      type: row["model"] as MapProperty["type"],
      status: row["status"] as MapProperty["status"],
      tier: row["tier"] as MapProperty["tier"],
      position: [point.x, 0, point.z],
    };
  });
}

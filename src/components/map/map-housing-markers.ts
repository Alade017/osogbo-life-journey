import type { MapProperty } from "./MapCanvas";

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
    if (x < 0 || x > 13 || z < 0 || z > 9) return [];
    return [
      {
        id: row["propertyId"],
        label: row["label"],
        type: row["model"] as MapProperty["type"],
        status: row["status"] as MapProperty["status"],
        tier: row["tier"] as MapProperty["tier"],
        position: [(x - 6.5) * 2, 0, (z - 4.5) * 2] as [number, number, number],
      },
    ];
  });
}

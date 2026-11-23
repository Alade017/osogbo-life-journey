/** The player's active home as the server reports it from /api/housing/current-home. */
export type CanonicalHome = {
  propertyId: string;
  playerPropertyId: string;
  houseTypeId: string;
  name: string;
  imageUrl: string | null;
  district: string | null;
  tenure: string;
  status: string | null;
  dueAt: string | null;
  graceEndsAt: string | null;
  rescueEndsAt: string | null;
  weeklyRentMinor: number;
  accessoryBand: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function normalizeCanonicalHome(value: unknown): CanonicalHome | null {
  if (
    !isRecord(value) ||
    typeof value["propertyId"] !== "string" ||
    typeof value["playerPropertyId"] !== "string"
  )
    return null;
  if (typeof value["houseTypeId"] !== "string" || typeof value["name"] !== "string") return null;
  return {
    propertyId: value["propertyId"],
    playerPropertyId: value["playerPropertyId"],
    houseTypeId: value["houseTypeId"],
    name: value["name"],
    imageUrl: typeof value["imageUrl"] === "string" ? value["imageUrl"] : null,
    district: typeof value["district"] === "string" ? value["district"] : null,
    tenure: typeof value["tenure"] === "string" ? value["tenure"] : "rented",
    status: typeof value["status"] === "string" ? value["status"] : null,
    dueAt: typeof value["dueAt"] === "string" ? value["dueAt"] : null,
    graceEndsAt: typeof value["graceEndsAt"] === "string" ? value["graceEndsAt"] : null,
    rescueEndsAt: typeof value["rescueEndsAt"] === "string" ? value["rescueEndsAt"] : null,
    weeklyRentMinor: typeof value["weeklyRentMinor"] === "number" ? value["weeklyRentMinor"] : 0,
    accessoryBand: typeof value["accessoryBand"] === "string" ? value["accessoryBand"] : "basic",
  };
}

export type LandmarkBuildingVariant =
  | "residential"
  | "market"
  | "bank"
  | "civic"
  | "health"
  | "school"
  | "church"
  | "mosque"
  | "worship"
  | "transit"
  | "sport"
  | "club"
  | "services";

const BUILDING_VARIANTS: Readonly<Record<string, LandmarkBuildingVariant>> = {
  market: "market",
  food: "market",
  bank: "bank",
  civic: "civic",
  "public-service": "civic",
  health: "health",
  clinic: "health",
  school: "school",
  church: "church",
  mosque: "mosque",
  worship: "worship",
  transit: "transit",
  transport: "transit",
  sport: "sport",
  club: "club",
  services: "services",
};

/** Resolve map data aliases to the visual variants supported by WorldHouse. */
export function getLandmarkBuildingVariant(
  buildingType: string | null | undefined,
): LandmarkBuildingVariant {
  const key = buildingType?.trim().toLowerCase() ?? "";
  return BUILDING_VARIANTS[key] ?? "residential";
}

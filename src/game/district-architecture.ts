import type { WorldTone } from "../components/3d/world-theme";
import type { WorldMapCategory } from "../lib/city-world";

export type BuildingRoofProfile = "pitched" | "flat" | "parapet";
export type BuildingFrontageProfile = "veranda" | "awning" | "portico" | "canopy" | "recessed" | "plain";

export type DistrictArchitecture = {
  roof: BuildingRoofProfile;
  frontage: BuildingFrontageProfile;
  windowGrilles: boolean;
  accent: WorldTone;
};

const ARCHITECTURE: Readonly<Record<string, DistrictArchitecture>> = {
  residential: { roof: "pitched", frontage: "veranda", windowGrilles: true, accent: "roof" },
  market: { roof: "flat", frontage: "awning", windowGrilles: false, accent: "accent" },
  bank: { roof: "parapet", frontage: "portico", windowGrilles: true, accent: "slate" },
  civic: { roof: "parapet", frontage: "portico", windowGrilles: true, accent: "slate" },
  health: { roof: "flat", frontage: "recessed", windowGrilles: true, accent: "foliage" },
  school: { roof: "pitched", frontage: "veranda", windowGrilles: true, accent: "sign" },
  church: { roof: "flat", frontage: "portico", windowGrilles: false, accent: "clay" },
  mosque: { roof: "flat", frontage: "portico", windowGrilles: false, accent: "roofLight" },
  worship: { roof: "flat", frontage: "portico", windowGrilles: false, accent: "linen" },
  transit: { roof: "flat", frontage: "canopy", windowGrilles: false, accent: "accent" },
  sport: { roof: "flat", frontage: "canopy", windowGrilles: false, accent: "foliage" },
  club: { roof: "flat", frontage: "awning", windowGrilles: false, accent: "sign" },
  services: { roof: "parapet", frontage: "recessed", windowGrilles: true, accent: "concrete" },
};

const VARIANT_ALIASES: Readonly<Record<string, keyof typeof ARCHITECTURE>> = {
  food: "market",
  "public-service": "civic",
  clinic: "health",
  transport: "transit",
};

const WORLD_CATEGORY_ARCHITECTURE: Readonly<Record<WorldMapCategory, string>> = {
  residential: "residential",
  commercial: "market",
  work_industrial: "services",
  education: "school",
  health: "health",
  transport: "transit",
  government: "civic",
  recreation: "sport",
  water_nature: "services",
};

/** Resolve a database world category to an existing reusable building profile. */
export function districtArchitectureVariantForCategory(
  category: string | null | undefined,
): string {
  if (!category || !Object.hasOwn(WORLD_CATEGORY_ARCHITECTURE, category)) return "services";
  return WORLD_CATEGORY_ARCHITECTURE[category as WorldMapCategory];
}

export function getDistrictArchitecture(variant: string | null | undefined): DistrictArchitecture {
  const key = variant?.trim().toLowerCase() ?? "";
  const canonical = VARIANT_ALIASES[key] ?? key;
  return ARCHITECTURE[canonical] ?? ARCHITECTURE.residential!;
}

export type PitchedRoofPanel = {
  positionX: number;
  width: number;
  rotation: number;
};

/** Returns two matching roof panels whose inner edges meet at the ridge. */
export function getPitchedRoofPanel(side: "left" | "right", buildingWidth: number): PitchedRoofPanel {
  return {
    positionX: side === "left" ? -buildingWidth * 0.25 : buildingWidth * 0.25,
    width: buildingWidth * 0.5,
    rotation: side === "left" ? 0.34 : -0.34,
  };
}

export const DISTRICT_ARCHITECTURE_VARIANTS = Object.keys(ARCHITECTURE);

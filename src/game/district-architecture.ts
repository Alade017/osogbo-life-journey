import type { WorldTone } from "../components/3d/world-theme";

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
  church: { roof: "pitched", frontage: "portico", windowGrilles: false, accent: "clay" },
  mosque: { roof: "flat", frontage: "portico", windowGrilles: false, accent: "roofLight" },
  worship: { roof: "pitched", frontage: "portico", windowGrilles: false, accent: "linen" },
  transit: { roof: "flat", frontage: "canopy", windowGrilles: false, accent: "accent" },
  sport: { roof: "flat", frontage: "canopy", windowGrilles: false, accent: "foliage" },
  club: { roof: "flat", frontage: "awning", windowGrilles: false, accent: "sign" },
  services: { roof: "parapet", frontage: "recessed", windowGrilles: true, accent: "concrete" },
};

export function getDistrictArchitecture(variant: string | null | undefined): DistrictArchitecture {
  const key = variant?.trim().toLowerCase() ?? "";
  return ARCHITECTURE[key] ?? ARCHITECTURE.residential!;
}

export const DISTRICT_ARCHITECTURE_VARIANTS = Object.keys(ARCHITECTURE);

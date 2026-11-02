import { cityEntranceForRecord } from "../lib/city-world.ts";
import { neighborhoodAreaForSlug, neighborhoodAreaOrigin } from "./neighborhood-model.ts";

/** Expand this allowlist only after the district's layout/navigation acceptance. */
export const PLAYABLE_DISTRICT_SLUGS = ["city-centre", "oja-oba"] as const;
export function isPlayableDistrict(slug: string | undefined): boolean {
  return PLAYABLE_DISTRICT_SLUGS.some((candidate) => candidate === slug);
}

export function playableDistrictForLocation(
  location: { slug: string; map_x: number; map_y: number } | undefined,
) {
  if (!location || !isPlayableDistrict(location.slug)) return null;
  return {
    area: neighborhoodAreaForSlug(location.slug),
    origin: neighborhoodAreaOrigin(cityEntranceForRecord(location)),
    personalHome: location.slug === "city-centre",
  };
}

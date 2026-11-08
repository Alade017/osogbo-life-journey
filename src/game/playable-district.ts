import { cityEntranceForRecord } from "../lib/city-world.ts";
import { neighborhoodAreaForLocation, neighborhoodAreaOrigin } from "./neighborhood-model.ts";

const STABLE_LOCATION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Any stable slug can be walked. The active database row is the authority: it supplies the name,
 * category, entrance and coordinates, so no per-place registration is needed.
 */
export function isPlayableDistrict(slug: string | undefined): boolean {
  return !!slug && STABLE_LOCATION_SLUG.test(slug);
}

export type PlayableLocationRecord = {
  id: string;
  slug: string;
  name?: string | null;
  map_category?: string | null;
  map_x: number;
  map_y: number;
  is_active: true;
};

function hasValidMapCoordinates(record: Record<string, unknown>) {
  const mapX = record["map_x"];
  const mapY = record["map_y"];
  return (
    typeof mapX === "number" &&
    Number.isFinite(mapX) &&
    mapX >= 0 &&
    mapX <= 100 &&
    typeof mapY === "number" &&
    Number.isFinite(mapY) &&
    mapY >= 0 &&
    mapY <= 100
  );
}

/** Validate the active database row before using its slug to select generated world content. */
export function isPlayableLocationRecord(value: unknown): value is PlayableLocationRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record["id"] === "string" &&
    record["is_active"] === true &&
    typeof record["slug"] === "string" &&
    isPlayableDistrict(record["slug"]) &&
    hasValidMapCoordinates(record)
  );
}

export function playableDistrictForLocation(
  location:
    | {
        slug: string;
        name?: string | null;
        map_category?: string | null;
        map_x: number;
        map_y: number;
        is_active: boolean;
      }
    | undefined,
) {
  if (
    !location ||
    location.is_active !== true ||
    !isPlayableDistrict(location.slug) ||
    !hasValidMapCoordinates(location)
  )
    return null;
  return {
    area: neighborhoodAreaForLocation(location),
    origin: neighborhoodAreaOrigin(cityEntranceForRecord(location)),
    personalHome: location.slug === "city-centre",
  };
}

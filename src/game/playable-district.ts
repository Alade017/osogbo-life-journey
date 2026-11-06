import {
  OSOGBO_WORLD_NODES,
  WORLD_LOCATION_NODES,
  cityEntranceForRecord,
} from "../lib/city-world.ts";
import { neighborhoodAreaForSlug, neighborhoodAreaOrigin } from "./neighborhood-model.ts";

const STABLE_LOCATION_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A stable city-world blueprint and an explicit entrance are both required. */
export function isPlayableDistrict(slug: string | undefined): boolean {
  if (!slug || !STABLE_LOCATION_SLUG.test(slug)) return false;
  if (!Object.hasOwn(OSOGBO_WORLD_NODES, slug) || !Object.hasOwn(WORLD_LOCATION_NODES, slug))
    return false;
  return OSOGBO_WORLD_NODES[slug as keyof typeof OSOGBO_WORLD_NODES].slug === slug;
}

/** Retained for existing consumers; entries are derived from blueprint/entrance eligibility. */
export const PLAYABLE_DISTRICT_SLUGS: readonly string[] = Object.freeze(
  Object.keys(OSOGBO_WORLD_NODES).filter(isPlayableDistrict),
);

export type PlayableLocationRecord = {
  id: string;
  slug: string;
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
  location: { slug: string; map_x: number; map_y: number; is_active: boolean } | undefined,
) {
  if (
    !location ||
    location.is_active !== true ||
    !isPlayableDistrict(location.slug) ||
    !hasValidMapCoordinates(location)
  )
    return null;
  return {
    area: neighborhoodAreaForSlug(location.slug),
    origin: neighborhoodAreaOrigin(cityEntranceForRecord(location)),
    personalHome: location.slug === "city-centre",
  };
}

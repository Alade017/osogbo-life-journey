import type { WorldMapCategory } from "../lib/city-world";
import type { NeighborhoodObject } from "./neighborhood-model";

export type NeighborhoodInteractionAvailability = {
  hasPersonalHome: boolean;
  hasHomeType: boolean;
  hasShopOffers: boolean;
  hasLocalBusinesses: boolean;
  hasBankServices: boolean;
  venueEntranceKind: "market" | "work" | null;
  hasCareerServices: boolean;
};

/** Keep category-to-entrance semantics exhaustive as world categories evolve. */
const VENUE_ENTRANCE_BY_CATEGORY: Record<WorldMapCategory, "market" | "work" | null> = {
  residential: null,
  commercial: "market",
  work_industrial: "work",
  education: "work",
  health: "work",
  transport: "work",
  government: "work",
  recreation: "work",
  water_nature: "work",
};

export function venueEntranceKindForCategory(
  category: string | null | undefined,
): "market" | "work" | null {
  if (!category || !Object.hasOwn(VENUE_ENTRANCE_BY_CATEGORY, category)) return null;
  return VENUE_ENTRANCE_BY_CATEGORY[category as WorldMapCategory];
}

/** Keep actionable entrances aligned with services available at the confirmed location. */
export function availableNeighborhoodTargets(
  objects: readonly NeighborhoodObject[],
  availability: NeighborhoodInteractionAvailability,
): NeighborhoodObject[] {
  return objects.filter((object) => {
    if (object.kind === "npc") return true;
    if (object.kind === "home")
      return availability.hasPersonalHome && availability.hasHomeType;
    if (object.kind === "market")
      return (
        availability.hasShopOffers ||
        availability.hasLocalBusinesses ||
        availability.hasBankServices ||
        availability.venueEntranceKind === "market"
      );
    if (object.kind === "work")
      return availability.hasCareerServices || availability.venueEntranceKind === "work";
    return false;
  });
}

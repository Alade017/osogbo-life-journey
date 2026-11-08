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

/** Route designed venues to the entrance matching their data-backed world category. */
export function venueEntranceKindForCategory(
  category: string | null | undefined,
): "market" | "work" | null {
  if (category === "commercial") return "market";
  if (
    category === "work_industrial" ||
    category === "education" ||
    category === "health" ||
    category === "transport" ||
    category === "government" ||
    category === "recreation" ||
    category === "water_nature"
  ) {
    return "work";
  }
  return null;
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

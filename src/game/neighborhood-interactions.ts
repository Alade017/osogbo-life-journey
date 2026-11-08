import type { NeighborhoodObject } from "./neighborhood-model";

export type NeighborhoodInteractionAvailability = {
  hasPersonalHome: boolean;
  hasHomeType: boolean;
  hasShopOffers: boolean;
  hasLocalBusinesses: boolean;
  hasBankServices: boolean;
  hasVenueInterior: boolean;
  hasCareerServices: boolean;
};

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
        availability.hasVenueInterior
      );
    if (object.kind === "work") return availability.hasCareerServices;
    return false;
  });
}

import { hasLocationVenueDesign } from "@/lib/location-venue-designs";
import { isPlayableDistrict } from "@/game/playable-district";

/** Choose a surface only after the caller confirms the server-saved destination. */
export function destinationSceneRoute(location: { slug: string; type: string }) {
  if (location.type === "bank")
    return { to: "/bank/$slug" as const, params: { slug: location.slug } };
  if (!hasLocationVenueDesign(location.slug) && isPlayableDistrict(location.slug)) {
    return { to: "/neighborhood" as const };
  }
  return null;
}

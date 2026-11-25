import { resolveVenueScene } from "@/lib/venue-scene-resolver";
import type { LocationVenueDesign } from "@/lib/location-venue-designs";
import { commercialVenueLoaders, getCommercialVenueKind, venueSceneLoaders } from "./venue-scene-loaders";

export async function preloadVenueModule(
  slug: string,
  venue: LocationVenueDesign,
  locationId?: string,
): Promise<boolean> {
  const sceneKind = resolveVenueScene(slug, venue, locationId);
  const commercialKind = getCommercialVenueKind(slug, locationId, sceneKind);
  if (commercialKind) {
    try {
      await commercialVenueLoaders[commercialKind]();
      return true;
    } catch {
      return false;
    }
  }
  if (sceneKind === "environment" || sceneKind === "generic") {
    return false;
  }
  try {
    await venueSceneLoaders[sceneKind]();
    return true;
  } catch {
    return false;
  }
}

import { resolveVenueScene } from "@/lib/venue-scene-resolver";
import type { LocationVenueDesign } from "@/lib/location-venue-designs";
import { venueSceneLoaders } from "./venue-scene-loaders";

export async function preloadVenueModule(
  slug: string,
  venue: LocationVenueDesign,
  locationId?: string,
): Promise<boolean> {
  const sceneKind = resolveVenueScene(slug, venue, locationId);
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

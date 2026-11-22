import type { LocationVenueDesign } from "@/lib/location-venue-designs";
import type { VenueSceneKind } from "@/lib/venue-scene-resolver";
import { VENUE_FURNITURE } from "@/lib/venue-furniture-assets";

export function getVenueAssetUrls(
  sceneKind: VenueSceneKind,
  venue: LocationVenueDesign,
): string[] {
  if (sceneKind === "environment") {
    return venue.environment ? [venue.environment.url] : [];
  }

  if (sceneKind !== "generic") {
    return [];
  }

  const urls = new Set<string>();
  for (const fixture of venue.fixtures) {
    const asset = VENUE_FURNITURE[fixture.kind];
    if (asset) {
      urls.add(asset.url);
    }
  }
  return [...urls];
}

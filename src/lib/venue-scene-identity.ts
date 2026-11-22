import type { LocationVenueDesign } from "@/lib/location-venue-designs";
import type { VenueSceneKind } from "@/lib/venue-scene-resolver";

type VenueSceneIdentityInput = {
  slug: string;
  locationId?: string | undefined;
  shopSlug?: string | null | undefined;
  sceneKind: VenueSceneKind;
  venue: LocationVenueDesign;
};

export function getVenueSceneIdentity({
  slug,
  locationId,
  shopSlug,
  sceneKind,
  venue,
}: VenueSceneIdentityInput): string {
  return JSON.stringify([
    slug,
    locationId ?? null,
    shopSlug ?? null,
    sceneKind,
    venue.bankInterior ?? null,
    venue.civicService ?? null,
    venue.foodInterior ?? null,
    sceneKind === "environment" ? venue.environment?.url ?? null : null,
  ]);
}

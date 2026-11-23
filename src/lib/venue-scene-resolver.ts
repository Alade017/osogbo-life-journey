import type { LocationVenueDesign } from "@/lib/location-venue-designs";

export type VenueSceneKind =
  | "mall"
  | "clinic"
  | "worship"
  | "campus"
  | "civic"
  | "bank"
  | "transport"
  | "healthcare"
  | "market"
  | "workplace"
  | "retail"
  | "food"
  | "environment"
  | "generic";

export function resolveVenueScene(
  slug: string,
  venue: LocationVenueDesign,
  locationId?: string,
): VenueSceneKind {
  if (slug === "osun-mall" && locationId) return "mall";
  if (venue.scene === "clinic") return "clinic";
  if (venue.scene === "worship") return "worship";
  if (venue.scene === "campus") return "campus";
  if (venue.civicService) return "civic";
  if (venue.bankInterior) return "bank";
  if (venue.transportPark) return "transport";
  if (venue.scene === "healthcare") return "healthcare";
  if (venue.scene === "market") return "market";
  if (venue.scene === "workplace") return "workplace";
  if (venue.retailInterior) return "retail";
  if (venue.foodInterior) return "food";
  if (venue.environment) return "environment";
  return "generic";
}

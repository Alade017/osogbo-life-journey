import town from "@/data/osogbo-town.json";

export type DistrictSpotlight = {
  id: string;
  name: string;
  description: string;
  landmarks: string[];
};

/**
 * The fictional district that holds a location, with the landmarks in it.
 * Returns null when the location is not a landmark in the town data.
 */
export function districtSpotlight(
  locationSlug: string | null | undefined,
): DistrictSpotlight | null {
  if (!locationSlug) return null;
  const landmark = town.landmarks.find((place) => place.locationSlug === locationSlug);
  if (!landmark) return null;
  const district = town.districts.find((item) => item.id === landmark.districtId);
  if (!district) return null;
  return {
    id: district.id,
    name: district.name,
    description: district.description,
    landmarks: town.landmarks
      .filter((place) => place.districtId === district.id)
      .map((place) => place.label),
  };
}

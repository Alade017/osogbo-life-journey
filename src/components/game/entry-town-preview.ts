import town from "@/data/osogbo-town.json";

export type PreviewLandmark = {
  id: string;
  label: string;
  category: string;
  slug: string;
  grid: { x: number; z: number };
  districtId: string;
};

/** Landmarks to show on the landing town. Null shows every landmark in the town. */
export function previewLandmarks(activeSlugs: ReadonlySet<string> | null): PreviewLandmark[] {
  return town.landmarks
    .filter((place) => !activeSlugs || activeSlugs.has(place.locationSlug))
    .map((place) => ({
      id: place.id,
      label: place.label,
      category: place.category,
      slug: place.locationSlug,
      grid: { x: place.grid.x, z: place.grid.z },
      districtId: place.districtId,
    }));
}

/** The town landmark for a location slug, or null when the town has none for it. */
export function findLandmarkForSlug(slug: string | null | undefined): PreviewLandmark | null {
  if (!slug) return null;
  return previewLandmarks(null).find((place) => place.slug === slug) ?? null;
}

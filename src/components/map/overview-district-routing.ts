import catalog from "@/data/osogbo-district-catalog.json";
import layout from "@/data/osogbo-overview-layout.json";
import town from "@/data/osogbo-town.json";
import type { DistrictTheme, MapDistrict, MapLandmark, Traffic } from "./map-types";

const places = new Map(catalog.places.map(place => [place.id, place]));
const districts = new Set(catalog.districts.map(district => district.id));
const legacyDistricts = new Map(catalog.districts.flatMap(district =>
  district.legacyDistrictIds.map(id => [id, district.id] as const),
));
const anchors = new Map(layout.places.map(place => [place.placeId, place]));
const themes: Record<string, DistrictTheme> = {
  "commercial-transit": "transport", "royal-heritage": "market",
  "traditional-residential": "residential", "modern-commercial": "market",
  "mixed-transit": "transport", "automotive-transit": "transport",
  administrative: "school", "industrial-education": "school",
  "cultural-nature": "leisure", "residential-education": "residential",
};

/** Explicit landmark assignments take priority over legacy district grouping. */
export function overviewDistrictId(id: string, landmarkId?: string): string | undefined {
  if (landmarkId) {
    const place = places.get(landmarkId);
    if (place) return place.districtId;
    if (catalog.excludedOverviewPlaces.some(item => item.id === landmarkId)) return undefined;
  }
  return districts.has(id) ? id : legacyDistricts.get(id);
}

export function overviewPlacePosition(id: string) {
  const anchor = anchors.get(id);
  if (anchor) return anchor.position;
  const place = places.get(id);
  return place ? layout.districts.find(d => d.districtId === place.districtId)?.center : undefined;
}

export function overviewHasPlace(id: string): boolean {
  return places.has(id);
}

/** Keep legacy action coordinates and IDs for gameplay; overview geometry is separate. */
export const overviewDistricts: MapDistrict[] = catalog.districts.map(district => {
  const area = layout.districts.find(item => item.districtId === district.id);
  if (!area) throw new Error("Missing overview district layout: " + district.id);
  const { x, z, width, depth } = area.bounds;
  return {
    id: district.id, name: district.name,
    theme: themes[district.identity] ?? "residential",
    traffic: district.density as Traffic,
    description: district.architecture,
    shape: [[x,z],[x+width,z],[x+width,z+depth],[x,z+depth]],
    landmarks: town.landmarks.filter(place => places.get(place.id)?.districtId === district.id)
      .map(place => ({ ...place, districtId: district.id }) as MapLandmark),
  };
});

export const overviewLandmarks = overviewDistricts.flatMap(district =>
  district.landmarks.map(place => ({ ...place, district })),
);

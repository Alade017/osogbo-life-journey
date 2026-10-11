import type { FeatureCollection, Point } from "geojson";
import type { CityLocationData } from "@/lib/location-service";
import { getLocationCategory } from "@/lib/location-service";

export type LocationFeatureProperties = {
  id: string;
  name: string;
  category: string;
  markerImage: string;
};

export type MappableLocation = CityLocationData & {
  latitude: number;
  longitude: number;
};

export function hasValidCoordinates(location: CityLocationData): location is MappableLocation {
  return (
    typeof location.latitude === "number" &&
    Number.isFinite(location.latitude) &&
    location.latitude >= -90 &&
    location.latitude <= 90 &&
    typeof location.longitude === "number" &&
    Number.isFinite(location.longitude) &&
    location.longitude >= -180 &&
    location.longitude <= 180
  );
}

export function locationsToFeatureCollection(
  locations: readonly MappableLocation[],
): FeatureCollection<Point, LocationFeatureProperties> {
  return {
    type: "FeatureCollection",
    features: locations.map((location) => {
      const category = getLocationCategory(location);
      return {
        type: "Feature",
        id: location.id,
        geometry: {
          type: "Point",
          coordinates: [location.longitude, location.latitude],
        },
        properties: {
          id: location.id,
          name: location.name,
          category,
          markerImage: `location-marker-${category}`,
        },
      };
    }),
  };
}

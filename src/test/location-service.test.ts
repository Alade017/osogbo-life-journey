import { describe, expect, it } from "vitest";
import { normalizeCityLocation } from "@/lib/location-service";
import {
  hasValidCoordinates,
  locationsToFeatureCollection,
  type MappableLocation,
} from "@/lib/location-map-model";
import type { MapLocation } from "@/lib/game";

function location(overrides: Partial<MapLocation> = {}): MapLocation {
  return {
    id: "location-1",
    name: "Neighbourhood Park",
    slug: "neighbourhood-park",
    type: "custom",
    description: "A local green space.",
    latitude: null,
    longitude: null,
    icon: "map-pin",
    image_url: null,
    is_active: true,
    interaction_radius_m: 50,
    level_required: 0,
    metadata: {},
    ...overrides,
  };
}

describe("city location model", () => {
  it("normalizes legacy location types to game categories", () => {
    expect(normalizeCityLocation(location({ type: "residential" })).category).toBe("residential");
    expect(normalizeCityLocation(location({ type: "transport" })).category).toBe("transport");
    expect(normalizeCityLocation(location({ type: "landmark" })).category).toBe("landmark");
    expect(normalizeCityLocation(location({ type: "shop" })).category).toBe("shop");
    expect(normalizeCityLocation(location({ type: "university" })).category).toBe("university");
    expect(normalizeCityLocation(location({ type: "workplace" })).category).toBe("workplace");
  });

  it("uses metadata for extended categories, actions and hours", () => {
    const cityLocation = normalizeCityLocation(
      location({
        metadata: {
          category: "park",
          available_actions: [
            { id: "walk", label: "Take a walk", status: "coming_soon" },
            "View park details",
          ],
          opening_hours: { weekdays: "06:00–18:00", weekends: "07:00–19:00" },
        },
      }),
    );

    expect(cityLocation.category).toBe("park");
    expect(cityLocation.availableActions).toEqual([
      { id: "walk", label: "Take a walk", status: "coming_soon" },
      { id: "View park details", label: "View park details", status: "coming_soon" },
    ]);
    expect(cityLocation.openingHours).toBe("Weekdays: 06:00–18:00 · Weekends: 07:00–19:00");
  });

  it("keeps active status from the Supabase record", () => {
    expect(normalizeCityLocation(location()).status).toBe("active");
    expect(normalizeCityLocation(location({ is_active: false })).status).toBe("inactive");
  });

  it("converts valid latitude and longitude into MapLibre longitude-latitude features", () => {
    const mappedLocation = normalizeCityLocation(
      location({ type: "market", latitude: 7.7677, longitude: 4.556 }),
    );
    expect(hasValidCoordinates(mappedLocation)).toBe(true);
    expect(locationsToFeatureCollection([mappedLocation as MappableLocation])).toMatchObject({
      type: "FeatureCollection",
      features: [
        {
          id: "location-1",
          geometry: { type: "Point", coordinates: [4.556, 7.7677] },
          properties: {
            id: "location-1",
            category: "market",
            markerImage: "location-marker-market",
          },
        },
      ],
    });
  });

  it("rejects missing, non-finite, and out-of-range coordinates", () => {
    expect(hasValidCoordinates(normalizeCityLocation(location()))).toBe(false);
    expect(
      hasValidCoordinates(
        normalizeCityLocation(location({ latitude: Number.NaN, longitude: 4.5 })),
      ),
    ).toBe(false);
    expect(
      hasValidCoordinates(normalizeCityLocation(location({ latitude: 91, longitude: 4.5 }))),
    ).toBe(false);
    expect(
      hasValidCoordinates(normalizeCityLocation(location({ latitude: 7.7, longitude: 181 }))),
    ).toBe(false);
  });
});

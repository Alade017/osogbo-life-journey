import { expect, it } from "vitest";
import { TRAVEL_MODES } from "@/lib/transport-service";
import { transportMapHref, transportPreference } from "@/lib/transport-park";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";

it("round-trips registered transport preferences without booking a trip", () => {
  for (const mode of TRAVEL_MODES) {
    expect(transportPreference(transportMapHref(mode))).toBe(mode);
    expect(transportPreference(transportMapHref(mode) + "#map")).toBe(mode);
  }
  expect(transportMapHref(null)).toBe("/map");
});
it.each(["/map", "/map?transport=unknown", "/map?transport=korope", "/map?transport=", "/map#transport=car"])("ignores invalid preferences: %s", href => {
  expect(transportPreference(href)).toBeNull();
});
it("uses the existing transit fixture IDs and preserves unrelated venue renderers", () => {
  const venue = getLocationVenueDesign("transit-park", "Transit Park");
  expect(venue.transportPark).toBe(true);
  expect(venue.sceneBounds).toEqual({ width: 12, depth: 9 });
  expect(venue.fixtures.map(f => f.id)).toEqual(["transit-bench", "transit-board", "transit-counter"]);
  expect(getLocationVenueDesign("town-market", "Market").transportPark).toBeUndefined();
});

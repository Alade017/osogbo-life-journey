import { describe, expect, it } from "vitest";
import townData from "@/data/osogbo-town.json";
import {
  getLocationVenueDesign,
  hasAuthoritativeLocationArrival,
  hasLocationVenueDesign,
} from "@/lib/location-venue-designs";

describe("location venue designs", () => {
  it("provides a distinct set of interactive fixtures for every current map location", () => {
    const designs = townData.landmarks.map((landmark) =>
      getLocationVenueDesign(landmark.locationSlug, landmark.label),
    );

    expect(designs).toHaveLength(townData.landmarks.length);
    expect(new Set(designs.map((design) => design.name)).size).toBe(designs.length);
    for (const design of designs) {
      expect(design.fixtures.length).toBeGreaterThanOrEqual(3);
      expect(new Set(design.fixtures.map((fixture) => fixture.id)).size).toBe(
        design.fixtures.length,
      );
      expect(design.fixtures.every((fixture) => fixture.detail.length > 0)).toBe(true);
    }
  });

  it("uses a neutral local design for newly returned locations without inventing state actions", () => {
    const design = getLocationVenueDesign("new-location", "New Location");
    expect(design.name).toBe("New Location");
    expect(design.fixtures.map((fixture) => fixture.kind)).toContain("table");
    expect(hasLocationVenueDesign("new-location")).toBe(false);
    expect(hasLocationVenueDesign("osun-mall")).toBe(true);
  });

  it("only confirms arrival when the authoritative current location matches the destination", () => {
    expect(hasAuthoritativeLocationArrival("location-1", "location-1")).toBe(true);
    expect(hasAuthoritativeLocationArrival("location-1", "location-2")).toBe(false);
    expect(hasAuthoritativeLocationArrival(null, "location-1")).toBe(false);
    expect(hasAuthoritativeLocationArrival(undefined, undefined)).toBe(false);
  });
});

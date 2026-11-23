import { describe, expect, it } from "vitest";
import {
  getLocationVenueDesign,
  type VenueFixtureKind,
  type VenueFixture,
} from "@/lib/location-venue-designs";
import { getVenueAssetUrls } from "@/lib/venue-scene-assets";
import { VENUE_FURNITURE } from "@/lib/venue-furniture-assets";

const base = getLocationVenueDesign("unknown-location", "Test Venue");

function fixture(kind: VenueFixtureKind): VenueFixture {
  return { id: kind, label: kind, detail: "", kind, position: [0, 0] };
}

describe("getVenueAssetUrls", () => {
  it("deduplicates shared furniture URLs", () => {
    const urls = getVenueAssetUrls("generic", {
      ...base,
      fixtures: [fixture("counter"), fixture("shelf"), fixture("seat"), fixture("bench")],
    });
    expect(urls).toEqual([VENUE_FURNITURE.counter?.url, VENUE_FURNITURE.seat?.url]);
  });

  it("skips unsupported fixtures", () => {
    expect(
      getVenueAssetUrls("generic", {
        ...base,
        fixtures: [fixture("planter")],
      }),
    ).toEqual([]);
  });

  it("selects only the configured environment", () => {
    expect(
      getVenueAssetUrls("environment", {
        ...base,
        environment: { url: "/test.glb" },
        fixtures: [fixture("counter")],
      }),
    ).toEqual(["/test.glb"]);
  });

  it("skips missing environment assets", () => {
    expect(getVenueAssetUrls("environment", base)).toEqual([]);
  });

  it("skips generic assets for specialized scenes", () => {
    expect(
      getVenueAssetUrls("clinic", {
        ...base,
        fixtures: [fixture("counter")],
      }),
    ).toEqual([]);
  });
});

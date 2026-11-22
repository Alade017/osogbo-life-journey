import { describe, expect, it } from "vitest";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import { getVenueSceneIdentity } from "@/lib/venue-scene-identity";

describe("venue scene identity", () => {
  const base = {
    slug: "unknown-location",
    locationId: "location-a",
    sceneKind: "generic" as const,
    venue: getLocationVenueDesign("unknown-location", "Test Venue"),
  };

  it("distinguishes location slugs", () => {
    expect(getVenueSceneIdentity({ ...base, slug: "different-location" }))
      .not.toBe(getVenueSceneIdentity(base));
  });

  it("distinguishes server location IDs", () => {
    expect(getVenueSceneIdentity({ ...base, locationId: "location-b" }))
      .not.toBe(getVenueSceneIdentity(base));
  });

  it("distinguishes shops within a location", () => {
    expect(getVenueSceneIdentity({ ...base, shopSlug: "shop-a" }))
      .not.toBe(getVenueSceneIdentity({ ...base, shopSlug: "shop-b" }));
  });

  it("normalizes absent shop identity", () => {
    expect(getVenueSceneIdentity({ ...base, shopSlug: null }))
      .toBe(getVenueSceneIdentity(base));
  });

  it("distinguishes scene kinds", () => {
    expect(getVenueSceneIdentity({ ...base, sceneKind: "market" }))
      .not.toBe(getVenueSceneIdentity(base));
  });

  it("distinguishes environment models", () => {
    const environment = (url: string) =>
      getVenueSceneIdentity({
        ...base,
        sceneKind: "environment",
        venue: { ...base.venue, environment: { url } },
      });
    expect(environment("/first.glb")).not.toBe(environment("/second.glb"));
  });

  it("distinguishes civic interior variants", () => {
    const civic = (variant: "police" | "civic") =>
      getVenueSceneIdentity({
        ...base,
        sceneKind: "civic",
        venue: { ...base.venue, civicService: variant },
      });
    expect(civic("police")).not.toBe(civic("civic"));
  });

  it("preserves identity when presentation changes", () => {
    expect(getVenueSceneIdentity({
      ...base,
      venue: {
        ...base.venue,
        name: "Updated venue",
        description: "Updated description",
        accentColor: "#ffffff",
      },
    })).toBe(getVenueSceneIdentity(base));
  });

  it("preserves identity when fixtures change", () => {
    expect(getVenueSceneIdentity({
      ...base,
      venue: { ...base.venue, fixtures: [] },
    })).toBe(getVenueSceneIdentity(base));
  });
});

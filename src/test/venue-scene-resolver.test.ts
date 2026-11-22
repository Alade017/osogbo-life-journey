import { describe, expect, it } from "vitest";
import { getLocationVenueDesign, type LocationVenueDesign } from "@/lib/location-venue-designs";
import { resolveVenueScene, type VenueSceneKind } from "@/lib/venue-scene-resolver";

const base = getLocationVenueDesign("unknown-location", "Test Venue");
const cases: [Partial<LocationVenueDesign>, VenueSceneKind][] = [
  [{ scene: "clinic" }, "clinic"],
  [{ scene: "worship" }, "worship"],
  [{ scene: "campus" }, "campus"],
  [{ civicService: "police" }, "civic"],
  [{ transportPark: true }, "transport"],
  [{ scene: "healthcare" }, "healthcare"],
  [{ scene: "market" }, "market"],
  [{ scene: "workplace" }, "workplace"],
  [{ retailInterior: true }, "retail"],
  [{ foodInterior: "buka" }, "food"],
  [{ foodInterior: "courtyard" }, "food"],
  [{ environment: { url: "/test.glb" } }, "environment"],
  [{}, "generic"],
];

describe("resolveVenueScene", () => {
  it.each(cases)("resolves %j to %s", (design, expected) => {
    expect(resolveVenueScene("test-venue", { ...base, ...design })).toBe(expected);
  });

  it("requires a location ID for the mall", () => {
    expect(resolveVenueScene("osun-mall", base, "location-1")).toBe("mall");
    expect(resolveVenueScene("osun-mall", base)).toBe("generic");
  });

  it("preserves bank selection", () => {
    const bank = getLocationVenueDesign("cedar-bank", "Cedar Bank");
    expect(resolveVenueScene("cedar-bank", bank)).toBe("bank");
  });

  it("preserves specialized scene priority", () => {
    expect(resolveVenueScene("test-venue", {
      ...base, scene: "clinic", civicService: "police",
      retailInterior: true, environment: { url: "/test.glb" },
    })).toBe("clinic");
  });

  it("prioritizes built interiors over GLTF environments", () => {
    expect(resolveVenueScene("test-venue", {
      ...base, retailInterior: true, environment: { url: "/test.glb" },
    })).toBe("retail");
  });

  it("preserves bank priority over transport", () => {
    expect(resolveVenueScene("test-venue", {
      ...base, bankInterior: "teller-hall", transportPark: true,
    })).toBe("bank");
  });
});

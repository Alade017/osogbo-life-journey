import { describe, expect, it } from "vitest";
import { districtSpotlight } from "@/lib/district-spotlight";

describe("district spotlight", () => {
  it("describes the district that holds a location, with its landmarks", () => {
    const spotlight = districtSpotlight("town-market");
    expect(spotlight).not.toBeNull();
    expect(spotlight?.id).toBe("market-quarter");
    expect(spotlight?.landmarks.length).toBeGreaterThan(0);
  });

  it("returns nothing for a location that is not a landmark", () => {
    expect(districtSpotlight("not-a-real-place")).toBeNull();
    expect(districtSpotlight(null)).toBeNull();
  });
});

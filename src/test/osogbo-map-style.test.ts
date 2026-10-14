import { describe, expect, it } from "vitest";
import {
  getOsogboMapStyleUrl,
  isExcludedBaseMapLabel,
  shouldHideBaseMapLayer,
} from "@/lib/osogbo-map-style";

describe("Osogbo map styles", () => {
  it("uses a keyless vector style by default", () => {
    expect(getOsogboMapStyleUrl()).toBe("https://tiles.openfreemap.org/styles/liberty");
  });

  it("keeps real buildings, businesses and address labels off the fictional destination map", () => {
    expect(shouldHideBaseMapLayer("building-fill", "building")).toBe(true);
    expect(shouldHideBaseMapLayer("poi-label", "poi")).toBe(true);
    expect(shouldHideBaseMapLayer("housenumber-label", "housenumber")).toBe(true);
    expect(shouldHideBaseMapLayer("road-primary", "transportation")).toBe(false);
  });

  it("excludes religious landmarks from basemap labels", () => {
    expect(isExcludedBaseMapLabel("Osun-Osogbo Sacred Grove")).toBe(true);
    expect(isExcludedBaseMapLabel("Central Mosque")).toBe(true);
    expect(isExcludedBaseMapLabel("Osogbo River")).toBe(false);
  });
});

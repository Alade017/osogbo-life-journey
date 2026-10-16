import { describe, expect, it } from "vitest";
import {
  buildOsogboMapStyleUrls,
  getOsogboMapStyleUrl,
  isExcludedBaseMapLabel,
  shouldHideBaseMapLayer,
} from "@/lib/osogbo-map-style";

describe("Osogbo map styles", () => {
  it("uses a keyless vector style by default", () => {
    expect(getOsogboMapStyleUrl()).toBe("https://tiles.openfreemap.org/styles/liberty");
  });

  it("keeps primary and optional secondary providers in order without duplicates", () => {
    expect(
      buildOsogboMapStyleUrls({
        VITE_OSOGBO_MAP_STYLE_URL: "https://primary.example/style.json",
        VITE_OSOGBO_MAP_FALLBACK_STYLE_URL: "https://secondary.example/style.json",
      }),
    ).toEqual(["https://primary.example/style.json", "https://secondary.example/style.json"]);
    expect(
      buildOsogboMapStyleUrls({
        VITE_OSOGBO_MAP_STYLE_URL: "https://same.example/style.json",
        VITE_OSOGBO_MAP_FALLBACK_STYLE_URL: "https://same.example/style.json",
      }),
    ).toEqual(["https://same.example/style.json"]);
  });

  it("only attaches the publishable key to Stadia style URLs", () => {
    expect(
      buildOsogboMapStyleUrls({
        VITE_OSOGBO_MAP_STYLE_URL: "https://tiles.stadiamaps.com/styles/alidade_smooth.json",
        VITE_STADIA_MAPS_API_KEY: "publishable-test-key",
      })[0],
    ).toContain("api_key=publishable-test-key");
    expect(
      buildOsogboMapStyleUrls({
        VITE_OSOGBO_MAP_STYLE_URL: "https://primary.example/style.json",
        VITE_STADIA_MAPS_API_KEY: "publishable-test-key",
      })[0],
    ).toBe("https://primary.example/style.json");
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

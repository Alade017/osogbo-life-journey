import { describe, expect, it } from "vitest";
import catalog from "@/data/osogbo-district-catalog.json";
import { overviewDistrictId, overviewDistricts, overviewHasPlace, overviewLandmarks, overviewPlacePosition } from "@/components/map/overview-district-routing";

describe("replacement overview routing", () => {
  it("exposes exactly ten canonical districts", () => {
    expect(overviewDistricts).toHaveLength(10);
    expect(new Set(overviewDistricts.map(d => d.id)).size).toBe(10);
    expect(overviewDistricts.some(d => d.id === "oke-baale")).toBe(true);
    expect(overviewDistrictId("aleku-wodo")).toBeUndefined();
  });
  it("honors individual venue assignments over legacy district grouping", () => {
    expect(overviewDistrictId("learning-quarter", "osun-mall")).toBe("ogo-oluwa");
    expect(overviewDistrictId("ataoja", "ataoja-palace")).toBe("oja-oba");
    expect(overviewDistrictId("ogo-oluwa", "osogbo-township-stadium")).toBe("ota-efun-testing-ground");
  });
  it("retains all catalog gameplay IDs without duplicates", () => {
    expect(overviewLandmarks.map(p => p.id).sort()).toEqual(catalog.places.map(p => p.id).sort());
    expect(new Set(overviewLandmarks.map(p => p.id)).size).toBe(overviewLandmarks.length);
  });
  it("keeps excluded locations, streets and reserved landmarks out of playable destinations", () => {
    for (const id of ["aleku-wodo-road-network", "baruwa-street", "olaiya-flyover-bridge"]) {
      expect(overviewHasPlace(id)).toBe(false);
    }
    expect(overviewPlacePosition("baruwa-street")).toBeUndefined();
    expect(overviewDistrictId("aleku-wodo", "aleku-wodo-road-network")).toBeUndefined();
  });
  it("provides overview focus positions for every retained venue", () => {
    for (const place of catalog.places) {
      const p = overviewPlacePosition(place.id);
      expect(p).toBeDefined();
      expect(Number.isFinite(p?.x)).toBe(true);
      expect(Number.isFinite(p?.z)).toBe(true);
    }
  });
});

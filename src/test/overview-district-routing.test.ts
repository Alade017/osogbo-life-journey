import { describe, expect, it } from "vitest";
import catalog from "@/data/osogbo-district-catalog.json";
import layout from "@/data/osogbo-overview-layout.json";
import {
  overviewDistrictId,
  overviewDistricts,
  overviewHasPlace,
  overviewLandmarks,
  overviewPlacePosition,
} from "@/components/map/overview-district-routing";

describe("replacement overview routing", () => {
  it("exposes exactly ten canonical districts", () => {
    expect(overviewDistricts).toHaveLength(10);
    expect(new Set(overviewDistricts.map((d) => d.id)).size).toBe(10);
    expect(overviewDistricts.some((d) => d.id === "oke-baale")).toBe(true);
    expect(overviewDistrictId("aleku-wodo")).toBeUndefined();
  });
  it("honors individual venue assignments over legacy district grouping", () => {
    expect(overviewDistrictId("learning-quarter", "osun-mall")).toBe("ogo-oluwa");
    expect(overviewDistrictId("ataoja", "ataoja-palace")).toBe("oja-oba");
    expect(overviewDistrictId("ogo-oluwa", "osogbo-township-stadium")).toBe(
      "ota-efun-testing-ground",
    );
  });
  it("retains all catalog gameplay IDs without duplicates", () => {
    expect(overviewLandmarks.map((p) => p.id).sort()).toEqual(
      catalog.places.map((p) => p.id).sort(),
    );
    expect(new Set(overviewLandmarks.map((p) => p.id)).size).toBe(overviewLandmarks.length);
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

describe("replacement overview layout invariants", () => {
  const entries = [...layout.places, ...layout.residentialParcels, ...layout.commercialParcels];
  it("keeps footprints within their assigned districts", () => {
    for (const entry of entries) {
      const district = layout.districts.find((d) => d.districtId === entry.districtId);
      expect(district).toBeDefined();
      const b = district!.bounds;
      const { x, z } = entry.position;
      const { width, depth } = entry.footprint;
      expect(width).toBeGreaterThan(0);
      expect(depth).toBeGreaterThan(0);
      expect(x - width / 2).toBeGreaterThanOrEqual(b.x);
      expect(x + width / 2).toBeLessThanOrEqual(b.x + b.width);
      expect(z - depth / 2).toBeGreaterThanOrEqual(b.z);
      expect(z + depth / 2).toBeLessThanOrEqual(b.z + b.depth);
    }
  });
  it("does not overlap authored footprints", () => {
    for (const [i, a] of entries.entries()) {
      for (const b of entries.slice(i + 1)) {
        const overlaps =
          Math.abs(a.position.x - b.position.x) < (a.footprint.width + b.footprint.width) / 2 &&
          Math.abs(a.position.z - b.position.z) < (a.footprint.depth + b.footprint.depth) / 2;
        expect(overlaps).toBe(false);
      }
    }
  });
  it("accounts for every existing venue exactly once in overview or neighborhood-only data", () => {
    const represented = [
      ...layout.places.filter((p) => p.status === "existing-reference"),
      ...layout.sceneOnlyPlaces,
    ];
    expect(represented.map((p) => p.placeId).sort()).toEqual(
      catalog.places.map((p) => p.id).sort(),
    );
  });
  it("uses unique valid housing listing anchors", () => {
    const anchors = layout.housingListingAnchors;
    expect(new Set(anchors.map((a) => a.houseTypeId)).size).toBe(anchors.length);
    expect(new Set(anchors.map((a) => a.parcelId)).size).toBe(anchors.length);
    for (const anchor of anchors)
      expect(layout.residentialParcels.some((p) => p.id === anchor.parcelId)).toBe(true);
  });
});

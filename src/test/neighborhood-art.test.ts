import { describe, expect, it } from "vitest";
import {
  NEIGHBORHOOD_ART_ASSETS,
  NEIGHBORHOOD_BUILDING_ART,
  NEIGHBORHOOD_PROP_ART,
  neighborhoodPropArtKind,
} from "@/game/neighborhood-art";

describe("neighborhood production art manifest", () => {
  it("defines a distinct original asset for each pilot building family", () => {
    expect(Object.keys(NEIGHBORHOOD_BUILDING_ART)).toEqual(["compound", "shop", "kiosk"]);
    expect(new Set(Object.values(NEIGHBORHOOD_BUILDING_ART).map((asset) => asset.key)).size).toBe(3);
  });

  it("covers the environment props used by the playable neighborhood", () => {
    expect(Object.keys(NEIGHBORHOOD_PROP_ART)).toEqual([
      "tree",
      "streetlight",
      "bench",
      "bin",
      "sign",
    ]);
    expect(neighborhoodPropArtKind("landmark")).toBe("sign");
    expect(neighborhoodPropArtKind("streetlight")).toBe("streetlight");
    expect(neighborhoodPropArtKind("compound")).toBeNull();
  });

  it("keeps asset dimensions, anchors, paths and keys valid", () => {
    expect(new Set(NEIGHBORHOOD_ART_ASSETS.map((asset) => asset.key)).size).toBe(
      NEIGHBORHOOD_ART_ASSETS.length,
    );
    for (const asset of NEIGHBORHOOD_ART_ASSETS) {
      expect(asset.path).toMatch(/^\/assets\/world\/neighborhood\/.+\.svg$/);
      expect(asset.width).toBeGreaterThan(0);
      expect(asset.height).toBeGreaterThan(0);
      expect(asset.originX).toBeGreaterThanOrEqual(0);
      expect(asset.originX).toBeLessThanOrEqual(1);
      expect(asset.originY).toBeGreaterThanOrEqual(0);
      expect(asset.originY).toBeLessThanOrEqual(1);
      expect(asset.scale).toBeGreaterThan(0);
    }
  });
});

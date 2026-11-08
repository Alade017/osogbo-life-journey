import { describe, expect, it } from "vitest";
import {
  NEIGHBORHOOD_BUILDING_PROFILES,
  NEIGHBORHOOD_PROP_PROFILES,
  neighborhoodPropKind,
  neighborhoodBuildingKind,
} from "@/game/neighborhood-art";

describe("data-driven Phaser neighborhood art profiles", () => {
  it("provides a complete building profile for every supported building family", () => {
    expect(Object.keys(NEIGHBORHOOD_BUILDING_PROFILES)).toEqual([
      "compound",
      "shop",
      "kiosk",
      "market",
      "work",
    ]);
    for (const profile of Object.values(NEIGHBORHOOD_BUILDING_PROFILES)) {
      expect(profile.wallColors).toHaveLength(2);
      expect(profile.wallHeightRatio).toBeGreaterThan(0);
      expect(profile.wallHeightRatio).toBeLessThanOrEqual(1);
      expect(profile.roofOverhangRatio).toBeGreaterThanOrEqual(0);
      expect(profile.roofRibSpacingRatio).toBeGreaterThan(0);
      expect(profile.windowCount).toBeGreaterThan(0);
      expect(typeof profile.windowGrilles).toBe("boolean");
    }
  });

  it("maps world object semantics to distinct reusable architectural families", () => {
    expect(neighborhoodBuildingKind("home")).toBe("compound");
    expect(neighborhoodBuildingKind("market")).toBe("market");
    expect(neighborhoodBuildingKind("work")).toBe("work");
    expect(neighborhoodBuildingKind("npc")).toBeNull();
    expect(NEIGHBORHOOD_BUILDING_PROFILES.market).not.toEqual(NEIGHBORHOOD_BUILDING_PROFILES.shop);
    expect(NEIGHBORHOOD_BUILDING_PROFILES.work).not.toEqual(NEIGHBORHOOD_BUILDING_PROFILES.shop);
    expect(NEIGHBORHOOD_BUILDING_PROFILES.compound.windowGrilles).toBe(true);
    expect(NEIGHBORHOOD_BUILDING_PROFILES.market.windowGrilles).toBe(true);
    expect(NEIGHBORHOOD_BUILDING_PROFILES.work.windowGrilles).toBe(false);
  });

  it("provides a procedural shape profile for every supported environment prop", () => {
    expect(Object.keys(NEIGHBORHOOD_PROP_PROFILES)).toEqual([
      "tree",
      "streetlight",
      "bench",
      "bin",
      "sign",
    ]);
    for (const profile of Object.values(NEIGHBORHOOD_PROP_PROFILES)) {
      expect(profile.widthRatio).toBeGreaterThan(0);
      expect(profile.heightRatio).toBeGreaterThan(0);
      expect(profile.colors.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("normalizes landmark and sign obstacles without inventing unknown art", () => {
    expect(neighborhoodPropKind("landmark")).toBe("sign");
    expect(neighborhoodPropKind("sign")).toBe("sign");
    expect(neighborhoodPropKind("tree")).toBe("tree");
    expect(neighborhoodPropKind("unknown")).toBeNull();
    expect(neighborhoodPropKind("compound")).toBeNull();
  });
});

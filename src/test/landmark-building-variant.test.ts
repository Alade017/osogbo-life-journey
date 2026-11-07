import { describe, expect, it } from "vitest";
import town from "@/data/osogbo-town.json";
import { getLandmarkBuildingVariant } from "@/components/map/landmark-building-variant";

const SUPPORTED_VARIANTS = new Set([
  "residential",
  "market",
  "bank",
  "civic",
  "health",
  "school",
  "church",
  "mosque",
  "worship",
  "transit",
  "sport",
  "club",
  "services",
]);

describe("landmark building variants", () => {
  it("normalizes shared map building types to supported architectural variants", () => {
    expect(getLandmarkBuildingVariant("food")).toBe("market");
    expect(getLandmarkBuildingVariant("public-service")).toBe("civic");
    expect(getLandmarkBuildingVariant("clinic")).toBe("health");
    expect(getLandmarkBuildingVariant("transport")).toBe("transit");
  });

  it("uses distinct chapel and mosque silhouettes for the town's worship landmarks", () => {
    const chapel = town.grid.buildings.find((building) => building.placeId === "garden-chapel");
    const mosque = town.grid.buildings.find((building) => building.placeId === "mosque-square");

    expect(chapel?.buildingType).toBe("church");
    expect(mosque?.buildingType).toBe("mosque");
    expect(getLandmarkBuildingVariant(chapel?.buildingType)).toBe("church");
    expect(getLandmarkBuildingVariant(mosque?.buildingType)).toBe("mosque");
  });

  it("provides a safe residential fallback for unknown building types", () => {
    expect(getLandmarkBuildingVariant("future-building-type")).toBe("residential");
    expect(getLandmarkBuildingVariant(undefined)).toBe("residential");
  });

  it("maps every town building to a supported WorldHouse variant", () => {
    for (const building of town.grid.buildings) {
      expect(SUPPORTED_VARIANTS.has(getLandmarkBuildingVariant(building.buildingType))).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import town from "@/data/osogbo-town.json";
import { getLandmarkBuildingVariant } from "@/components/map/landmark-building-variant";
import { DISTRICT_ARCHITECTURE_VARIANTS, getDistrictArchitecture } from "@/game/district-architecture";

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

  it("assigns distinct rooflines, frontages and residential window details", () => {
    expect(getDistrictArchitecture("residential")).toMatchObject({ roof: "pitched", frontage: "veranda", windowGrilles: true });
    expect(getDistrictArchitecture("market")).toMatchObject({ roof: "flat", frontage: "awning" });
    expect(getDistrictArchitecture("bank")).toMatchObject({ roof: "parapet", frontage: "portico" });
    expect(getDistrictArchitecture("health")).toMatchObject({ frontage: "recessed" });
    expect(getDistrictArchitecture("transit")).toMatchObject({ frontage: "canopy" });
    expect(new Set(DISTRICT_ARCHITECTURE_VARIANTS).size).toBe(SUPPORTED_VARIANTS.size);
    for (const variant of SUPPORTED_VARIANTS) {
      expect(DISTRICT_ARCHITECTURE_VARIANTS).toContain(variant);
      expect(getDistrictArchitecture(variant).accent).toBeTruthy();
    }
  });

  it("provides a safe residential fallback for unknown building types", () => {
    expect(getDistrictArchitecture("unknown")).toEqual(getDistrictArchitecture("residential"));
    expect(getLandmarkBuildingVariant("future-building-type")).toBe("residential");
    expect(getLandmarkBuildingVariant(undefined)).toBe("residential");
  });

  it("maps every town building to a supported WorldHouse variant", () => {
    for (const building of town.grid.buildings) {
      expect(SUPPORTED_VARIANTS.has(getLandmarkBuildingVariant(building.buildingType))).toBe(true);
    }
  });
});

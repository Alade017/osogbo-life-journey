import { describe, expect, it } from "vitest";
import {
  districtArchitectureVariantForCategory,
  getDistrictArchitecture,
} from "@/game/district-architecture";

describe("world-category building architecture", () => {
  it.each([
    ["residential", "residential"],
    ["commercial", "market"],
    ["work_industrial", "services"],
    ["education", "school"],
    ["health", "health"],
    ["transport", "transit"],
    ["government", "civic"],
    ["recreation", "sport"],
    ["water_nature", "services"],
  ])("maps %s to the %s architecture family", (category, variant) => {
    expect(districtArchitectureVariantForCategory(category)).toBe(variant);
    expect(getDistrictArchitecture(variant).frontage).toBeTruthy();
  });

  it.each([null, undefined, "", "unregistered-category"])(
    "uses a neutral service profile for unknown category %s",
    (category) => {
      expect(districtArchitectureVariantForCategory(category)).toBe("services");
    },
  );
});

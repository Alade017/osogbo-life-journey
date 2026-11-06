import { describe, expect, it } from "vitest";
import { daylightFor } from "@/components/map/MapLighting";

describe("map daylight", () => {
  it("is fully lit at midday and dark at midnight", () => {
    expect(daylightFor(12).day).toBe(1);
    expect(daylightFor(0).day).toBe(0);
  });

  it("keeps the amount between 0 and 1 across the whole day", () => {
    for (let hour = 0; hour < 24; hour++) {
      const { day } = daylightFor(hour, 30);
      expect(day).toBeGreaterThanOrEqual(0);
      expect(day).toBeLessThanOrEqual(1);
    }
  });

  it("brightens from dawn to noon", () => {
    expect(daylightFor(7).day).toBeGreaterThan(daylightFor(5).day);
    expect(daylightFor(12).day).toBeGreaterThan(daylightFor(7).day);
  });
});

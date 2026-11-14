import { describe, expect, it } from "vitest";
import { neighborhoodAreaForLocation, neighborhoodAreaForSlug } from "@/game/neighborhood-model";
import { neighborhoodObstacleFootprint } from "@/game/neighborhood-geometry";

describe("Fuel and Go neighbourhood", () => {
  const area = neighborhoodAreaForSlug("fuel-and-go");

  it("uses the hand-built layout rather than a generated one", () => {
    expect(area.roads?.map((road) => road.id)).toContain("fuel-main-road");
    expect(neighborhoodAreaForLocation({ slug: "fuel-and-go", name: "Fuel and Go" })).toBe(area);
  });

  it("keeps the entrance walkway to the forecourt clear of solid obstacles", () => {
    const walkway = { left: 320, right: 600, top: 293, bottom: 307 };
    for (const obstacle of area.obstacles ?? []) {
      const footprint = neighborhoodObstacleFootprint(obstacle);
      const overlaps =
        footprint.left < walkway.right &&
        footprint.left + footprint.width > walkway.left &&
        footprint.top < walkway.bottom &&
        footprint.top + footprint.height > walkway.top;
      expect(overlaps, obstacle.id).toBe(false);
    }
  });

  it("keeps every pump and the shop on the forecourt, east of the entrance", () => {
    for (const obstacle of area.obstacles ?? []) {
      expect(obstacle.x - obstacle.width / 2, obstacle.id).toBeGreaterThanOrEqual(600);
      expect(obstacle.x + obstacle.width / 2, obstacle.id).toBeLessThanOrEqual(1085);
    }
  });
});

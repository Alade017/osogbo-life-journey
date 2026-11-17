import { expect, it } from "vitest";
import { WORKPLACE_FEATURES, WORKPLACE_LAYOUT } from "@/game/workplace-layout";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
it("registers the existing Tech Hub with every workplace feature", () => {
  const hub = getLocationVenueDesign("harvest-tech-hub", "Harvest");
  expect(hub.scene).toBe("workplace");
  expect(hub.fixtures.map(f => f.workplaceFeature).sort()).toEqual([...WORKPLACE_FEATURES].sort());
  expect(hub.fixtures.map(f => f.id)).toEqual(expect.arrayContaining(["tech-worktable", "tech-screen", "tech-shelf"]));
  expect(new Set(hub.fixtures.map(f => f.id)).size).toBe(hub.fixtures.length);
  expect(hub.sceneSize).toEqual({ width: WORKPLACE_LAYOUT.cameraWidth, depth: WORKPLACE_LAYOUT.cameraDepth });
});
it("keeps fixture anchors within the room and preserves unrelated scenes", () => {
  const hub = getLocationVenueDesign("harvest-tech-hub", "Harvest");
  for (const f of hub.fixtures) {
    expect(Math.abs(f.position[0])).toBeLessThan(WORKPLACE_LAYOUT.width / 2);
    expect(Math.abs(f.position[1])).toBeLessThan(WORKPLACE_LAYOUT.depth / 2);
  }
  expect(getLocationVenueDesign("oja-oba", "Market").scene).toBe("market");
  expect(getLocationVenueDesign("community-clinic", "Clinic").scene).toBe("clinic");
});

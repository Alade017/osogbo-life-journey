import { expect, it } from "vitest";
import {
  WORKPLACE_FEATURES,
  WORKPLACE_LAYOUT,
  WORKPLACE_FOOTPRINTS,
} from "@/game/workplace-layout";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
it("registers the existing Tech Hub with every workplace feature", () => {
  const hub = getLocationVenueDesign("harvest-tech-hub", "Harvest");
  expect(hub.scene).toBe("workplace");
  expect(hub.fixtures.map((f) => f.workplaceFeature).sort()).toEqual(
    [...WORKPLACE_FEATURES].sort(),
  );
  expect(hub.fixtures.map((f) => f.id)).toEqual(
    expect.arrayContaining(["tech-worktable", "tech-screen", "tech-shelf"]),
  );
  expect(new Set(hub.fixtures.map((f) => f.id)).size).toBe(hub.fixtures.length);
  expect(hub.sceneSize).toEqual({
    width: WORKPLACE_LAYOUT.cameraWidth,
    depth: WORKPLACE_LAYOUT.cameraDepth,
  });
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

it("keeps full workstation and seating footprints outside the entrance aisle", () => {
  const { aisle, width, depth, entranceWidth } = WORKPLACE_LAYOUT;
  expect(entranceWidth).toBeGreaterThan(aisle.width);
  const hub = getLocationVenueDesign("harvest-tech-hub", "Harvest");
  const bounds = hub.fixtures.map((fixture) => {
    const footprint = WORKPLACE_FOOTPRINTS[fixture.workplaceFeature!];
    const [x, z] = fixture.position;
    const box = {
      left: x - footprint.width / 2,
      right: x + footprint.width / 2,
      back: z - footprint.depth / 2,
      front: z + footprint.depth / 2,
    };
    expect(box.left).toBeGreaterThan(-width / 2);
    expect(box.right).toBeLessThan(width / 2);
    expect(box.back).toBeGreaterThan(-depth / 2);
    expect(box.front).toBeLessThan(depth / 2);
    const crossesAisle = box.front > aisle.startZ && box.back < aisle.endZ;
    if (crossesAisle) {
      expect(box.right <= -aisle.width / 2 - 0.2 || box.left >= aisle.width / 2 + 0.2).toBe(true);
    }
    return box;
  });
  bounds.forEach((a, i) =>
    bounds.slice(i + 1).forEach((b) => {
      expect(a.right <= b.left || a.left >= b.right || a.front <= b.back || a.back >= b.front).toBe(
        true,
      );
    }),
  );
});

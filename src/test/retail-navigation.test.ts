import { describe, expect, it } from "vitest";
import type { VenueFixture } from "@/lib/location-venue-designs";
import { retailNavigation } from "@/game/retail-navigation";

const fixtures: VenueFixture[] = [
  { id: "mall-display", label: "Featured display", detail: "", kind: "display", position: [-4.6, 0] },
  { id: "mall-shelves", label: "Shop shelves", detail: "", kind: "shelf", position: [4, -4.5] },
  { id: "mall-essentials", label: "Essentials aisle", detail: "", kind: "shelf", position: [4, -1.3] },
  { id: "mall-gallery-shop", label: "Gallery shop display", detail: "", kind: "display", position: [-4.6, -4.5] },
  { id: "mall-seats", label: "Gallery seats", detail: "", kind: "seat", position: [-4.6, 4.5] },
  { id: "mall-checkout", label: "Checkout counter", detail: "", kind: "counter", position: [4, 3.3] },
];

describe("retail gallery navigation", () => {
  const navigation = retailNavigation(fixtures);

  it.each(fixtures)("finds a collision-free approach to $label", (fixture) => {
    const path = navigation.approach([0, 6.15], fixture);
    expect(path).not.toBeNull();
    expect(path!.every(navigation.canWalk)).toBe(true);
    expect(path!.at(-1)).not.toEqual(fixture.position);
  });

  it("blocks the actual shelf, checkout, display and seating footprints", () => {
    expect(navigation.canWalk([4, -4.5])).toBe(false);
    expect(navigation.canWalk([4, 3.3])).toBe(false);
    expect(navigation.canWalk([-4.6, 0])).toBe(false);
    expect(navigation.canWalk([-4.6, 4.5])).toBe(false);
  });

  it("keeps the rear and side walls outside the walkable area", () => {
    expect(navigation.canWalk([0, -7])).toBe(false);
    expect(navigation.canWalk([-8, 0])).toBe(false);
    expect(navigation.canWalk([8, 0])).toBe(false);
    expect(navigation.canWalk([2.4, 5.5])).toBe(false);
    expect(navigation.canWalk([5.6, 5.5])).toBe(false);
  });

  it("resolves a floor tap on a fixture to a nearby walkable point", () => {
    const target = navigation.nearest([4, -4.5]);
    expect(target).not.toBeNull();
    expect(navigation.canWalk(target!)).toBe(true);
    expect(Math.hypot(target![0] - 4, target![1] + 4.5)).toBeLessThanOrEqual(3);
  });

  it("rejects non-finite floor coordinates", () => {
    expect(navigation.nearest([Number.NaN, 0])).toBeNull();
  });
});

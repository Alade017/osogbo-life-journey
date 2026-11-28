import { describe, expect, it } from "vitest";
import type { VenueFixture } from "@/lib/location-venue-designs";
import { marketNavigation } from "@/game/market-navigation";

const fixtures: VenueFixture[] = [
  { id: "produce", label: "Produce", detail: "", kind: "counter", position: [-2.7, -0.5] },
  { id: "shelves", label: "Shelves", detail: "", kind: "shelf", position: [2.7, -0.5] },
  { id: "display", label: "Display", detail: "", kind: "table", position: [0, 0.9] },
  { id: "seats", label: "Seats", detail: "", kind: "seat", position: [0, -2.1] },
];

describe("Oja-Oba market navigation", () => {
  const navigation = marketNavigation(fixtures);

  it.each(fixtures)("finds a clear approach to $label", (fixture) => {
    const path = navigation.approach([0, 3], fixture);
    expect(path).not.toBeNull();
    expect(path!.every(navigation.canWalk)).toBe(true);
    expect(path!.at(-1)).not.toEqual(fixture.position);
  });

  it("keeps the character inside the hall and outside authored stall footprints", () => {
    expect(navigation.canWalk([0, -4])).toBe(false);
    expect(navigation.canWalk([5.4, 0])).toBe(false);
    expect(navigation.canWalk([-2.7, -0.5])).toBe(false);
    expect(navigation.route([0, 3], [-2.7, -0.5])).toBeNull();
  });

  it("does not fabricate an approach for fixtures outside the hall", () => {
    const outside: VenueFixture = {
      id: "outside", label: "Outside", detail: "", kind: "counter", position: [20, 20],
    };
    expect(navigation.approach([0, 3], outside)).toBeNull();
  });
});

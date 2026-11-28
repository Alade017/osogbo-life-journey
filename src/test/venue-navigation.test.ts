import { describe, expect, it } from "vitest";
import type { VenueFixture } from "@/lib/location-venue-designs";
import { venueNavigation } from "@/game/venue-navigation";

const fixtures: VenueFixture[] = [
  { id: "counter", label: "Counter", detail: "", kind: "counter", position: [-2, -1] },
  { id: "table", label: "Table", detail: "", kind: "table", position: [2, -1] },
  { id: "shelf", label: "Shelf", detail: "", kind: "shelf", position: [0, -2.5] },
];

describe("generic venue fixture navigation", () => {
  const navigation = venueNavigation(fixtures, 11, 8);

  it.each(fixtures)("finds a clear approach to $label", (fixture) => {
    const path = navigation.approach([0, 2.5], fixture);
    expect(path).not.toBeNull();
    expect(path!.every(navigation.canWalk)).toBe(true);
    expect(path!.at(-1)).not.toEqual(fixture.position);
  });

  it("does not route through fixture footprints or outside the venue shell", () => {
    expect(navigation.canWalk([-2, -1])).toBe(false);
    expect(navigation.canWalk([0, 4])).toBe(false);
    expect(navigation.canWalk([-5.5, 0])).toBe(false);
    expect(navigation.route([0, 2.5], [-2, -1])).toBeNull();
  });

  it("returns no approach when a fixture is completely outside the walkable room", () => {
    const outside: VenueFixture = {
      id: "outside",
      label: "Outside",
      detail: "",
      kind: "counter",
      position: [20, 20],
    };
    expect(navigation.approach([0, 2.5], outside)).toBeNull();
  });
});

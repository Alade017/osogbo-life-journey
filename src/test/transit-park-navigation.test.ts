import { describe, expect, it } from "vitest";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import { TRANSIT_PARK_SPAWN, transitParkNavigation } from "@/game/transit-park-navigation";

describe("transit park pedestrian navigation", () => {
  const fixtures = getLocationVenueDesign("transit-park", "Transit Park").fixtures;
  const navigation = transitParkNavigation(fixtures);

  it("starts in the public concourse and reaches every passenger fixture", () => {
    expect(navigation.canWalk(TRANSIT_PARK_SPAWN)).toBe(true);
    for (const fixture of fixtures) {
      const path = navigation.approach(TRANSIT_PARK_SPAWN, fixture);
      expect(path, fixture.id).not.toBeNull();
      expect(path!.every(navigation.canWalk)).toBe(true);
      expect(path!.at(-1)).not.toEqual(fixture.position);
    }
  });

  it("keeps routes clear of minibuses, fixtures, shelter supports and room edges", () => {
    for (const point of [
      [-2.3, -2.1], [2.3, -2.1], [-2.7, 0.8], [0, -1.5],
      [2.7, 0.8], [-4.8, 1.15], [4.8, 1.15], [5.4, 0], [0, 3.9],
    ] as const) expect(navigation.canWalk(point)).toBe(false);
    expect(navigation.route(TRANSIT_PARK_SPAWN, [20, 20])).toBeNull();
  });

  it("snaps floor taps to a nearby walkable point without entering a vehicle", () => {
    const point = navigation.nearest([-2.3, -2.1]);
    expect(point).not.toBeNull();
    expect(navigation.canWalk(point!)).toBe(true);
    expect(navigation.route(TRANSIT_PARK_SPAWN, point!)).not.toBeNull();
  });
});

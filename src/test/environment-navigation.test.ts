import { describe, expect, it } from "vitest";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import { environmentNavigation } from "@/game/environment-navigation";

const slugs = ["town-market", "lantern-club", "fish-market", "fuel-and-go"] as const;

describe.each(slugs)("environment navigation: %s", (slug) => {
  const venue = getLocationVenueDesign(slug, slug);
  const navigation = environmentNavigation(venue.fixtures);

  it("spawns inside the walkable model stage", () => {
    expect(navigation.canWalk(navigation.spawn)).toBe(true);
  });

  it.each(venue.fixtures)("finds a reachable approach to $label", (fixture) => {
    const path = navigation.approach(navigation.spawn, fixture);
    expect(path).not.toBeNull();
    expect(path!.every(navigation.canWalk)).toBe(true);
    expect(path!.at(-1)).not.toEqual(fixture.position);
  });

  it("rejects stage boundaries and resolves taps on fixture footprints", () => {
    const fixture = venue.fixtures[0]!;
    expect(navigation.canWalk([fixture.position[0], fixture.position[1]])).toBe(false);
    expect(navigation.canWalk([4.5, 0])).toBe(false);
    const target = navigation.nearest(fixture.position);
    expect(target).not.toBeNull();
    expect(navigation.canWalk(target!)).toBe(true);
  });
});

describe("environment navigation coordinate conversion", () => {
  it("maps model-local floor coordinates back to the authored 9×7 stage", () => {
    const scaleX = 0.72;
    const scaleZ = 0.81;
    const modelPoint = [1.44, -1.62] as const;
    expect([modelPoint[0] / scaleX, modelPoint[1] / scaleZ]).toEqual([2, -2]);
  });
});

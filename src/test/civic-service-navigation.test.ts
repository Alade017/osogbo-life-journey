import { describe, expect, it } from "vitest";
import { getLocationVenueDesign } from "@/lib/location-venue-designs";
import { civicServiceNavigation, CIVIC_SERVICE_SPAWN } from "@/game/civic-service-navigation";

describe("civic service navigation", () => {
  it.each(["civic-court", "community-police"])("%s keeps public routes reachable", (slug) => {
    const fixtures = getLocationVenueDesign(slug, slug).fixtures;
    const navigation = civicServiceNavigation(fixtures);
    expect(navigation.canWalk(CIVIC_SERVICE_SPAWN)).toBe(true);

    const publicFixtures = fixtures.filter((fixture) =>
      !["consultation-desk", "records-cabinet", "briefing-table"].includes(fixture.id),
    );
    for (const fixture of publicFixtures) {
      const path = navigation.approach(CIVIC_SERVICE_SPAWN, fixture);
      expect(path, fixture.id).not.toBeNull();
      expect(path!.every(navigation.canWalk)).toBe(true);
      expect(path!.at(-1)).not.toEqual(fixture.position);
    }
  });

  it.each([
    ["civic-court", "consultation-desk"],
    ["civic-court", "records-cabinet"],
    ["community-police", "briefing-table"],
  ])("does not route public visitors into staff-only fixtures", (slug, fixtureId) => {
    const fixtures = getLocationVenueDesign(slug, slug).fixtures;
    const fixture = fixtures.find((item) => item.id === fixtureId)!;
    expect(civicServiceNavigation(fixtures).approach(CIVIC_SERVICE_SPAWN, fixture)).toBeNull();
  });

  it("blocks the rear/side walls, staff partition and fixture footprints", () => {
    const fixtures = getLocationVenueDesign("civic-court", "Civic service hall").fixtures;
    const navigation = civicServiceNavigation(fixtures);
    for (const point of [[-6.8, 0], [0, -5.3], [0.8, -4], [3, -2.2], [-3.2, -1.5], [0, 5.1], [-6.1, 4.4]] as const)
      expect(navigation.canWalk(point)).toBe(false);
    expect(navigation.route(CIVIC_SERVICE_SPAWN, [20, 20])).toBeNull();
  });
});

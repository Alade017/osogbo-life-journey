import { describe, expect, it, vi } from "vitest";
import { normalizeCityLocation } from "@/lib/location-service";
import {
  findNearbyLocations,
  haversineDistanceMeters,
  NearbyLocationTracker,
  requestLocationInteraction,
  subscribeLocationInteractionRequests,
} from "@/lib/nearby-location-service";
import type { MapLocation } from "@/lib/game";

const PLAYER = { latitude: 7.7677, longitude: 4.556 };

function location(overrides: Partial<MapLocation> = {}) {
  return normalizeCityLocation({
    id: "market-a",
    name: "Oja Oba Market",
    slug: "oja-oba-market",
    type: "market",
    description: "Central market.",
    latitude: 7.7677,
    longitude: 4.556,
    icon: "store",
    image_url: null,
    is_active: true,
    interaction_radius_m: 50,
    level_required: 0,
    metadata: {},
    ...overrides,
  });
}

describe("nearby location detection", () => {
  it("uses haversine distance and detects entering and leaving a radius", () => {
    const nearby = location();
    const fiveMetersNorth = {
      latitude: PLAYER.latitude + 5 / 110_574,
      longitude: PLAYER.longitude,
    };
    const eightyMetersNorth = {
      latitude: PLAYER.latitude + 80 / 110_574,
      longitude: PLAYER.longitude,
    };
    expect(haversineDistanceMeters(PLAYER, fiveMetersNorth)).toBeCloseTo(5, 0);
    expect(findNearbyLocations(fiveMetersNorth, [nearby])).toHaveLength(1);
    expect(findNearbyLocations(eightyMetersNorth, [nearby])).toHaveLength(0);
  });

  it("returns all nearby places ordered by distance and supports categories and level gates", () => {
    const closer = location({ id: "closest", name: "Closest", level_required: 3 });
    const farther = location({
      id: "farther",
      name: "Farther",
      type: "bank",
      latitude: PLAYER.latitude + 15 / 110_574,
      level_required: 0,
    });
    const result = findNearbyLocations(PLAYER, [farther, closer], 1);
    expect(result.map((item) => item.location.id)).toEqual(["closest", "farther"]);
    expect(result[0]?.meetsLevelRequirement).toBe(false);
    expect(result[1]?.location.category).toBe("bank");
  });

  it("emits one enter and one leave while moving between locations", () => {
    const tracker = new NearbyLocationTracker();
    const first = location({ id: "first" });
    const second = location({
      id: "second",
      name: "Second Market",
      latitude: PLAYER.latitude + 100 / 110_574,
    });
    const firstMatch = findNearbyLocations(PLAYER, [first])[0]!;
    const secondPlayerPosition = {
      latitude: PLAYER.latitude + 100 / 110_574,
      longitude: PLAYER.longitude,
    };
    const secondMatch = findNearbyLocations(secondPlayerPosition, [second])[0]!;
    expect(tracker.update([firstMatch]).map((event) => event.type)).toEqual(["entered"]);
    expect(tracker.update([firstMatch])).toEqual([]);
    expect(
      tracker.update([secondMatch]).map((event) => `${event.type}:${event.location.id}`),
    ).toEqual(["entered:second", "left:first"]);
  });

  it("publishes a generic interaction request without running category actions", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLocationInteractionRequests(listener);
    const nearby = findNearbyLocations(PLAYER, [location()])[0]!;
    requestLocationInteraction({
      location: nearby.location,
      distanceMeters: nearby.distanceMeters,
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      location: nearby.location,
      distanceMeters: nearby.distanceMeters,
    });
    unsubscribe();
  });
});

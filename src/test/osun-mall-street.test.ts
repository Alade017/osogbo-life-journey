import { describe, expect, it } from "vitest";
import {
  STREET_DOOR_FRONT,
  STREET_OBSTACLES,
  STREET_PEDESTRIANS,
  STREET_RIDER_SPOT,
  canWalkOnStreet,
  findStreetPath,
  nextRiderTarget,
} from "@/game/osun-mall-street-layout";
import {
  OKADA_DESTINATIONS,
  OKADA_HOME,
  OKADA_RIDE_SECONDS,
  OKADA_SEARCH_SECONDS,
  rideProgress,
} from "@/game/okada-destinations";

describe("street outside the Osun Mall", () => {
  it("lets visitors stand in front of the door, and at the rider's stand", () => {
    expect(canWalkOnStreet(STREET_DOOR_FRONT)).toBe(true);
    expect(canWalkOnStreet(STREET_RIDER_SPOT)).toBe(true);
  });

  it("keeps everyone off the kiosks, the stand and the shelter", () => {
    for (const rect of STREET_OBSTACLES) {
      const centre: [number, number] = [(rect.minX + rect.maxX) / 2, (rect.minZ + rect.maxZ) / 2];
      expect(canWalkOnStreet(centre), rect.id).toBe(false);
    }
  });

  it("keeps pedestrians on walkable spots", () => {
    for (const spot of STREET_PEDESTRIANS)
      expect(canWalkOnStreet(spot), JSON.stringify(spot)).toBe(true);
  });

  it("finds a route from the door to the rider's stand around the obstacles", () => {
    const path = findStreetPath(STREET_DOOR_FRONT, STREET_RIDER_SPOT);
    expect(path).not.toBeNull();
    expect(path?.at(-1)).toEqual(STREET_RIDER_SPOT);
    for (const point of path ?? []) expect(canWalkOnStreet(point)).toBe(true);
  });
});

describe("okada rides", () => {
  it("offers home and real places as destinations", () => {
    expect(OKADA_DESTINATIONS[0]).toBe(OKADA_HOME);
    expect(new Set(OKADA_DESTINATIONS).size).toBe(OKADA_DESTINATIONS.length);
  });

  it("lets a searching ride be cancelled only during the first 20 seconds", () => {
    const created = 1_000_000;
    expect(rideProgress("requested", created, created + 5_000).canCancel).toBe(true);
    expect(
      rideProgress("requested", created, created + OKADA_SEARCH_SECONDS * 1000).canCancel,
    ).toBe(false);
  });

  it("shows the rider on the way, then arrival, and never offers cancel after the rider is found", () => {
    expect(rideProgress("assigned", 0, 60_000)).toEqual({
      label: "Your rider is on the way.",
      canCancel: false,
    });
    expect(rideProgress("completed", 0, 999_999).label).toBe("You have arrived.");
    expect(OKADA_RIDE_SECONDS).toBe(180);
  });
});

describe("nextRiderTarget", () => {
  it("does nothing when no ride is assigned", () => {
    expect(nextRiderTarget(null, [1, 1], false)).toBeNull();
  });

  it("keeps the old target while the visitor is still walking", () => {
    expect(nextRiderTarget([0, 0], [3, 3], true)).toEqual([0, 0]);
  });

  it("moves the target to the visitor once they stop", () => {
    expect(nextRiderTarget([0, 0], [3, 3], false)).toEqual([3, 3]);
  });

  it("ignores small moves so the rider does not restart its walk", () => {
    expect(nextRiderTarget([0, 0], [0.1, 0.1], false)).toEqual([0, 0]);
  });
});

it("keeps the entrance and rider accessible around the new frontage railings", () => {
  const from: [number, number] = [0, -3.4];
  expect(findStreetPath(from, [0, 1])).not.toBeNull();
  expect(findStreetPath(from, STREET_RIDER_SPOT)).not.toBeNull();
  expect(canWalkOnStreet([-4, -3.1])).toBe(false);
  expect(canWalkOnStreet([4, -3.1])).toBe(false);
});

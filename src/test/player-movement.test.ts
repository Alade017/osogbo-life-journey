import { describe, expect, it, vi } from "vitest";
import {
  OSOGBO_PLAYABLE_BOUNDS,
  stepVirtualPosition,
  subscribePlayerMovement,
  publishPlayerMovement,
} from "@/lib/player-movement";

describe("virtual player movement", () => {
  it("moves in the requested direction and normalizes diagonals", () => {
    const start = { latitude: 7.7, longitude: 4.5 };
    const north = stepVirtualPosition(start, new Set(["north"]), 50);
    expect(north.latitude).toBeGreaterThan(start.latitude);
    expect(north.longitude).toBe(start.longitude);
    const diagonal = stepVirtualPosition(start, new Set(["north", "east"]), 50);
    expect(diagonal.latitude - start.latitude).toBeCloseTo(diagonal.longitude - start.longitude);
  });

  it("clamps movement to every edge of the playable Osogbo bounds", () => {
    expect(
      stepVirtualPosition(
        { latitude: OSOGBO_PLAYABLE_BOUNDS.north, longitude: 4.5 },
        new Set(["north"]),
        50,
      ).latitude,
    ).toBe(OSOGBO_PLAYABLE_BOUNDS.north);
    expect(
      stepVirtualPosition(
        { latitude: OSOGBO_PLAYABLE_BOUNDS.south, longitude: 4.5 },
        new Set(["south"]),
        50,
      ).latitude,
    ).toBe(OSOGBO_PLAYABLE_BOUNDS.south);
    expect(
      stepVirtualPosition(
        { latitude: 7.7, longitude: OSOGBO_PLAYABLE_BOUNDS.east },
        new Set(["east"]),
        50,
      ).longitude,
    ).toBe(OSOGBO_PLAYABLE_BOUNDS.east);
    expect(
      stepVirtualPosition(
        { latitude: 7.7, longitude: OSOGBO_PLAYABLE_BOUNDS.west },
        new Set(["west"]),
        50,
      ).longitude,
    ).toBe(OSOGBO_PLAYABLE_BOUNDS.west);
  });

  it("publishes position updates for future movement subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePlayerMovement(listener);
    const position = { latitude: 7.7, longitude: 4.5 };
    publishPlayerMovement(position, "walking");
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ position, movementState: "walking" }),
    );
    unsubscribe();
  });
});

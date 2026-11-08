import { describe, expect, it } from "vitest";
import { GROUND_ARRIVE_DISTANCE, groundIntent } from "@/game/ground-intent";

describe("tap-to-walk intent", () => {
  it("walks toward a tapped point along each axis", () => {
    expect(groundIntent({ x: 100, y: 0 }, { x: 0, y: 0 })).toEqual({ x: 1, y: 0 });
    expect(groundIntent({ x: -100, y: 100 }, { x: 0, y: 0 })).toEqual({ x: -1, y: 1 });
  });

  it("stops once the character is close enough", () => {
    expect(groundIntent({ x: 3, y: 4 }, { x: 0, y: 0 })).toBeNull();
    expect(groundIntent({ x: GROUND_ARRIVE_DISTANCE + 5, y: 0 }, { x: 0, y: 0 })).not.toBeNull();
  });

  it("does nothing without a target or a known position", () => {
    expect(groundIntent(null, { x: 0, y: 0 })).toBeNull();
    expect(groundIntent({ x: 50, y: 50 }, null)).toBeNull();
  });
});

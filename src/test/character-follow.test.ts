import { describe, expect, it } from "vitest";
import { followStep, measuredSpeed } from "../components/3d/character-follow.ts";

describe("followStep", () => {
  it("keeps walking at the measured speed instead of slowing down near the goal", () => {
    // A short gap: easing alone would give about 0.019 this frame, the measured 3 units/s gives 0.05.
    const next = followStep([0, 0, 0], [0.2, 0, 0], 1 / 60, 3, 6);
    expect(next[0]).toBeCloseTo(0.05, 6);
  });

  it("never overshoots the goal", () => {
    const next = followStep([0, 0, 0], [0.01, 0, 0], 1, 5, 6);
    expect(next).toEqual([0.01, 0, 0]);
  });

  it("closes a large gap smoothly when the measured speed is low", () => {
    const next = followStep([0, 0, 0], [4, 0, 0], 1 / 60, 0, 6);
    expect(next[0]).toBeGreaterThan(0);
    expect(next[0]).toBeLessThan(4);
  });

  it("returns the goal exactly when already there", () => {
    expect(followStep([1, 2, 3], [1, 2, 3], 0.016, 2, 6)).toEqual([1, 2, 3]);
  });
});

describe("measuredSpeed", () => {
  it("is distance over elapsed time", () => {
    expect(measuredSpeed([0, 0, 0], [0.1, 0, 0], 0.05)).toBeCloseTo(2, 6);
  });

  it("is zero when nothing moved and is capped", () => {
    expect(measuredSpeed([1, 0, 1], [1, 0, 1], 0.05)).toBe(0);
    expect(measuredSpeed([0, 0, 0], [5, 0, 0], 0.001)).toBe(6);
  });
});

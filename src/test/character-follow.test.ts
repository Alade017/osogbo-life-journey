import { describe, expect, it } from "vitest";
import {
  followStep,
  measuredSpeed,
  lookAtBodyTurn,
  shortestFacingDifference,
  walkingCadence,
  type Vec3,
} from "../components/3d/character-follow.ts";
import { CHARACTER_MOTION } from "../components/3d/character-config";

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

describe("reusable movement output", () => {
  it("returns the supplied output buffer", () => {
    const output: Vec3 = [0, 0, 0];
    const result = followStep([0, 0, 0], [1, 0, 0], 1 / 60, 3, 6, output);
    expect(result).toBe(output);
    expect(result[0]).toBeGreaterThan(0);
  });

  it("matches the original allocating movement path", () => {
    const current: Vec3 = [1, 2, 3];
    const goal: Vec3 = [4, 5, -2];
    const output: Vec3 = [0, 0, 0];
    expect(followStep(current, goal, 0.016, 2, 6, output)).toEqual(
      followStep(current, goal, 0.016, 2, 6),
    );
  });

  it("overwrites the buffer when already at the goal", () => {
    const output: Vec3 = [99, 99, 99];
    expect(followStep([1, 2, 3], [1, 2, 3], 0.016, 2, 6, output)).toBe(output);
    expect(output).toEqual([1, 2, 3]);
  });

  it("does not mutate the input coordinates", () => {
    const current: Vec3 = [1, 2, 3];
    const goal: Vec3 = [4, 5, 6];
    followStep(current, goal, 0.016, 2, 6, [0, 0, 0]);
    expect(current).toEqual([1, 2, 3]);
    expect(goal).toEqual([4, 5, 6]);
  });

  it("preserves separate results for separate buffers", () => {
    const first: Vec3 = [0, 0, 0];
    const second: Vec3 = [0, 0, 0];
    followStep([0, 0, 0], [1, 0, 0], 0.1, 2, 6, first);
    const snapshot = [...first];
    followStep([0, 0, 0], [0, 0, 1], 0.1, 2, 6, second);
    expect(first).toEqual(snapshot);
    expect(first).not.toBe(second);
    expect(first).not.toEqual(second);
  });

  it("preserves independent results for existing callers", () => {
    const first = followStep([0, 0, 0], [1, 0, 0], 0.1, 2, 6);
    const second = followStep([0, 0, 0], [1, 0, 0], 0.1, 2, 6);
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});

describe("walkingCadence", () => {
  it("preserves the reference walking rate", () => {
    const distance = CHARACTER_MOTION.walkReferenceSpeed * 0.1;
    expect(walkingCadence(distance, 0.1, 1)).toBeCloseTo(
      Math.min(1, CHARACTER_MOTION.walkMaxCadence),
      6,
    );
  });

  it("caps excessive cadence", () => {
    expect(walkingCadence(1000, 0.001, 1)).toBe(CHARACTER_MOTION.walkMaxCadence);
  });

  it.each([
    [NaN, 0.1, 1],
    [1, Infinity, 1],
    [1, 0.1, NaN],
    [0, 0.1, 1],
    [-1, 0.1, 1],
    [1, 0, 1],
    [1, -0.1, 1],
    [1, 0.1, 0],
    [1, 0.1, -1],
  ])("rejects invalid cadence inputs (%s, %s, %s)", (distance, delta, height) => {
    expect(walkingCadence(distance, delta, height)).toBe(0);
  });
});

describe("shortestFacingDifference", () => {
  it("preserves zero and tiny settled rotations", () => {
    expect(shortestFacingDifference(0, 0)).toBe(0);
    expect(shortestFacingDifference(0.001, 0)).toBe(0.001);
    expect(shortestFacingDifference(-0.001, 0)).toBe(-0.001);
  });
  it("turns toward the shortest direction across the angle wrap", () => {
    expect(shortestFacingDifference(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(0.2);
    expect(shortestFacingDifference(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(-0.2);
  });
  it("retains normal turns and equivalent full rotations", () => {
    expect(shortestFacingDifference(Math.PI / 2, 0)).toBeCloseTo(Math.PI / 2);
    expect(shortestFacingDifference(2 * Math.PI, 0)).toBeCloseTo(0);
  });
});

describe("lookAtBodyTurn", () => {
  const limit = CHARACTER_MOTION.headTurnLimit * 0.5;

  it("faces a target directly ahead without turning", () => {
    expect(lookAtBodyTurn(0, 1, 0, 0, 0)).toBe(0);
  });

  it("clamps targets on either side to the existing turn limit", () => {
    expect(lookAtBodyTurn(1, 0, 0, 0, 0)).toBeCloseTo(limit);
    expect(lookAtBodyTurn(-1, 0, 0, 0, 0)).toBeCloseTo(-limit);
  });

  it("preserves shortest-angle wrapping at the negative and positive pi boundary", () => {
    expect(lookAtBodyTurn(0, -1, 0, 0, -Math.PI + 0.1)).toBeCloseTo(-0.1);
    expect(lookAtBodyTurn(0, -1, 0, 0, Math.PI - 0.1)).toBeCloseTo(0.1);
  });

  it("updates the direction when the target or requested position changes", () => {
    expect(lookAtBodyTurn(0, 1, 0, 0, 0)).toBe(0);
    expect(lookAtBodyTurn(1, 1, 0, 0, 0)).toBeGreaterThan(0);
    expect(lookAtBodyTurn(1, 1, 1, 0, 0)).toBe(0);
  });

  it("preserves the original look-at formula across representative coordinates", () => {
    for (const [tx, tz, x, z, facing] of [
      [2, 4, 1, 3, 0],
      [-2, -3, 5, 1, Math.PI],
      [1, -4, -2, 5, -Math.PI / 2],
      [0, 0, 0, 0, Math.PI / 2],
    ] as const) {
      const yaw = Math.atan2(tx - x, tz - z);
      const diff = yaw - facing;
      const expected = Math.max(
        -limit,
        Math.min(limit, Math.atan2(Math.sin(diff), Math.cos(diff))),
      );
      expect(lookAtBodyTurn(tx, tz, x, z, facing)).toBeCloseTo(expected);
    }
  });
});

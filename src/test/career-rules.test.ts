import { describe, expect, it } from "vitest";
import { applyCareerMoodDelta, canPromote, clampCareerMood, nextCareerStep } from "@/lib/career-rules";
describe("career progression display rules", () => {
  it("clamps mood effects at both bounds", () => {
    expect(applyCareerMoodDelta(98, 8)).toBe(100);
    expect(applyCareerMoodDelta(2, -8)).toBe(0);
    expect(clampCareerMood(Number.NaN)).toBe(50);
  });
  it("requires sequential work steps and stops at completion", () => {
    expect(nextCareerStep(0, 3)).toBe(1);
    expect(nextCareerStep(1, 3)).toBe(2);
    expect(nextCareerStep(3, 3)).toBeNull();
    expect(nextCareerStep(-1, 3)).toBeNull();
  });
  it("requires both shift and performance thresholds for promotion", () => {
    expect(canPromote(1, 4, 5, 5)).toBe(false);
    expect(canPromote(1, 5, 4, 5)).toBe(false);
    expect(canPromote(1, 5, 5, 5)).toBe(true);
    expect(canPromote(3, 100, 100, 5)).toBe(false);
  });
});

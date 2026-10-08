import { describe, expect, it } from "vitest";
import {
  addExperience,
  experienceRequiredForLevel,
  levelFromExperience,
  progressionFromExperience,
} from "@/lib/progression-service";

describe("progression service", () => {
  it("matches the server level thresholds", () => {
    expect([0, 149, 150, 300].map(levelFromExperience)).toEqual([1, 1, 2, 3]);
    expect(experienceRequiredForLevel(2)).toBe(300);
  });

  it("reports progress toward the next level", () => {
    expect(progressionFromExperience(175)).toEqual({
      level: 2,
      experience: 175,
      experienceIntoLevel: 25,
      experienceRequired: 150,
      experienceToNextLevel: 125,
      progressPercent: (25 / 150) * 100,
    });
  });

  it("calculates grants across multiple levels without writing state", () => {
    expect(addExperience(100, 250)).toEqual({
      experience: 350,
      level: 3,
      leveledUp: true,
      levelsGained: 2,
    });
  });

  it("rejects invalid grants and safely normalizes display values", () => {
    expect(() => addExperience(0, -1)).toThrow(RangeError);
    expect(() => addExperience(1.5, 2)).toThrow(RangeError);
    expect(progressionFromExperience(-4).experience).toBe(0);
  });
});

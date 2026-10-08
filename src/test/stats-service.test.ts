import { describe, expect, it } from "vitest";
import {
  adjustStat,
  clampStat,
  isValidStatValue,
  resetStat,
  resetVitals,
  setStat,
  validateVitals,
} from "@/lib/stats-service";

describe("player stats", () => {
  it("clamps increases and decreases to the 0–100 range", () => {
    const vitals = { health: 98, energy: 3, hunger: 50, thirst: 20 };
    expect(adjustStat(vitals, "health", 10).health).toBe(100);
    expect(adjustStat(vitals, "energy", -10).energy).toBe(0);
    expect(setStat(vitals, "hunger", 160).hunger).toBe(100);
    expect(setStat(vitals, "thirst", -4).thirst).toBe(0);
  });

  it("validates values and restores either one stat or the default state", () => {
    expect(isValidStatValue(100)).toBe(true);
    expect(isValidStatValue(-1)).toBe(false);
    expect(isValidStatValue(2.5)).toBe(false);
    expect(validateVitals({ health: 100, energy: 90, hunger: 101, thirst: -1 })).toHaveLength(2);
    expect(resetStat({ health: 10, energy: 10, hunger: 10, thirst: 10 }, "health").health).toBe(
      100,
    );
    expect(resetVitals()).toEqual({ health: 100, energy: 100, hunger: 20, thirst: 20 });
  });

  it("uses higher hunger and thirst values to mean a stronger unmet need", () => {
    const afterMeal = adjustStat(
      { health: 100, energy: 100, hunger: 80, thirst: 60 },
      "hunger",
      -25,
    );
    const afterDrink = adjustStat(afterMeal, "thirst", -30);
    expect(afterMeal.hunger).toBe(55);
    expect(afterDrink.thirst).toBe(30);
  });

  it("ignores non-finite deltas and safely clamps non-finite values", () => {
    const vitals = { health: 50, energy: 50, hunger: 50, thirst: 50 };
    expect(adjustStat(vitals, "health", Number.NaN)).toEqual(vitals);
    expect(clampStat(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

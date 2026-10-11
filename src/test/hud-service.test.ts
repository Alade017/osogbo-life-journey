import { describe, expect, it } from "vitest";
import { getHudVitals } from "@/lib/hud-service";

describe("HUD vitals", () => {
  it("shows persisted needs with accessible labels and leaves absent thirst untracked", () => {
    expect(getHudVitals({ health: 88, energy: 61, hunger: 24, thirst: null })).toEqual([
      { name: "health", value: 88, label: "Health 88 out of 100" },
      { name: "energy", value: 61, label: "Energy 61 out of 100" },
      { name: "hunger", value: 76, label: "Hunger satisfaction 76 out of 100" },
      { name: "thirst", value: null, label: "Thirst is not tracked yet" },
    ]);
  });

  it("normalizes persisted thirst to the same satisfied-need scale as hunger", () => {
    expect(getHudVitals({ health: 100, energy: 90, hunger: 20, thirst: 35 })).toContainEqual({
      name: "thirst",
      value: 65,
      label: "Thirst satisfaction 65 out of 100",
    });
  });
});

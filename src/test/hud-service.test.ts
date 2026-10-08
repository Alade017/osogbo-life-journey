import { describe, expect, it } from "vitest";
import { getHudVitals } from "@/lib/hud-service";

describe("HUD vitals", () => {
  it("shows persisted needs with accessible labels and leaves absent thirst untracked", () => {
    expect(getHudVitals({ health: 88, energy: 61, hunger: 24, thirst: null })).toEqual([
      { name: "health", value: 88, label: "Health 88 out of 100" },
      { name: "energy", value: 61, label: "Energy 61 out of 100" },
      { name: "hunger", value: 24, label: "Hunger 24 out of 100" },
      { name: "thirst", value: null, label: "Thirst is not tracked yet" },
    ]);
  });
});

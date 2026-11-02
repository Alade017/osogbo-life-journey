import { describe, expect, it } from "vitest";
import {
  homeFurnitureAction,
  homeFurnitureNeed,
  HOME_FURNITURE_ACTIONS,
} from "@/lib/home-furniture-actions";

describe("home furniture action mapping", () => {
  it.each(Object.entries(HOME_FURNITURE_ACTIONS))(
    "maps %s to its server action",
    (item, action) => {
      expect(homeFurnitureAction(item)).toBe(action);
    },
  );

  it("rejects unknown furniture IDs", () => {
    expect(homeFurnitureAction("unknown-item")).toBeNull();
  });

  it.each([
    ["stove", "Hunger"],
    ["bed", "Energy"],
    ["shower", "Hygiene"],
    ["toilet", "Bladder"],
    ["sofa", "Fun"],
  ])("connects %s to the matching home need", (item, need) => {
    expect(homeFurnitureNeed(item)).toBe(need);
    expect(homeFurnitureAction(item)).not.toBeNull();
  });

  it("reports furniture without a need mapping as unavailable for need actions", () => {
    expect(homeFurnitureNeed("unknown-item")).toBeNull();
    expect(homeFurnitureNeed("computer")).toBeNull();
  });
});

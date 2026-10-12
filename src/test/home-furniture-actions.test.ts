import { describe, expect, it } from "vitest";
import { homeFurnitureAction, HOME_FURNITURE_ACTIONS } from "@/lib/home-furniture-actions";

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
});

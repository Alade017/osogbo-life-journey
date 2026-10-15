import { describe, expect, it } from "vitest";
import { isQuickMapTap } from "@/lib/map-gesture";

describe("map tap gesture threshold", () => {
  it("accepts a short press with less than six pixels of movement", () => {
    expect(isQuickMapTap({ x: 20, y: 20, at: 100 }, { x: 23, y: 22, at: 380 })).toBe(true);
  });

  it("treats six pixels of movement or a long press as a map gesture", () => {
    expect(isQuickMapTap({ x: 20, y: 20, at: 100 }, { x: 26, y: 20, at: 200 })).toBe(false);
    expect(isQuickMapTap({ x: 20, y: 20, at: 100 }, { x: 20, y: 20, at: 601 })).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { parseAppTileStyle } from "@/lib/app-tile-style";

describe("app tile style", () => {
  it("keeps the two saved styles", () => {
    expect(parseAppTileStyle("circle")).toBe("circle");
    expect(parseAppTileStyle("rounded")).toBe("rounded");
  });

  it("falls back to rounded for missing or unknown values", () => {
    expect(parseAppTileStyle(undefined)).toBe("rounded");
    expect(parseAppTileStyle(null)).toBe("rounded");
    expect(parseAppTileStyle("square")).toBe("rounded");
    expect(parseAppTileStyle(3)).toBe("rounded");
  });
});

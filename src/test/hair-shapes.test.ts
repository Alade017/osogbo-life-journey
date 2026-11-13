import { describe, expect, it } from "vitest";
import { hairShapeFor } from "@/components/3d/hair-shapes";
import { HAIR_STYLES_BY_GENDER } from "@/game/avatar-appearance";

describe("hair shapes", () => {
  it("maps every saved hair style to a silhouette without hardcoding per body", () => {
    expect(hairShapeFor("Bald")).toBeNull();
    expect(hairShapeFor("Short afro")).toBe("afro");
    expect(hairShapeFor("Natural afro")).toBe("afro");
    expect(hairShapeFor("Low fade")).toBe("cap");
    for (const styles of Object.values(HAIR_STYLES_BY_GENDER)) {
      for (const style of styles)
        expect(hairShapeFor(style) === null || typeof hairShapeFor(style) === "string").toBe(true);
    }
  });
});

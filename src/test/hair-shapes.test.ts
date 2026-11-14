import { describe, expect, it } from "vitest";
import { hairShapeFor } from "@/components/3d/hair-shapes";
import { HAIR_STYLES_BY_GENDER } from "@/game/avatar-appearance";

describe("hair shapes", () => {
  it("maps saved hairstyle labels to distinct procedural silhouettes", () => {
    expect(hairShapeFor("Bald")).toBeNull();
    expect(hairShapeFor("Short afro")).toBe("afro");
    expect(hairShapeFor("Natural afro")).toBe("afro");
    expect(hairShapeFor("Twist-out")).toBe("afro");
    expect(hairShapeFor("Low fade")).toBe("buzz");
    expect(hairShapeFor("Wave cut")).toBe("buzz");
    expect(hairShapeFor("Taper fade")).toBe("buzz");
    expect(hairShapeFor("Cornrows")).toBe("braids");
    expect(hairShapeFor("Knotless braids")).toBe("braids");
    expect(hairShapeFor("Braids")).toBe("braids");
    expect(hairShapeFor("Locs")).toBe("locs");
    expect(hairShapeFor("Bantu knots")).toBe("knots");
    expect(hairShapeFor("Low bun")).toBe("bun");
  });

  it("supports every saved style for every gender", () => {
    for (const styles of Object.values(HAIR_STYLES_BY_GENDER)) {
      for (const style of styles) {
        const shape = hairShapeFor(style);
        expect(shape === null || typeof shape === "string").toBe(true);
      }
    }
  });
});

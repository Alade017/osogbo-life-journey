import { describe, expect, it } from "vitest";
import { shopperLook, staffLook } from "@/game/mall-appearance";
import { HAIR_STYLES_BY_GENDER, SKIN_TONES } from "@/game/avatar-appearance";
import { MALL_STAFF } from "@/game/osun-mall-layout";

describe("mall looks", () => {
  it("dresses every shopper, including women, in clothes", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      expect(shopperLook(seed).appearance.clothed, `seed ${seed}`).toBe(true);
    }
  });

  it("uses the complete supported hair and skin palettes for both genders", () => {
    for (const gender of ["female", "male"] as const) {
      const looks = Array.from({ length: 84 }, (_, seed) => shopperLook(seed))
        .filter(look => look.gender === gender);
      expect(new Set(looks.map(look => look.appearance.hair)).size).toBe(HAIR_STYLES_BY_GENDER[gender]!.length);
      expect(new Set(looks.map(look => look.appearance.skin)).size).toBe(SKIN_TONES.length);
    }
  });

  it("keeps appearance deterministic across repeated calls", () => {
    expect(shopperLook(23)).toEqual(shopperLook(23));
  });

  it("dresses every staff member in a uniform for their role", () => {
    MALL_STAFF.forEach((member, index) => {
      const look = staffLook(member.role, index);
      expect(look.appearance.clothed).toBe(true);
    });
    const tillOutfits = MALL_STAFF.filter((member) => member.role === "till").map(
      (member) => staffLook(member.role, MALL_STAFF.indexOf(member)).appearance.outfit,
    );
    expect(new Set(tillOutfits).size).toBe(1);
  });
});

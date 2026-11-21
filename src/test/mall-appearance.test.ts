import { describe, expect, it } from "vitest";
import { shopperLook, staffLook } from "@/game/mall-appearance";
import { MALL_STAFF } from "@/game/osun-mall-layout";

describe("mall looks", () => {
  it("dresses every shopper, including women, in clothes", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      expect(shopperLook(seed).appearance.clothed, `seed ${seed}`).toBe(true);
    }
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

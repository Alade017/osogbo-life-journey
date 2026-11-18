import { describe, expect, it } from "vitest";
import {
  MALL_CROWD_TARGET,
  MALL_OUTFIT_COUNT,
  advanceCrowd,
  buildShopperRoute,
  createShopper,
} from "@/game/mall-crowd";
import { canWalkInMall } from "@/game/osun-mall-layout";

describe("mall shopper routes", () => {
  it("builds a walkable route for every seed, with stops at browse and pay", () => {
    for (let seed = 0; seed < 40; seed += 1) {
      const route = buildShopperRoute(seed);
      expect(route, `seed ${seed}`).not.toBeNull();
      for (const point of route?.points ?? []) {
        expect(canWalkInMall(point), JSON.stringify(point)).toBe(true);
      }
      expect(route?.dwellAt.size).toBe(2);
    }
  });

  it("ends each route back at the entrance so the shopper can leave", () => {
    const route = buildShopperRoute(7);
    expect(route?.points.at(-1)).toEqual([0, 6.2]);
  });

  it("gives neighbouring shoppers different outfits", () => {
    const outfits = Array.from({ length: 10 }, (_, seed) => createShopper(seed)?.outfit ?? -1);
    for (let i = 1; i < outfits.length; i += 1) {
      expect(outfits[i]).not.toBe(outfits[i - 1]);
      expect(outfits[i]).toBeGreaterThanOrEqual(0);
      expect(outfits[i]).toBeLessThan(MALL_OUTFIT_COUNT);
    }
  });
});

describe("mall crowd", () => {
  it("keeps the floor at the shopper target by replacing shoppers who leave", () => {
    let state = advanceCrowd([], 0, 0);
    expect(state.shoppers).toHaveLength(MALL_CROWD_TARGET);
    for (let step = 0; step < 600; step += 1) {
      state = advanceCrowd(state.shoppers, 0.5, state.nextSeed);
      expect(state.shoppers.length).toBeGreaterThanOrEqual(MALL_CROWD_TARGET);
    }
  });
});

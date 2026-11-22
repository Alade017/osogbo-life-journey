import { describe, expect, it } from "vitest";
import {
  isPaying,
  MALL_CROWD_TARGET,
  advanceCrowd,
  buildShopperRoute,
  createShopper,
  getShopperById,
} from "@/game/mall-crowd";
import { stepWalker } from "@/game/mall-movement";
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

  it("gives neighbouring shoppers different tops and trousers, all clothed", () => {
    const looks = Array.from({ length: 12 }, (_, seed) => createShopper(seed)?.appearance);
    for (let i = 1; i < looks.length; i += 1) {
      expect(looks[i]?.outfit).not.toBe(looks[i - 1]?.outfit);
      expect(looks[i]?.bottoms).not.toBe(looks[i - 1]?.bottoms);
    }
    for (const look of looks) expect(look?.clothed).toBe(true);
  });

  it("uses a good variety of tops across the crowd", () => {
    const tops = new Set(
      Array.from({ length: 20 }, (_, seed) => createShopper(seed)?.appearance.outfit),
    );
    expect(tops.size).toBeGreaterThanOrEqual(5);
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

describe("mall payment", () => {
  it("is paying only during the pause at the till", () => {
    const shopper = createShopper(3);
    expect(shopper).not.toBeNull();
    let walker = shopper!.walker;
    let sawPaying = false;
    let sawBrowsing = false;
    for (let step = 0; step < 4000 && !walker.done; step += 1) {
      walker = stepWalker(walker, 0.05);
      if (isPaying(walker)) sawPaying = true;
      if (walker.dwellLeft > 0 && !isPaying(walker)) sawBrowsing = true;
    }
    expect(sawPaying).toBe(true);
    expect(sawBrowsing).toBe(true);
  });
});

describe("mall shopper lookup", () => {
  it("returns the matching shopper", () => {
    const { shoppers } = advanceCrowd([], 0, 0);

    for (const shopper of shoppers) {
      expect(
        getShopperById(shoppers, shopper.id),
      ).toBe(shopper);
    }
  });

  it("returns undefined for missing shoppers", () => {
    const { shoppers } = advanceCrowd([], 0, 0);

    expect(
      getShopperById(shoppers, "missing"),
    ).toBeUndefined();

    expect(
      getShopperById([], "missing"),
    ).toBeUndefined();
  });

  it("returns updated objects from new snapshots", () => {
    const initial = advanceCrowd([], 0, 0);
    const shopper = initial.shoppers[0]!;

    expect(
      getShopperById(initial.shoppers, shopper.id),
    ).toBe(shopper);

    const next = advanceCrowd(
      initial.shoppers,
      0.1,
      initial.nextSeed,
    );

    const updated = next.shoppers.find(
      (candidate) => candidate.id === shopper.id,
    );

    expect(updated).toBeDefined();
    expect(updated).not.toBe(shopper);

    expect(
      getShopperById(next.shoppers, shopper.id),
    ).toBe(updated);
  });

  it("does not retain removed shoppers in new snapshots", () => {
    const { shoppers } = advanceCrowd([], 0, 0);
    const removed = shoppers[0]!;

    getShopperById(shoppers, removed.id);

    const remaining = shoppers.filter(
      (shopper) => shopper.id !== removed.id,
    );

    expect(
      getShopperById(remaining, removed.id),
    ).toBeUndefined();
  });

  it("preserves first-match behaviour for duplicate IDs", () => {
    const { shoppers } = advanceCrowd([], 0, 0);
    const first = shoppers[0]!;
    const duplicate = { ...first };

    expect(
      getShopperById(
        [first, duplicate],
        first.id,
      ),
    ).toBe(first);
  });
});

import { describe, expect, it } from "vitest";
import {
  isPaying,
  MALL_CROWD_TARGET,
  mallCrowdTarget,
  reservedShopperStops,
  recoverShopperRoute,
  assignWaitingCheckouts,
  MALL_BROWSE_SECONDS,
  MALL_WAITING_SPOTS,
  MALL_PAY_SECONDS,
  payingCashierId,
  MALL_SHOPPER_SPACING,
  advanceCrowd,
  buildShopperRoute,
  createShopper,
  clearsShopperSegment,
  getShopperById,
} from "@/game/mall-crowd";
import { createWalker, stepWalker } from "@/game/mall-movement";
import { MALL_ENTRANCE, MALL_TILL_QUEUE, canWalkInMall } from "@/game/osun-mall-layout";

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

describe("mall attendance policy", () => {
  it("reduces arrivals during rain without changing the clear-weather baseline", () => {
    const time = { hour: 12, weekday: 5 };
    expect(mallCrowdTarget(time, "cloudy")).toBe(MALL_CROWD_TARGET);
    expect(mallCrowdTarget(time, "rainy")).toBeLessThan(mallCrowdTarget(time, "sunny"));
    expect(mallCrowdTarget(time, "heavy-rain")).toBeLessThan(mallCrowdTarget(time, "rainy"));
  });
  it("has fewer shoppers at night and more on weekends during daytime", () => {
    expect(mallCrowdTarget({ hour: 2, weekday: 0 })).toBeLessThan(mallCrowdTarget({ hour: 12, weekday: 0 }));
    expect(mallCrowdTarget({ hour: 12, weekday: 5 })).toBe(MALL_CROWD_TARGET);
    expect(mallCrowdTarget({ hour: 12, weekday: 0 })).toBeLessThan(MALL_CROWD_TARGET);
  });
  it("lets existing shoppers finish their visit when the target falls", () => {
    const initial = advanceCrowd([], 0, 0);
    const next = advanceCrowd(initial.shoppers, 0, initial.nextSeed, 0);
    expect(next.shoppers.map(shopper => shopper.id)).toEqual(initial.shoppers.map(shopper => shopper.id));
    expect(next.nextSeed).toBe(initial.nextSeed);
  });
});

describe("mall crowd", () => {
  it("admits shoppers gradually without exceeding the population target", () => {
    let state = advanceCrowd([], 0, 0);
    expect(state.shoppers).toHaveLength(1);
    let admitted = 0;
    for (let step = 0; step < 600; step += 1) {
      state = advanceCrowd(state.shoppers, 0.5, state.nextSeed);
      expect(state.shoppers.length).toBeLessThanOrEqual(MALL_CROWD_TARGET);
      admitted = Math.max(admitted, state.nextSeed);
      for (const shopper of state.shoppers) expect(canWalkInMall(shopper.walker.pos)).toBe(true);
    }
    expect(admitted).toBeGreaterThan(1);
  });

  it("does not spawn another shopper into an occupied entrance", () => {
    const initial = advanceCrowd([], 0, 0);
    const next = advanceCrowd(initial.shoppers, 0, initial.nextSeed);
    expect(next.shoppers).toHaveLength(1);
    expect(next.nextSeed).toBe(initial.nextSeed);
    const shopper = next.shoppers[0]!;
    expect(Math.hypot(shopper.walker.pos[0] - MALL_ENTRANCE[0], shopper.walker.pos[1] - MALL_ENTRANCE[1])).toBeLessThan(MALL_SHOPPER_SPACING);
  });
});

describe("mall stop reservations", () => {
  it("does not reserve checkout before browsing and waits when checkout is full", () => {
    const shopper = advanceCrowd([], 0, 0).shoppers[0]!;
    expect(reservedShopperStops([shopper], MALL_PAY_SECONDS)).toEqual([]);
    const pos = shopper.walker.points.at(-1)!;
    const waiting = { ...shopper, walker: { ...shopper.walker, pos, next: shopper.walker.points.length, done: true, dwellLeft: 0 } };
    expect(reservedShopperStops([waiting], MALL_BROWSE_SECONDS)).toEqual([pos]);
    const queued = assignWaitingCheckouts([waiting], MALL_TILL_QUEUE)[0]!;
    expect(queued.awaitingCheckout).toBe(true);
    expect(reservedShopperStops([queued], MALL_PAY_SECONDS)).toEqual([]);
    expect(queued.queueSlot).toBeDefined();
    expect(queued.walker.pos).toEqual(pos);
    expect(queued.walker.points.at(-1)).toEqual(queued.queueSlot);
    expect(queued.walker.points.every(canWalkInMall)).toBe(true);
    expect(assignWaitingCheckouts([waiting], [...MALL_TILL_QUEUE, ...MALL_WAITING_SPOTS])[0]).toBe(waiting);
    const assigned = assignWaitingCheckouts([waiting])[0]!;
    expect(assigned.awaitingCheckout).toBe(false);
    expect(assigned.walker.done).toBe(false);
    expect(reservedShopperStops([assigned], MALL_PAY_SECONDS)).toHaveLength(1);
  });
  it("reserves a checkout until its payment dwell has finished", () => {
    const shopper = createShopper(0)!;
    const index = [...shopper.walker.dwellAt].find(([, seconds]) => seconds === MALL_PAY_SECONDS)![0];
    const point = shopper.walker.points[index]!;
    expect(reservedShopperStops([shopper], MALL_PAY_SECONDS)).toEqual([point]);
    const paying = { ...shopper, walker: { ...shopper.walker, pos: point, next: index + 1, dwellLeft: 1 } };
    expect(reservedShopperStops([paying], MALL_PAY_SECONDS)).toEqual([point]);
    expect(payingCashierId(paying.walker)).not.toBeNull();
    expect(reservedShopperStops([{ ...paying, walker: { ...paying.walker, dwellLeft: 0 } }], MALL_PAY_SECONDS)).toEqual([]);
  });
  it("does not admit a shopper on top of a visitor", () => {
    expect(advanceCrowd([], 0.1, 0, MALL_CROWD_TARGET, [MALL_ENTRANCE]).shoppers).toEqual([]);
  });
});

describe("mall route recovery", () => {
  it("reroutes around a stationary visitor while preserving upcoming dwell stops", () => {
    const walker = createWalker([0, 0], [[0, 1], [0, 3], [0, 4]], {
      dwellAt: new Map([[1, MALL_BROWSE_SECONDS], [2, MALL_PAY_SECONDS]]),
    });
    const recovered = recoverShopperRoute(walker, [[0, 1]]);
    expect(recovered).not.toBe(walker);
    expect(recovered.pos).toEqual(walker.pos);
    expect(recovered.points.at(-1)).toEqual([0, 4]);
    expect([...recovered.dwellAt].map(([index, seconds]) => [recovered.points[index], seconds]))
      .toEqual([[[0, 3], MALL_BROWSE_SECONDS], [[0, 4], MALL_PAY_SECONDS]]);
    expect(recovered.points.every(canWalkInMall)).toBe(true);
  });
  it("preserves the current walker when a destination remains occupied", () => {
    const walker = createWalker([0, 0], [[0, 1]]);
    expect(recoverShopperRoute(walker, [[0, 1]])).toBe(walker);
  });
});

describe("mall pedestrian separation", () => {
  it("rejects a crossing even when both endpoints are clear", () => {
    expect(clearsShopperSegment([-1, 0], [1, 0], [[0, 0]])).toBe(false);
  });
  it("permits separation from a legacy overlap but rejects moving closer", () => {
    expect(clearsShopperSegment([0.2, 0], [0.4, 0], [[0, 0]])).toBe(true);
    expect(clearsShopperSegment([0.2, 0], [0.1, 0], [[0, 0]])).toBe(false);
  });
  it("keeps valid clearance during a parallel move", () => {
    expect(clearsShopperSegment([0, 1], [1, 1], [[0, 0]])).toBe(true);
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
      expect(getShopperById(shoppers, shopper.id)).toBe(shopper);
    }
  });

  it("returns undefined for missing shoppers", () => {
    const { shoppers } = advanceCrowd([], 0, 0);

    expect(getShopperById(shoppers, "missing")).toBeUndefined();

    expect(getShopperById([], "missing")).toBeUndefined();
  });

  it("returns updated objects from new snapshots", () => {
    const initial = advanceCrowd([], 0, 0);
    const shopper = initial.shoppers[0]!;

    expect(getShopperById(initial.shoppers, shopper.id)).toBe(shopper);

    const next = advanceCrowd(initial.shoppers, 0.1, initial.nextSeed);

    const updated = next.shoppers.find((candidate) => candidate.id === shopper.id);

    expect(updated).toBeDefined();
    expect(updated).not.toBe(shopper);

    expect(getShopperById(next.shoppers, shopper.id)).toBe(updated);
  });

  it("does not retain removed shoppers in new snapshots", () => {
    const { shoppers } = advanceCrowd([], 0, 0);
    const removed = shoppers[0]!;

    getShopperById(shoppers, removed.id);

    const remaining = shoppers.filter((shopper) => shopper.id !== removed.id);

    expect(getShopperById(remaining, removed.id)).toBeUndefined();
  });

  it("preserves first-match behaviour for duplicate IDs", () => {
    const { shoppers } = advanceCrowd([], 0, 0);
    const first = shoppers[0]!;
    const duplicate = { ...first };

    expect(getShopperById([first, duplicate], first.id)).toBe(first);
  });
});

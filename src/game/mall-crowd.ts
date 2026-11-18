import type { WalkPoint } from "./grid-walk-path";
import { createWalker, stepWalker, type MallWalker } from "./mall-movement";
import {
  MALL_BROWSE_SPOTS,
  MALL_ENTRANCE,
  MALL_TILL_QUEUE,
  findMallPath,
} from "./osun-mall-layout";

/** Shoppers on the floor at once, on top of any real players who are in the mall. */
export const MALL_CROWD_TARGET = 20;
/** Seconds a shopper spends looking at a shelf before going to a till. */
export const MALL_BROWSE_SECONDS = 4;
/** Seconds a shopper spends at the till paying before leaving. */
export const MALL_PAY_SECONDS = 3;
/** Number of outfit colour sets in the crowd's palette. Shoppers use indices into this set. */
export const MALL_OUTFIT_COUNT = 6;

export type MallShopper = {
  id: string;
  /** Index into the crowd's outfit palette. */
  outfit: number;
  walker: MallWalker;
};

/** The route for one shopper: entrance → browse spot → till queue → entrance. */
export function buildShopperRoute(seed: number): { points: WalkPoint[]; dwellAt: Map<number, number> } | null {
  const browse = MALL_BROWSE_SPOTS[mod(seed, MALL_BROWSE_SPOTS.length)];
  const queue = MALL_TILL_QUEUE[mod(seed * 3 + 1, MALL_TILL_QUEUE.length)];
  if (!browse || !queue) return null;
  const legs = [
    findMallPath(MALL_ENTRANCE, browse),
    findMallPath(browse, queue),
    findMallPath(queue, MALL_ENTRANCE),
  ];
  if (legs.some((leg) => leg === null)) return null;
  const points: WalkPoint[] = [];
  const dwellAt = new Map<number, number>();
  for (const [legIndex, leg] of legs.entries()) {
    for (const point of leg ?? []) {
      points.push(point);
    }
    // Pause at the end of the browse leg and at the end of the queue leg.
    if (legIndex === 0) dwellAt.set(points.length - 1, MALL_BROWSE_SECONDS);
    if (legIndex === 1) dwellAt.set(points.length - 1, MALL_PAY_SECONDS);
  }
  return { points, dwellAt };
}

/** A new shopper entering through the front doors, with a route chosen from their seed. */
export function createShopper(seed: number): MallShopper | null {
  const route = buildShopperRoute(seed);
  if (!route) return null;
  return {
    id: `shopper-${seed}`,
    outfit: mod(seed * 5, MALL_OUTFIT_COUNT),
    walker: createWalker(MALL_ENTRANCE, route.points, { dwellAt: route.dwellAt }),
  };
}

/** Advances every shopper by `dt`, then replaces finished shoppers so the crowd stays at target. */
export function advanceCrowd(
  shoppers: readonly MallShopper[],
  dt: number,
  nextSeed: number,
  target = MALL_CROWD_TARGET,
): { shoppers: MallShopper[]; nextSeed: number } {
  const moved = shoppers.map((shopper) => ({
    ...shopper,
    walker: stepWalker(shopper.walker, dt),
  }));
  const remaining = moved.filter((shopper) => !shopper.walker.done);
  let seed = nextSeed;
  while (remaining.length < target) {
    const fresh = createShopper(seed);
    seed += 1;
    if (!fresh) break;
    remaining.push(fresh);
  }
  return { shoppers: remaining, nextSeed: seed };
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

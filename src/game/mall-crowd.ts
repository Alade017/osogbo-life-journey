import { getDayPeriod, type GameTime } from "../lib/game-time.ts";
import type { Appearance } from "./avatar-appearance.ts";
import type { WalkPoint } from "./grid-walk-path.ts";
import { shopperLook, type MallGender } from "./mall-appearance.ts";
import { createWalker, stepWalker, isSegmentWalkable, type MallWalker } from "./mall-movement.ts";
import {
  MALL_BODY_RADIUS,
  MALL_BROWSE_SPOTS,
  MALL_ENTRANCE,
  MALL_TILL_QUEUE,
  findMallPath,
} from "./osun-mall-layout.ts";

/** Shoppers on the floor at once, on top of any real players who are in the mall. */
export const MALL_CROWD_TARGET = 20;
/** Ambient attendance policy, not authoritative opening hours or named NPC schedules. */
export function mallCrowdTarget(time: Pick<GameTime, "hour" | "weekday">): number {
  const period = getDayPeriod(time.hour);
  const weekend = time.weekday === 5 || time.weekday === 6;
  const fraction = period === "night" ? 0.15 : period === "dawn" ? 0.3
    : period === "evening" ? 0.9 : weekend ? 1 : 0.7;
  return Math.round(MALL_CROWD_TARGET * fraction);
}

/** Seconds a shopper spends looking at a shelf before going to a till. */
export const MALL_BROWSE_SECONDS = 4;
/** Seconds a shopper spends at the till paying before leaving. */
export const MALL_PAY_SECONDS = 3;
/** Number of outfit colour sets in the crowd's palette. Shoppers use indices into this set. */
export const MALL_OUTFIT_COUNT = 6;

export type MallShopper = {
  id: string;
  gender: MallGender;
  appearance: Appearance;
  walker: MallWalker;
  /** Most recent nonzero travel heading, retained through idle and browsing. */
  heading?: number;
};

const shopperIndexes = new WeakMap<readonly MallShopper[], Map<string, MallShopper>>();

/**
 * Looks up a shopper in an immutable crowd snapshot.
 * A new snapshot receives a new index.
 */
export function getShopperById(
  shoppers: readonly MallShopper[],
  id: string,
): MallShopper | undefined {
  let index = shopperIndexes.get(shoppers);

  if (!index) {
    index = new Map();

    for (const shopper of shoppers) {
      if (!index.has(shopper.id)) {
        index.set(shopper.id, shopper);
      }
    }

    shopperIndexes.set(shoppers, index);
  }

  return index.get(id);
}

/** The route for one shopper: entrance → browse spot → till queue → entrance. */
export function buildShopperRoute(
  seed: number,
): { points: WalkPoint[]; dwellAt: Map<number, number> } | null {
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
  const look = shopperLook(seed);
  return {
    id: `shopper-${seed}`,
    gender: look.gender,
    appearance: look.appearance,
    walker: createWalker(MALL_ENTRANCE, route.points, { dwellAt: route.dwellAt }),
  };
}

/** Presentation-only following distance, derived from the existing body footprint. */
export const MALL_SHOPPER_SPACING = MALL_BODY_RADIUS * 2;
function distance(a: WalkPoint, b: WalkPoint) {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** A continuous segment check prevents a short movement from jumping across another actor. */
function segmentDistance(from: WalkPoint, to: WalkPoint, point: WalkPoint) {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point[0] - from[0]) * dx + (point[1] - from[1]) * dz) / lengthSquared));
  return distance([from[0] + t * dx, from[1] + t * dz], point);
}

/** Allow an already overlapping actor to separate, but never move it closer. */
export function clearsShopperSegment(from: WalkPoint, to: WalkPoint, occupied: readonly WalkPoint[]) {
  return occupied.every(point => {
    const initial = distance(from, point);
    return segmentDistance(from, to, point) + 1e-6 >= Math.min(initial, MALL_SHOPPER_SPACING);
  });
}

/** Attempt a bounded sidestep without consuming a browse or payment waypoint.
 * The next original waypoint remains the destination. */
function sidestep(walker: MallWalker, elapsed: number, occupied: readonly WalkPoint[]): MallWalker | null {
  const target = walker.points[walker.next];
  if (!target || elapsed <= 0) return null;
  const dx = target[0] - walker.pos[0], dz = target[1] - walker.pos[1];
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return null;
  const step = Math.min(walker.speed * elapsed, MALL_SHOPPER_SPACING / 2);
  for (const angle of [Math.PI / 3, -Math.PI / 3, Math.PI / 2, -Math.PI / 2]) {
    const x = dx / length, z = dz / length;
    const to: WalkPoint = [
      walker.pos[0] + step * (x * Math.cos(angle) - z * Math.sin(angle)),
      walker.pos[1] + step * (x * Math.sin(angle) + z * Math.cos(angle)),
    ];
    if (isSegmentWalkable(walker.pos, to) && isSegmentWalkable(to, target) &&
        clearsShopperSegment(walker.pos, to, occupied)) {
      return { ...walker, pos: to, moving: true };
    }
  }
  return null;
}

function advanceShopper(shopper: MallShopper, occupied: readonly WalkPoint[], elapsed: number) {
  const walker = shopper.walker;
  if (elapsed <= 0) return { ...walker, moving: false };
  const proposed = stepWalker(walker, elapsed);
  if (walker.dwellLeft > 0 || walker.done || distance(walker.pos, proposed.pos) === 0) return proposed;
  if (clearsShopperSegment(walker.pos, proposed.pos, occupied) && isSegmentWalkable(walker.pos, proposed.pos)) return proposed;
  // Try shorter advances before stepping sideways. Do not change the authored route or its dwell indices.
  for (const fraction of [0.5, 0.25]) {
    const shorter = stepWalker(walker, elapsed * fraction);
    if (clearsShopperSegment(walker.pos, shorter.pos, occupied) && isSegmentWalkable(walker.pos, shorter.pos)) return shorter;
  }
  return sidestep(walker, elapsed, occupied) ?? { ...walker, moving: false };
}

/** Advance the crowd and admit newcomers only when the entrance has space. */
export function advanceCrowd(
  shoppers: readonly MallShopper[],
  dt: number,
  nextSeed: number,
  target = MALL_CROWD_TARGET,
): { shoppers: MallShopper[]; nextSeed: number } {
  // A suspended browser or malformed frame delta must not move actors backwards or teleport them.
  const elapsed = Number.isFinite(dt) ? Math.min(0.5, Math.max(0, dt)) : 0;
  // Reserve each accepted position immediately; later actors see earlier movement.
  const positions = shoppers.map(shopper => shopper.walker.pos);
  const moved = shoppers.map((shopper, index) => {
    const occupied = positions.filter((_, other) => other !== index && !shoppers[other]?.walker.done);
    const walker = advanceShopper(shopper, occupied, elapsed);
    positions[index] = walker.pos;
    const dx = walker.pos[0] - shopper.walker.pos[0];
    const dz = walker.pos[1] - shopper.walker.pos[1];
    const heading = Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dx, dz) : shopper.heading ?? 0;
    return { ...shopper, walker, heading };
  });
  const remaining = moved.filter((shopper) => !shopper.walker.done);
  let seed = nextSeed;
  if (remaining.length < target && remaining.every(shopper => distance(shopper.walker.pos, MALL_ENTRANCE) >= MALL_SHOPPER_SPACING)) {
    const fresh = createShopper(seed);
    seed += 1;
    if (fresh) remaining.push(fresh);
  }
  return { shoppers: remaining, nextSeed: seed };
}

function mod(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

/** True while a shopper is standing at a till paying, so the cashier and the shopper can react. */
export function isPaying(walker: MallWalker): boolean {
  return walker.dwellLeft > 0 && walker.dwellAt.get(walker.next - 1) === MALL_PAY_SECONDS;
}

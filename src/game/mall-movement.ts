import { canWalkInMall } from "./osun-mall-layout.ts";
import type { WalkPoint } from "./grid-walk-path.ts";

/** Walking speed in scene units per second. Shoppers and the player share it. */
export const MALL_WALK_SPEED = 2.2;

/**
 * The most distance a player can bank while idle. A long pause never buys a long jump: the
 * allowance is capped here, so the most a single report can cover is this many units.
 */
export const MALL_MOVE_BURST = 1.5;

/** Spacing of the points checked along a move, so no shelf can be crossed between two checks. */
const SEGMENT_STEP = 0.1;

/**
 * Walker state for anything that follows a list of waypoints. Dwell times pause the walker
 * at a waypoint, such as a shopper browsing a shelf or paying at a till.
 */
export type MallWalker = {
  points: readonly WalkPoint[];
  next: number;
  pos: WalkPoint;
  speed: number;
  /** Waypoint index → seconds to pause after reaching it. */
  dwellAt: ReadonlyMap<number, number>;
  dwellLeft: number;
  moving: boolean;
  done: boolean;
};

export function createWalker(
  start: WalkPoint,
  points: readonly WalkPoint[],
  options: { speed?: number; dwellAt?: ReadonlyMap<number, number> } = {},
): MallWalker {
  return {
    points,
    next: 0,
    pos: start,
    speed: options.speed ?? MALL_WALK_SPEED,
    dwellAt: options.dwellAt ?? new Map(),
    dwellLeft: 0,
    moving: false,
    done: points.length === 0,
  };
}

/** Advances a walker by `dt` seconds. Pure: returns a new state, never mutates the old one. */
export function stepWalker(walker: MallWalker, dt: number): MallWalker {
  if (walker.done) return walker.moving ? { ...walker, moving: false } : walker;
  if (walker.dwellLeft > 0) {
    const left = Math.max(0, walker.dwellLeft - dt);
    return {
      ...walker,
      dwellLeft: left,
      moving: false,
      done: left === 0 && walker.next >= walker.points.length,
    };
  }
  const target = walker.points[walker.next];
  if (!target) return { ...walker, moving: false, done: true };
  const dx = target[0] - walker.pos[0];
  const dz = target[1] - walker.pos[1];
  const distance = Math.hypot(dx, dz);
  const step = walker.speed * dt;
  if (step < distance) {
    const t = step / distance;
    return {
      ...walker,
      pos: [walker.pos[0] + dx * t, walker.pos[1] + dz * t],
      moving: true,
    };
  }
  const reached = walker.next + 1;
  const dwell = walker.dwellAt.get(walker.next) ?? 0;
  return {
    ...walker,
    pos: target,
    next: reached,
    dwellLeft: dwell,
    moving: false,
    done: reached >= walker.points.length && dwell === 0,
  };
}

/** True when every point along the straight line from `from` to `to` can be walked. */
export function isSegmentWalkable(from: WalkPoint, to: WalkPoint): boolean {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const steps = Math.max(1, Math.ceil(distance / SEGMENT_STEP));
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const point: WalkPoint = [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
    if (!canWalkInMall(point)) return false;
  }
  return true;
}

export type MallMoveResult =
  | { ok: true; allowance: number }
  | { ok: false; reason: "blocked" | "speed" };

/**
 * Checks one reported move. The allowance grows with time up to the burst limit and is spent
 * by the distance moved. The whole route must be walkable, not only its end point.
 */
export function checkMallMove(
  allowance: number,
  from: WalkPoint,
  to: WalkPoint,
  elapsedSeconds: number,
): MallMoveResult {
  if (!isSegmentWalkable(from, to)) return { ok: false, reason: "blocked" };
  const available = Math.min(
    MALL_MOVE_BURST,
    allowance + MALL_WALK_SPEED * Math.max(0, elapsedSeconds),
  );
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (distance > available) return { ok: false, reason: "speed" };
  return { ok: true, allowance: available - distance };
}

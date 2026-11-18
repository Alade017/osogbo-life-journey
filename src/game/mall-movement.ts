import { canWalkInMall } from "./osun-mall-layout";
import type { WalkPoint } from "./grid-walk-path";

/** Walking speed in scene units per second. Shoppers and the player share it. */
export const MALL_WALK_SPEED = 2.2;

/** A small allowance on top of the speed limit, for network delay and frame timing. */
const MOVE_TOLERANCE = 0.6;

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

/**
 * Whether a move a client reports is possible: the destination must be walkable, and the
 * distance covered must fit the walking speed over the time since the last accepted position.
 */
export function isPossibleMallMove(
  from: WalkPoint,
  to: WalkPoint,
  elapsedSeconds: number,
): boolean {
  if (!canWalkInMall(to)) return false;
  const allowed = MALL_WALK_SPEED * Math.max(0, elapsedSeconds) + MOVE_TOLERANCE;
  return Math.hypot(to[0] - from[0], to[1] - from[1]) <= allowed;
}

import { useEffect, useRef, useState } from "react";
import { findRoomPath, type RoomObstacle, type RoomPoint } from "@/game/house-navigation";

export type CourierHeading = "north" | "south" | "east" | "west";

/** Courier walking speed, in room metres per second. */
export const COURIER_WALK_SPEED = 1.2;

export function routeLength(route: RoomPoint[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!,
      b = route[i]!;
    total += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  return total;
}

/** The compass direction of a step, as the character's facing. */
export function headingBetween(from: RoomPoint, to: RoomPoint): CourierHeading {
  const dx = to[0] - from[0],
    dz = to[2] - from[2];
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? "east" : "west";
  return dz > 0 ? "south" : "north";
}

/** Where the courier is after walking `distance` metres along the route. */
export function pointAlongRoute(
  route: RoomPoint[],
  distance: number,
): { point: RoomPoint; heading: CourierHeading } {
  const first = route[0] ?? [0, 0.06, 0];
  if (route.length < 2) return { point: first, heading: "south" };
  let remaining = Math.max(0, distance);
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1]!,
      b = route[i]!;
    const length = Math.hypot(b[0] - a[0], b[2] - a[2]);
    const heading = headingBetween(a, b);
    if (remaining <= length && length > 0) {
      const t = remaining / length;
      return {
        point: [a[0] + (b[0] - a[0]) * t, b[1], a[2] + (b[2] - a[2]) * t],
        heading,
      };
    }
    remaining -= length;
  }
  const last = route[route.length - 1]!;
  return { point: last, heading: headingBetween(route[route.length - 2]!, last) };
}

/**
 * A walk from one point to another that goes around furniture and walls. Falls back to a straight
 * line only when the room has no open path, so the courier never stands still in the wrong place.
 */
export function courierRoute(
  from: RoomPoint,
  to: RoomPoint,
  width: number,
  depth: number,
  obstacles: RoomObstacle[],
): RoomPoint[] {
  const path = findRoomPath(from, to, width, depth, obstacles, true) ?? [];
  const route: RoomPoint[] = [from, ...path];
  const end = route[route.length - 1]!;
  if (Math.hypot(end[0] - to[0], end[2] - to[2]) > 0.01) route.push(to);
  return route;
}

/**
 * Walks a character along a route at a steady speed. Re-runs only when the route's points change.
 * With reduced motion, or a route of zero length, it jumps straight to the end.
 */
export function useCourierWalk(
  route: RoomPoint[],
  speed: number = COURIER_WALK_SPEED,
  onArrive?: () => void,
): { point: RoomPoint; heading: CourierHeading; done: boolean } {
  const key = route.map((point) => point.join(",")).join("|");
  const routeRef = useRef(route);
  routeRef.current = route;
  const arriveRef = useRef(onArrive);
  arriveRef.current = onArrive;
  const [state, setState] = useState(() => {
    const sample = pointAlongRoute(route, 0);
    return { ...sample, done: routeLength(route) === 0 };
  });

  useEffect(() => {
    const current = routeRef.current;
    const total = routeLength(current);
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced || total === 0 ? 0 : (total / speed) * 1000;
    const startedAt = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const sample = pointAlongRoute(current, total * progress);
      setState({ ...sample, done: progress >= 1 });
      if (progress < 1) frame = window.requestAnimationFrame(step);
      else arriveRef.current?.();
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [key, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

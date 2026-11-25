import type { WalkPoint } from "./grid-walk-path.ts";
import { findStreetPath, canWalkOnStreet, STREET_PEDESTRIANS } from "./osun-mall-street-layout.ts";
import { MALL_BODY_RADIUS } from "./osun-mall-layout.ts";

export type PassengerPhase = "walking" | "approaching" | "mounting" | "mounted" | "dismounting";
export const OKADA_SEAT = { height: 0.65, thickness: 0.12, centerZ: -0.22, length: 0.65 } as const;
export const PASSENGER_SEAT_Z = OKADA_SEAT.centerZ - OKADA_SEAT.length / 4;
export const MOUNT_SECONDS = 0.8;

export function bikePoint(pos: WalkPoint, yaw: number, x: number, z: number): WalkPoint {
  return [pos[0] + x * Math.cos(yaw) + z * Math.sin(yaw), pos[1] - x * Math.sin(yaw) + z * Math.cos(yaw)];
}
export function boardingPath(from: WalkPoint, bike: WalkPoint, yaw: number): WalkPoint[] | null {
  const clearance = MALL_BODY_RADIUS * 3;
  const candidates = [-1, 1].map(side => bikePoint(bike, yaw, side * clearance, PASSENGER_SEAT_Z));
  for (const point of candidates.sort((a,b) => Math.hypot(a[0]-from[0],a[1]-from[1])-Math.hypot(b[0]-from[0],b[1]-from[1]))) {
    if (!canWalkOnStreet(point) || STREET_PEDESTRIANS.some(other => Math.hypot(point[0]-other[0],point[1]-other[1]) < MALL_BODY_RADIUS*2)) continue;
    const path = findStreetPath(from, point);
    if (path) return path;
  }
  return null;
}
export function mountProgress(elapsed: number): number {
  const t = Math.max(0, Math.min(1, elapsed / MOUNT_SECONDS));
  return t*t*(3-2*t);
}

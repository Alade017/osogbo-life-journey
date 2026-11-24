import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

export type ElectronicsStoreId = "post-office-cafe" | "harvest-tech-hub";
export const RETAIL_ROOM = { width: 14, depth: 16, clearance: 0.35, entranceWidth: 2.4, spawn: [0, 6.5] as WalkPoint, doorway: [0, 7.5] as WalkPoint } as const;
export type RetailDisplay = { x: number; z: number; width: number; depth: number };
export function electronicsDisplays(count: number): RetailDisplay[] {
  return Array.from({ length: count }, (_, index) => ({
    x: index % 2 === 0 ? -4 : 4,
    z: -5.5 + Math.floor(index / 2) * (11 / Math.max(1, Math.ceil(count / 2) - 1)),
    width: 3.1,
    depth: 1.1,
  }));
}
export const RETAIL_COUNTER: RetailDisplay = { x: 0, z: -6.8, width: 2.8, depth: 0.9 };
export function electronicsNavigation(displays: readonly RetailDisplay[]) {
  const obstacles = [...displays, RETAIL_COUNTER];
  const canWalk = ([x, z]: WalkPoint) =>
    Number.isFinite(x) && Number.isFinite(z) &&
    Math.abs(x) < RETAIL_ROOM.width / 2 - RETAIL_ROOM.clearance &&
    Math.abs(z) < RETAIL_ROOM.depth / 2 - RETAIL_ROOM.clearance &&
    obstacles.every((o) => Math.abs(x - o.x) > o.width / 2 + RETAIL_ROOM.clearance ||
      Math.abs(z - o.z) > o.depth / 2 + RETAIL_ROOM.clearance);
  const route = (from: WalkPoint, to: WalkPoint) => findGridWalkPath(from, to, canWalk);
  const approach = (from: WalkPoint, index: number) => {
    const d = displays[index];
    if (!d) return null;
    return route(from, [d.x - Math.sign(d.x) * (d.width / 2 + 0.85), d.z]);
  };
  return { route, approach, canWalk };
}

import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

export const SHOWROOM_LAYOUT = {
  width: 16,
  depth: 18,
  entrance: [0, 7.5] as WalkPoint,
  clearance: 0.35,
  entranceWidth: 3,
  exteriorSpawn: [0, 12] as WalkPoint,
  exteriorDoor: [0, 9.5] as WalkPoint,
  displayWidth: 3.6,
  displayDepth: 5.8,
} as const;

export const SHOWROOM_BAYS = [
  { x: -4, z: -4 },
  { x: 4, z: -4 },
  { x: -4, z: 4 },
  { x: 4, z: 4 },
] as const;

export const SHOWROOM_RECEPTION = { x: 5.6, z: -7.5, width: 3, depth: 1.1 };

export function showroomNavigation() {
  const layout = SHOWROOM_LAYOUT;
  const obstacles = [
    ...SHOWROOM_BAYS.map((bay) => ({ ...bay, width: layout.displayWidth, depth: layout.displayDepth })),
    SHOWROOM_RECEPTION,
  ];
  const canWalk = ([x, z]: WalkPoint) =>
    Number.isFinite(x) && Number.isFinite(z) &&
    Math.abs(x) < layout.width / 2 - layout.clearance &&
    Math.abs(z) < layout.depth / 2 - layout.clearance &&
    obstacles.every((o) =>
      Math.abs(x - o.x) > o.width / 2 + layout.clearance ||
      Math.abs(z - o.z) > o.depth / 2 + layout.clearance);
  const route = (from: WalkPoint, to: WalkPoint) => findGridWalkPath(from, to, canWalk);
  function approach(from: WalkPoint, bayIndex: number) {
    const bay = SHOWROOM_BAYS[bayIndex];
    if (!bay) return null;
    const target: WalkPoint = [bay.x - Math.sign(bay.x) * (layout.displayWidth / 2 + 0.85), bay.z];
    return route(from, target);
  }
  return { canWalk, route, approach };
}

/** The forecourt is walkable; the building and road are not. */
export function showroomExteriorRoute(from: WalkPoint, to: WalkPoint) {
  const front = SHOWROOM_LAYOUT.depth / 2;
  return findGridWalkPath(from, to, ([x, z]) =>
    Number.isFinite(x) && Number.isFinite(z) &&
    Math.abs(x) <= SHOWROOM_LAYOUT.width / 2 &&
    z >= front + 0.5 && z <= front + 3
  );
}

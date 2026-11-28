import type { WorshipLayout } from "./worship-layouts";
import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

const PLAYER_CLEARANCE = 0.32;
const COLUMN_RADIUS = 0.52;
const CONGREGANT_RADIUS = 0.42;

/** Collision-aware navigation for worship halls. Mats remain walkable; pews, columns,
 * congregation members, the focal structure and closed wall sections are obstacles. */
export function worshipNavigation(layout: WorshipLayout) {
  const halfW = layout.hall.width / 2;
  const halfD = layout.hall.depth / 2;
  const obstacles = [
    ...layout.columns.map(([x, z]) => ({ x, z, radius: COLUMN_RADIUS })),
    ...layout.congregation.map(([x, z]) => ({ x, z, radius: CONGREGANT_RADIUS })),
    ...(layout.faith === "church"
      ? layout.rows.flatMap((row) => row.xs.map((x) => ({ x, z: row.z, width: 3.6, depth: 0.7 })))
      : []),
    { x: layout.focal.x, z: layout.focal.z + 0.25, width: layout.faith === "church" ? 3.4 : 2.6, depth: 1.1 },
  ];
  const canWalk = ([x, z]: WalkPoint) => {
    if (!Number.isFinite(x) || !Number.isFinite(z)) return false;
    if (Math.abs(x) >= halfW - PLAYER_CLEARANCE || z <= -halfD + PLAYER_CLEARANCE) return false;
    if (z >= halfD - PLAYER_CLEARANCE && Math.abs(x) > 1.1 - PLAYER_CLEARANCE) return false;
    return obstacles.every((obstacle) => {
      if ("radius" in obstacle) {
        return Math.hypot(x - obstacle.x, z - obstacle.z) >
          obstacle.radius + PLAYER_CLEARANCE;
      }
      return Math.abs(x - obstacle.x) > obstacle.width / 2 + PLAYER_CLEARANCE ||
        Math.abs(z - obstacle.z) > obstacle.depth / 2 + PLAYER_CLEARANCE;
    });
  };
  const route = (from: WalkPoint, to: WalkPoint) =>
    findGridWalkPath(from, to, canWalk);
  const nearest = (point: WalkPoint): WalkPoint | null => {
    if (canWalk(point)) return point;
    for (let radius = 0.5; radius <= 3; radius += 0.5) {
      for (let step = 0; step < 16; step++) {
        const angle = (step / 16) * Math.PI * 2;
        const candidate: WalkPoint = [
          Math.round((point[0] + Math.cos(angle) * radius) * 2) / 2,
          Math.round((point[1] + Math.sin(angle) * radius) * 2) / 2,
        ];
        if (canWalk(candidate)) return candidate;
      }
    }
    return null;
  };
  const prayerTarget = nearest(layout.prayerSpot);
  return { canWalk, route, nearest, prayerTarget };
}

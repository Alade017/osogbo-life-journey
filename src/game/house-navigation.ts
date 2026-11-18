import type { HousePlacement, HouseSlot } from "@/components/game/housing/HouseRoomScene";
import {
  housePartitionSegmentsForFloor,
  houseSlotPosition,
  roomPercentToPosition,
  houseRearDoorCenter,
  houseStairs,
  stairTraversalPath,
  HOUSE_STAIR_RISE,
  type HouseStairs,
} from "@/components/game/housing/house-room-contract";
export type RoomPoint = [number, number, number];
export type RoomObstacle = { x: number; z: number; w: number; d: number; wall?: boolean };

/** Keep the raised stair animation on the ground-floor scene, then land on a flat floor. */
export async function runHouseStairTransition({
  stairs,
  fromFloor,
  approach,
  walk,
  setFloor,
  place,
}: {
  stairs: HouseStairs;
  fromFloor: 0 | 1;
  approach: (point: RoomPoint) => Promise<boolean>;
  walk: (path: RoomPoint[]) => Promise<boolean>;
  setFloor: (floor: 0 | 1) => void;
  place: (point: RoomPoint) => void;
}): Promise<boolean> {
  const up = fromFloor === 0,
    from = up ? stairs.bottom : stairs.top;
  if (!(await approach([from[0], 0.06, from[1]]))) return false;
  if (!up) {
    setFloor(0);
    place([stairs.top[0], 0.06 + HOUSE_STAIR_RISE, stairs.top[1]]);
  }
  if (!(await walk(stairTraversalPath(stairs, up)))) {
    setFloor(0);
    place([stairs.bottom[0], 0.06, stairs.bottom[1]]);
    return false;
  }
  const landing = up ? stairs.top : stairs.bottom;
  setFloor(up ? 1 : 0);
  place([landing[0], 0.06, landing[1]]);
  return true;
}
export function placementPoint(
  item: HousePlacement,
  slots: HouseSlot[],
  width: number,
  depth: number,
): RoomPoint {
  if (item.x !== undefined && item.y !== undefined)
    return roomPercentToPosition(item.x, item.y, width, depth);
  const slot = slots.find((s) => s.id === item.slot);
  return slot ? houseSlotPosition(slot, width, depth) : [0, 0.06, 0];
}
export function packagePoint(
  index: number,
  width: number,
  depth: number,
  houseTypeId = "shared-room",
  inside = true,
): RoomPoint {
  return [
    (inside ? width * 0.13 : houseRearDoorCenter(houseTypeId, width)) + index * 0.5,
    0.06,
    -depth / 2 + (inside ? 1.35 : 0.2),
  ];
}

/** Identify saved items intersecting a redesigned wall without rewriting any saved positions. */
export function placementsOverlappingWalls(
  type: string,
  width: number,
  depth: number,
  placements: HousePlacement[],
  slots: HouseSlot[],
  floor: 0 | 1 = 0,
): HousePlacement[] {
  const walls = roomObstacles(type, width, depth, [], slots, floor);
  return placements.filter((item) => {
    if (item.art_key.startsWith("wall-art")) return false;
    const furniture = furnitureObstacle(item, slots, width, depth);
    return walls.some(
      (wall) =>
        Math.abs(furniture.x - wall.x) < (furniture.w + wall.w) / 2 &&
        Math.abs(furniture.z - wall.z) < (furniture.d + wall.d) / 2,
    );
  });
}
function furnitureObstacle(
  p: HousePlacement,
  slots: HouseSlot[],
  width: number,
  depth: number,
): RoomObstacle {
  const point = placementPoint(p, slots, width, depth);
  const [w, d] =
    p.slot_type === "bed"
      ? [1.45, 2.1]
      : p.art_key === "sofa"
        ? [1.8, 0.85]
        : p.art_key === "plant"
          ? [0.45, 0.45]
          : [0.8, 0.75];
  const angle = ((p.rotation_deg ?? 0) * Math.PI) / 180;
  const c = Math.abs(Math.cos(angle)),
    s = Math.abs(Math.sin(angle));
  return { x: point[0], z: point[2], w: w! * c + d! * s, d: w! * s + d! * c };
}
export function roomObstacles(
  type: string,
  width: number,
  depth: number,
  placements: HousePlacement[],
  slots: HouseSlot[],
  floor: 0 | 1 = 0,
): RoomObstacle[] {
  const stairs = houseStairs(type, width, depth);
  return [
    ...(stairs
      ? [
          {
            x: (stairs.x0 + stairs.x1) / 2,
            z: (stairs.z0 + stairs.z1) / 2,
            w: stairs.x1 - stairs.x0,
            d: stairs.z1 - stairs.z0,
            wall: true,
          },
        ]
      : []),
    ...housePartitionSegmentsForFloor(type, width, depth, floor).map((s) => ({
      x: s.position[0],
      z: s.position[2],
      w: s.size[0],
      d: s.size[2],
      wall: true,
    })),
    ...placements.map((p) => furnitureObstacle(p, slots, width, depth)),
  ];
}
/** Four-way grid search: diagonal shortcuts cannot clip furniture or doorway corners. */
export function findRoomPath(
  start: RoomPoint,
  target: RoomPoint,
  width: number,
  depth: number,
  obstacles: RoomObstacle[],
  interact = false,
): RoomPoint[] | null {
  if (![...start, ...target, width, depth].every(Number.isFinite)) return null;
  const step = 0.2,
    margin = 0.3,
    cols = Math.floor((width - 2 * margin) / step) + 1,
    rows = Math.floor((depth - 2 * margin) / step) + 1;
  const point = (i: number): RoomPoint => [
    -width / 2 + margin + (i % cols) * step,
    0.06,
    -depth / 2 + margin + Math.floor(i / cols) * step,
  ];
  const blocked = (i: number) => {
    const [x, , z] = point(i);
    return obstacles.some(
      (o) => Math.abs(x - o.x) < o.w / 2 + 0.2 && Math.abs(z - o.z) < o.d / 2 + 0.2,
    );
  };
  const nearest = (p: RoomPoint) => {
    let best = -1,
      distance = Infinity;
    for (let i = 0; i < cols * rows; i++) {
      if (blocked(i)) continue;
      const q = point(i),
        d = Math.hypot(q[0] - p[0], q[2] - p[2]);
      if (d < distance) {
        best = i;
        distance = d;
      }
    }
    return best;
  };
  if (
    !interact &&
    (Math.abs(target[0]) > width / 2 - margin || Math.abs(target[2]) > depth / 2 - margin)
  )
    return null;
  const origin = nearest(start);
  if (origin < 0) return null;
  // Search reachable space first, then choose the nearest reachable interaction spot.
  const queue = [origin],
    parents = new Map<number, number>([[origin, -1]]);
  let cursor = 0;
  while (cursor < queue.length) {
    const current = queue[cursor++]!;
    const col = current % cols,
      row = Math.floor(current / cols);
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const c = col + dc!,
        r = row + dr!;
      if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
      const next = r * cols + c;
      if (parents.has(next) || blocked(next)) continue;
      parents.set(next, current);
      queue.push(next);
    }
  }
  let end = -1,
    distance = Infinity;
  for (const i of queue) {
    const p = point(i),
      d = Math.hypot(p[0] - target[0], p[2] - target[2]);
    if (d >= distance) continue;
    if (
      interact &&
      obstacles.some((o) => {
        if (!o.wall) return false;
        const samples = Math.max(1, Math.ceil(d / 0.04));
        for (let j = 0; j <= samples; j++) {
          const x = p[0] + ((target[0] - p[0]) * j) / samples;
          const z = p[2] + ((target[2] - p[2]) * j) / samples;
          if (Math.abs(x - o.x) < o.w / 2 && Math.abs(z - o.z) < o.d / 2) return true;
        }
        return false;
      })
    )
      continue;
    if (d < distance) {
      end = i;
      distance = d;
    }
  }
  if (end < 0 || (!interact && distance > 0.35) || (interact && distance > 1.65)) return null;
  const path: RoomPoint[] = [];
  for (let i = end; i !== -1; i = parents.get(i) ?? -1) path.unshift(point(i));
  // Start positions are maintained on navigable cells. Snap only when a layout change displaced the actor.
  return path;
}

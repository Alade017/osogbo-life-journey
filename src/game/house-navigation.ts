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

/** Maximum time allowed for the scripted walk from the doorway into the home. */
export const HOME_ENTRY_WALK_TIMEOUT_MS = 12_000;

/**
 * Run the entry walk with a bounded recovery path. A stalled/cancelled animation must
 * never leave the global transition veil active indefinitely or strand the actor outside.
 */
export async function runHomeEntryWalk({
  path,
  walk,
  cancel,
  place,
  fallback,
  timeoutMs = HOME_ENTRY_WALK_TIMEOUT_MS,
}: {
  path: RoomPoint[];
  walk: (path: RoomPoint[]) => Promise<boolean>;
  cancel: () => void;
  place: (point: RoomPoint) => void;
  fallback: RoomPoint;
  timeoutMs?: number;
}): Promise<boolean> {
  let timedOut = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutResult = new Promise<boolean>((resolve) => {
    timeout = setTimeout(() => {
      timedOut = true;
      cancel();
      place(fallback);
      resolve(false);
    }, timeoutMs);
  });

  try {
    const arrived = await Promise.race([walk(path), timeoutResult]);
    if (!arrived && !timedOut) place(fallback);
    return arrived;
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
}

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
export function furnitureObstacle(
  p: HousePlacement,
  slots: HouseSlot[],
  width: number,
  depth: number,
): RoomObstacle {
  const point = placementPoint(p, slots, width, depth);
  const key = p.art_key.replace(/^starter-/, "");
  const footprints: Record<string, readonly [number, number]> = {
    bed: [1.45, 2.1],
    sofa: [1.8, 0.85],
    "sofa-2": [1.8, 0.85],
    seat: [1.8, 0.85],
    plant: [0.45, 0.45],
    light: [0.42, 0.42],
    treadmill: [0.75, 1.55],
    "multi-gym-machine": [1, 1],
    dumbbells: [0.5, 0.65],
    "yoga-mat": [0.75, 1.7],
    shower: [1, 1],
    wardrobe: [1.15, 0.65],
    computer: [1.25, 0.8],
    "dining-table": [1.4, 1.4],
  };
  const [w, d] = footprints[key] ?? (p.slot_type === "bed" ? footprints["bed"]! : [0.8, 0.75]);
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
    ...placements
      .filter((p) => !p.art_key.startsWith("wall-art"))
      .map((p) => furnitureObstacle(p, slots, width, depth)),
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
  const isBlocked = Array.from({ length: cols * rows }, (_, i) => blocked(i));
  // Label each open region. A pocket walled in by furniture is too small to leave, so searching from
  // inside it would fail every time. Such a character is routed from the largest open region instead.
  const region = new Int32Array(cols * rows).fill(-1);
  const regionSize: number[] = [];
  for (let i = 0; i < cols * rows; i++) {
    if (isBlocked[i] || region[i] !== -1) continue;
    const id = regionSize.length;
    let size = 0;
    const stack = [i];
    region[i] = id;
    while (stack.length) {
      const current = stack.pop()!;
      size++;
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
        if (isBlocked[next] || region[next] !== -1) continue;
        region[next] = id;
        stack.push(next);
      }
    }
    regionSize.push(size);
  }
  if (regionSize.length === 0) return null;
  const largestRegion = regionSize.indexOf(Math.max(...regionSize));
  const nearest = (p: RoomPoint, onlyRegion?: number) => {
    let best = -1,
      distance = Infinity;
    for (let i = 0; i < cols * rows; i++) {
      if (isBlocked[i] || (onlyRegion !== undefined && region[i] !== onlyRegion)) continue;
      const q = point(i),
        d = Math.hypot(q[0] - p[0], q[2] - p[2]);
      if (d < distance) {
        best = i;
        distance = d;
      }
    }
    return best;
  };
  // A floor tap in the wall band (inside the room, closer to a wall than the walkway margin) walks to the
  // nearest walkable spot instead of failing: the floor there is walkable, only the grid stops short of it.
  let aim: RoomPoint = target;
  if (!interact && Math.abs(target[0]) <= width / 2 && Math.abs(target[2]) <= depth / 2) {
    const limitX = width / 2 - margin,
      limitZ = depth / 2 - margin;
    aim = [
      Math.max(-limitX, Math.min(limitX, target[0])),
      target[1],
      Math.max(-limitZ, Math.min(limitZ, target[2])),
    ];
  }
  if (!interact && (Math.abs(aim[0]) > width / 2 - margin || Math.abs(aim[2]) > depth / 2 - margin))
    return null;
  // Routes always start in the largest open region. A character standing in a smaller region is
  // walled off from the rest of the room, so the nearest cell in the largest region is where it leaves from.
  const origin = nearest(start, largestRegion);
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
      if (parents.has(next) || isBlocked[next]) continue;
      parents.set(next, current);
      queue.push(next);
    }
  }
  let end = -1,
    distance = Infinity;
  for (const i of queue) {
    const p = point(i),
      d = Math.hypot(p[0] - aim[0], p[2] - aim[2]);
    if (d >= distance) continue;
    if (
      interact &&
      obstacles.some((o) => {
        if (!o.wall) return false;
        const samples = Math.max(1, Math.ceil(d / 0.04));
        for (let j = 0; j <= samples; j++) {
          const x = p[0] + ((aim[0] - p[0]) * j) / samples;
          const z = p[2] + ((aim[2] - p[2]) * j) / samples;
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

import type { HousePlacement, HouseSlot } from "@/components/game/housing/HouseRoomScene";
import {
  HOUSE_ROOM_SIZE,
  HOUSE_GRID_SIZE,
  houseGridCellCenter,
  isWallArtKind,
  houseDoorThreshold,
  houseRoomViews,
  houseStairs,
  roomViewContains,
  type HouseRoomView,
} from "@/components/game/housing/house-room-contract";
import {
  findRoomPath,
  furnitureObstacle,
  placementPoint,
  roomObstacles,
  type RoomPoint,
  type RoomObstacle,
} from "./house-navigation";

export type ArrangementMove = {
  id: string;
  x: number;
  y: number;
  floor: 0 | 1;
  rotation_deg: number;
};
const overlaps = (a: RoomObstacle, b: RoomObstacle, gap = 0) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + gap;
function preferred(item: HousePlacement, room: HouseRoomView) {
  const key = `${item.item_id} ${item.art_key} ${item.slot_type}`;
  const rooms = /bed/.test(key)
    ? ["bedroom", "bedroom-2", "bedroom-3"]
    : /shower|toilet|bath|sink/.test(key)
      ? ["bathroom", "ensuite"]
      : /gym|treadmill|weight|exercise|fitness/.test(key)
        ? ["gym"]
        : /stove|fridge|cooker/.test(key)
          ? ["kitchen"]
          : /computer|desk/.test(key)
            ? ["study", "bedroom"]
            : /dining/.test(key)
              ? ["dining", "kitchen"]
              : ["sitting", "family", "room"];
  return rooms.includes(room.id) ? 0 : room.id === "room" ? 1 : 3;
}
/** Plan all moves before writing anything. Every doorway, room and item stays reachable.
 * Only existing placements are moved; inventory quantities and item identities never change. */
export function planHouseArrangement(
  type: string,
  placements: HousePlacement[],
  slots: HouseSlot[],
): ArrangementMove[] | null {
  const dimensions = HOUSE_ROOM_SIZE[type];
  if (!dimensions || placements.length > 128) return null;
  const [width, depth] = dimensions;
  const floors: Array<0 | 1> = type === "duplex" ? [0, 1] : [0];
  const stairs = houseStairs(type, width, depth);
  const entry = (floor: 0 | 1): RoomPoint =>
    floor === 1 && stairs
      ? [stairs.top[0], 0.06, stairs.top[1]]
      : houseDoorThreshold(type, width, depth);
  const walls = floors.map((floor) => roomObstacles(type, width, depth, [], slots, floor));
  const rooms = floors.map((floor) => houseRoomViews(type, width, depth, floor));
  // Use reachable empty-room anchors, rather than a bedroom centre that may be furnished later.
  const anchors = floors.map((floor) =>
    rooms[floor]!.flatMap((room) => {
      const centre: RoomPoint = [(room.minX + room.maxX) / 2, 0.06, (room.minZ + room.maxZ) / 2];
      const path = findRoomPath(entry(floor), centre, width, depth, walls[floor]!);
      return path?.length ? [path[path.length - 1]!] : [];
    }),
  );
  const sorted = [...placements].sort((a, b) => {
    const area = (p: HousePlacement) => {
      const o = furnitureObstacle(p, slots, width, depth);
      return o.w * o.d;
    };
    return area(b) - area(a) || a.id.localeCompare(b.id);
  });
  const placed: HousePlacement[] = [];
  for (const item of sorted) {
    const needsDedicatedRoom =
      /bed|shower|toilet|bath|stove|fridge|cooker|gym|treadmill|weight|exercise|fitness/.test(
        `${item.item_id} ${item.art_key} ${item.slot_type}`,
      ) && rooms.flat().some((room) => preferred(item, room) === 0);
    const candidates: Array<{ item: HousePlacement; score: number }> = [];
    for (const floor of floors)
      for (let ix = 0; ix < HOUSE_GRID_SIZE; ix++)
        for (let iy = 0; iy < HOUSE_GRID_SIZE; iy++) {
          for (const rotation of [0, 90, 180, 270]) {
            if (isWallArtKind(item.art_key) && (iy !== HOUSE_GRID_SIZE - 1 || rotation !== 0))
              continue;
            const [xPercent, yPercent] = houseGridCellCenter(ix, iy);
            const candidate = {
              ...item,
              x: xPercent,
              y: yPercent,
              floor,
              rotation_deg: rotation,
            };
            const [x, , z] = placementPoint(candidate, slots, width, depth);
            const room = rooms[floor]!.find((r) => roomViewContains(r, x, z));
            if (!room || ["hallway", "landing", "balcony"].includes(room.id)) continue;
            if (needsDedicatedRoom && preferred(item, room) !== 0) continue;
            const o = furnitureObstacle(candidate, slots, width, depth);
            if (
              Math.abs(x) + o.w / 2 > width / 2 - 0.12 ||
              Math.abs(z) + o.d / 2 > depth / 2 - 0.12
            )
              continue;
            if (walls[floor]!.some((w) => overlaps(o, w, 0.08))) continue;
            if (
              placed.some(
                (p) =>
                  (p.floor ?? 0) === floor &&
                  overlaps(o, furnitureObstacle(p, slots, width, depth), 0.12),
              )
            )
              continue;
            const nearWall = Math.min(
              x - room.minX - o.w / 2,
              room.maxX - x - o.w / 2,
              z - room.minZ - o.d / 2,
              room.maxZ - z - o.d / 2,
            );
            candidates.push({
              item: candidate,
              score: preferred(item, room) * 100 + nearWall + rotation / 10000 + floor / 1000,
            });
          }
        }
    candidates.sort((a, b) => a.score - b.score);
    const chosen = candidates.find(({ item: candidate }) => {
      const floor = candidate.floor as 0 | 1;
      const next = [...placed.filter((p) => (p.floor ?? 0) === floor), candidate];
      const obstacles = roomObstacles(type, width, depth, next, slots, floor);
      const start = entry(floor),
        startBox = { x: start[0], z: start[2], w: 0.55, d: 0.55 };
      if (overlaps(furnitureObstacle(candidate, slots, width, depth), startBox, 0.2)) return false;
      if (stairs) {
        const landing = floor ? stairs.top : stairs.bottom;
        if (
          overlaps(
            furnitureObstacle(candidate, slots, width, depth),
            { x: landing[0], z: landing[1], w: 0.6, d: 0.6 },
            0.2,
          )
        )
          return false;
      }
      // Room anchors may be occupied, but must remain accessible from the same doorway.
      return (
        anchors[floor]!.every(
          (point) => !!findRoomPath(start, point, width, depth, obstacles, true),
        ) &&
        next.every(
          (p) =>
            !!findRoomPath(
              start,
              placementPoint(p, slots, width, depth),
              width,
              depth,
              obstacles,
              true,
            ),
        )
      );
    });
    if (!chosen) return null;
    placed.push(chosen.item);
  }
  return placed.map((p) => ({
    id: p.id,
    x: p.x!,
    y: p.y!,
    floor: p.floor as 0 | 1,
    rotation_deg: p.rotation_deg!,
  }));
}

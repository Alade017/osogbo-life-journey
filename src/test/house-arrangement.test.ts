import { describe, expect, it } from "vitest";
import { planHouseArrangement } from "@/game/house-arrangement";
import {
  HOUSE_ROOM_SIZE,
  houseDoorThreshold,
  houseRoomViews,
  roomViewContains,
} from "@/components/game/housing/house-room-contract";
import {
  findRoomPath,
  furnitureObstacle,
  placementPoint,
  roomObstacles,
} from "@/game/house-navigation";
import type { HousePlacement } from "@/components/game/housing/HouseRoomScene";
const items = [
  ["bed", "bed"],
  ["sofa", "seat"],
  ["light", "light"],
  ["toilet", "bathroom"],
  ["shower", "bathroom"],
  ["stove", "kitchen"],
  ["tv", "electronics"],
];
const fixture = items.map(([art_key, slot_type], i): HousePlacement => ({
  id: `item-${i}`,
  item_id: art_key!,
  art_key: art_key!,
  slot_type: slot_type!,
  category: "furniture",
  slot: `slot-${i}`,
  x: 50,
  y: 50,
}));
describe("walkable furniture rearrangement", () => {
  it.each(Object.keys(HOUSE_ROOM_SIZE))(
    "rebuilds a disarranged %s without losing items or blocking the entrance",
    (type) => {
      const plan = planHouseArrangement(type, fixture, []);
      expect(plan).not.toBeNull();
      expect(plan!.map((p) => p.id).sort()).toEqual(fixture.map((p) => p.id).sort());
      const placed = fixture.map((p) => ({ ...p, ...plan!.find((m) => m.id === p.id)! }));
      const [w, d] = HOUSE_ROOM_SIZE[type]!;
      const entrance = houseDoorThreshold(type, w, d);
      for (const item of placed) {
        const views = houseRoomViews(type, w, d, item.floor as 0 | 1);
        const desired =
          item.art_key === "bed"
            ? ["bedroom", "bedroom-2", "bedroom-3"]
            : ["shower", "toilet"].includes(item.art_key)
              ? ["bathroom", "ensuite"]
              : item.art_key === "stove"
                ? ["kitchen"]
                : [];
        if (!views.some((room) => desired.includes(room.id))) continue;
        const point = placementPoint(item, [], w, d);
        expect(
          views.some(
            (room) => desired.includes(room.id) && roomViewContains(room, point[0], point[2]),
          ),
        ).toBe(true);
      }
      const ground = placed.filter((p) => p.floor === 0);
      const obstacles = roomObstacles(type, w, d, ground, []);
      for (const p of ground)
        expect(
          findRoomPath(entrance, placementPoint(p, [], w, d), w, d, obstacles, true),
        ).not.toBeNull();
      for (let a = 0; a < placed.length; a++)
        for (let b = a + 1; b < placed.length; b++) {
          if (placed[a]!.floor !== placed[b]!.floor) continue;
          const x = furnitureObstacle(placed[a]!, [], w, d),
            y = furnitureObstacle(placed[b]!, [], w, d);
          expect(
            Math.abs(x.x - y.x) >= (x.w + y.w) / 2 || Math.abs(x.z - y.z) >= (x.d + y.d) / 2,
          ).toBe(true);
        }
    },
    20000,
  );
  it("fails without partial moves when the home cannot fit the furniture", () => {
    const crowded = Array.from({ length: 30 }, (_, i) => ({ ...fixture[0]!, id: `bed-${i}` }));
    expect(planHouseArrangement("shared-room", crowded, [])).toBeNull();
  });
});

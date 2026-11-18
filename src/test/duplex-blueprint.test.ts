import { describe, expect, it, vi } from "vitest";
import { Box3, Mesh, Raycaster, Vector3 } from "three";
import { duplexBlueprint } from "@/components/game/housing/duplex-blueprint";
import {
  createBlueprintInterior,
  disposeStudioInterior,
} from "@/components/game/housing/studio-interior";
import { createHouseStairModel } from "@/components/game/housing/house-stair-model";
import {
  HOUSE_ROOM_SIZE,
  houseDoorThreshold,
  houseStairs,
  houseRoomViews,
  stairTraversalPath,
  HOUSE_STAIR_RISE,
  roomViewContains,
} from "@/components/game/housing/house-room-contract";
import { findRoomPath, roomObstacles, runHouseStairTransition } from "@/game/house-navigation";
import { guideFor } from "@/components/game/housing/house-arrangement-guide";
const [width, depth] = HOUSE_ROOM_SIZE["duplex"]!;
describe("four-bedroom duplex", () => {
  it("has one guest bedroom downstairs and three bedrooms, an office and balcony upstairs", () => {
    const downstairs = houseRoomViews("duplex", width, depth, 0),
      upstairs = houseRoomViews("duplex", width, depth, 1);
    expect(downstairs.filter((room) => room.id.startsWith("bedroom"))).toHaveLength(1);
    expect(upstairs.filter((room) => room.id.startsWith("bedroom"))).toHaveLength(3);
    expect(upstairs.map((room) => room.id)).toEqual(
      expect.arrayContaining(["study", "balcony", "ensuite", "bathroom", "landing"]),
    );
    expect(upstairs.some((room) => room.id === "kitchen")).toBe(false);
    expect(downstairs.some((room) => room.id === "kitchen")).toBe(true);
    expect(guideFor("kitchen", "stove", "duplex", 1)?.zoneBounds).toBeNull();
    for (const rooms of [downstairs, upstairs])
      for (let x = -width / 2 + 0.13; x < width / 2; x += 0.4)
        for (let z = -depth / 2 + 0.13; z < depth / 2; z += 0.4)
          expect(rooms.filter((room) => roomViewContains(room, x, z, 0))).toHaveLength(1);
  });
  it.each([0, 1] as const)(
    "lands on a flat floor after traversing from floor %s",
    async (fromFloor) => {
      const stairs = houseStairs("duplex", width, depth)!,
        floors: number[] = [],
        positions: number[][] = [];
      const walk = vi.fn(async (path: number[][]) => {
        if (fromFloor === 0) expect(floors).toEqual([]);
        else {
          expect(floors).toEqual([0]);
          expect(positions.at(-1)![1]).toBeCloseTo(0.06 + HOUSE_STAIR_RISE);
        }
        expect(path[0]![1]).toBeCloseTo(fromFloor === 0 ? 0.06 : 0.06 + HOUSE_STAIR_RISE);
        return true;
      });
      expect(
        await runHouseStairTransition({
          stairs,
          fromFloor,
          approach: async () => true,
          walk,
          setFloor: (floor) => floors.push(floor),
          place: (point) => positions.push(point),
        }),
      ).toBe(true);
      expect(floors.at(-1)).toBe(fromFloor === 0 ? 1 : 0);
      expect(positions.at(-1)![1]).toBe(0.06);
    },
  );
  it("returns to the lower landing when stair walking is cancelled", async () => {
    const stairs = houseStairs("duplex", width, depth)!,
      place = vi.fn(),
      setFloor = vi.fn();
    expect(
      await runHouseStairTransition({
        stairs,
        fromFloor: 0,
        approach: async () => true,
        walk: async () => false,
        setFloor,
        place,
      }),
    ).toBe(false);
    expect(setFloor).toHaveBeenLastCalledWith(0);
    expect(place).toHaveBeenLastCalledWith([stairs.bottom[0], 0.06, stairs.bottom[1]]);
  });
  it.each([0, 1] as const)("reaches every room and the stair landing on floor %s", (floor) => {
    const stairs = houseStairs("duplex", width, depth)!;
    const start: [number, number, number] =
      floor === 0
        ? houseDoorThreshold("duplex", width, depth)
        : [stairs.top[0], 0.06, stairs.top[1]];
    const obstacles = roomObstacles("duplex", width, depth, [], [], floor),
      plan = duplexBlueprint(width, depth, floor);
    const scene = createBlueprintInterior("duplex", width, depth, { activeFloor: floor });
    scene.updateMatrixWorld(true);
    for (const wall of plan.partitions)
      expect((scene.getObjectByName(wall.id) as Mesh).position.toArray()).toEqual(wall.position);
    const panels = plan.interiorDoors.map((door) =>
      new Box3().setFromObject(scene.getObjectByName(door.id)!),
    );
    for (const room of plan.rooms) {
      const target: [number, number, number] = [
        (room.minX + room.maxX) / 2,
        0.06,
        (room.minZ + room.maxZ) / 2,
      ];
      const path = findRoomPath(start, target, width, depth, obstacles);
      expect(path, `${floor} ${room.label}`).not.toBeNull();
      for (const [x, , z] of path!)
        expect(panels.some((box) => box.containsPoint(new Vector3(x, 1, z)))).toBe(false);
    }
    const landing = floor === 0 ? stairs.bottom : stairs.top;
    expect(
      findRoomPath(start, [landing[0], 0.06, landing[1]], width, depth, obstacles),
    ).not.toBeNull();
    disposeStudioInterior(scene);
  });
  it("has an upstairs stairwell opening and a reversible height-aware traversal", () => {
    const stairs = houseStairs("duplex", width, depth)!;
    const up = stairTraversalPath(stairs, true),
      down = stairTraversalPath(stairs, false);
    expect(down).toEqual([...up].reverse());
    expect(up.at(-1)![1] - up[0]![1]).toBeCloseTo(HOUSE_STAIR_RISE);
    const scene = createBlueprintInterior("duplex", width, depth, { activeFloor: 1 });
    scene.updateMatrixWorld(true);
    const ray = new Raycaster(
      new Vector3((stairs.x0 + stairs.x1) / 2, 2, (stairs.z0 + stairs.z1) / 2),
      new Vector3(0, -1, 0),
      0,
      2.1,
    );
    expect(ray.intersectObject(scene, true)).toEqual([]);
    expect(scene.getObjectByName("duplex-balcony-railing")).toBeDefined();
    const model = createHouseStairModel(stairs);
    expect(new Box3().setFromObject(model).max.y).toBeCloseTo(HOUSE_STAIR_RISE);
    disposeStudioInterior(scene);
    disposeStudioInterior(model);
  });
});

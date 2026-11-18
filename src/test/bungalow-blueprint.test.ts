import { describe, expect, it } from "vitest";
import { Box3, Mesh, Vector3 } from "three";
import { bungalowBlueprint } from "@/components/game/housing/bungalow-blueprint";
import {
  createBlueprintInterior,
  disposeStudioInterior,
} from "@/components/game/housing/studio-interior";
import {
  HOUSE_ROOM_SIZE,
  houseDoorThreshold,
  houseRoomViews,
  roomViewContains,
  roomCoordinatesToPercent,
} from "@/components/game/housing/house-room-contract";
import {
  findRoomPath,
  roomObstacles,
  placementsOverlappingWalls,
  packagePoint,
} from "@/game/house-navigation";
import {
  arrangementWarnings,
  guideFor,
  houseDoorPercentX,
} from "@/components/game/housing/house-arrangement-guide";
import type { HousePlacement } from "@/components/game/housing/HouseRoomScene";

const [width, depth] = HOUSE_ROOM_SIZE["bungalow"]!;
describe("two-bedroom bungalow with shared gym", () => {
  it("has two bedrooms, a shared gym and an enlarged common bathroom", () => {
    const rooms = houseRoomViews("bungalow", width, depth);
    expect(rooms.filter((room) => room.id.startsWith("bedroom"))).toHaveLength(2);
    expect(rooms.map((room) => room.id)).toEqual(
      expect.arrayContaining([
        "sitting",
        "dining",
        "kitchen",
        "bathroom",
        "ensuite",
        "hallway",
        "gym",
      ]),
    );
    const bath = rooms.find((room) => room.id === "bathroom")!;
    const area = (bath.maxX - bath.minX) * (bath.maxZ - bath.minZ);
    expect(area).toBeCloseTo(11.96);
    expect(area / ((width / 2 - 3) * (2.5 - 0.2))).toBeCloseTo(1.3);
    const gymZone = guideFor("fitness", "treadmill", "bungalow")!.zoneBounds!;
    const [gx, gy] = roomCoordinatesToPercent(-1.3, 3, width, depth);
    expect(gx >= gymZone.x0 && gx <= gymZone.x1 && gy >= gymZone.y0 && gy <= gymZone.y1).toBe(true);
    const ensuite = rooms.find((room) => room.id === "ensuite")!,
      master = rooms.find((room) => room.id === "bedroom")!;
    expect(roomViewContains(master, 6, 4.5, 0)).toBe(false);
    expect(roomViewContains(ensuite, 6, 4.5, 0)).toBe(true);
    for (let x = -width / 2 + 0.1; x < width / 2; x += 0.4)
      for (let z = -depth / 2 + 0.1; z < depth / 2; z += 0.4)
        expect(rooms.filter((room) => roomViewContains(room, x, z, 0))).toHaveLength(1);
  });

  it("renders the navigation walls and reaches every room without walking through door leaves", () => {
    const plan = bungalowBlueprint(width, depth),
      scene = createBlueprintInterior("bungalow", width, depth);
    scene.updateMatrixWorld(true);
    for (const wall of plan.partitions) {
      const mesh = scene.getObjectByName(wall.id) as Mesh;
      expect(mesh.position.toArray()).toEqual(wall.position);
      expect(mesh.scale.toArray()).toEqual(wall.size);
    }
    const panels = plan.interiorDoors.map((door) =>
      new Box3().setFromObject(scene.getObjectByName(door.id)!),
    );
    const obstacles = roomObstacles("bungalow", width, depth, [], []);
    for (const room of plan.rooms) {
      const target: [number, number, number] = [
        (room.minX + room.maxX) / 2,
        0.06,
        (room.minZ + room.maxZ) / 2,
      ];
      const path = findRoomPath(
        houseDoorThreshold("bungalow", width, depth),
        target,
        width,
        depth,
        obstacles,
      );
      expect(path, room.label).not.toBeNull();
      for (const [x, , z] of path!)
        expect(panels.some((box) => box.containsPoint(new Vector3(x, 1, z)))).toBe(false);
    }
    for (let i = 0; i < 4; i++)
      expect(
        findRoomPath(
          houseDoorThreshold("bungalow", width, depth),
          packagePoint(i, width, depth, "bungalow", true),
          width,
          depth,
          obstacles,
          true,
        ),
      ).not.toBeNull();
    expect(scene.getObjectByName("bungalow-veranda")).toBeDefined();
    disposeStudioInterior(scene);
  });

  it("flags affected saves without changing them and accounts for rotated furniture", () => {
    function bed(id: string, x: number, z: number, rotation = 0): HousePlacement {
      const [px, py] = roomCoordinatesToPercent(x, z, width, depth);
      return {
        id,
        item_id: id,
        slot: `free:${id}`,
        x: px,
        y: py,
        rotation_deg: rotation,
        art_key: "bed",
        category: "furniture",
        slot_type: "bed",
      };
    }
    const items = [bed("blocked", -3.2, 3), bed("clear", -5.1, 3), bed("rotated", -2.3, 3, 90)];
    const saved = structuredClone(items);
    expect(
      placementsOverlappingWalls("bungalow", width, depth, items, []).map((item) => item.id),
    ).toEqual(["blocked", "rotated"]);
    expect(items).toEqual(saved);
    const unrotated = { ...items[2]!, rotation_deg: 0 };
    expect(placementsOverlappingWalls("bungalow", width, depth, [unrotated], [])).toEqual([]);
  });

  it("updates placement hints for the new sleeping and wet areas", () => {
    const [bx, by] = roomCoordinatesToPercent(-5.1, 3, width, depth);
    const zone = guideFor("bed", "bed", "bungalow")!.zoneBounds!;
    expect(bx >= zone.x0 && bx <= zone.x1 && by >= zone.y0 && by <= zone.y1).toBe(true);
    const [x, y] = roomCoordinatesToPercent(5, -1.3, width, depth);
    expect(
      arrangementWarnings("bathroom", "shower", x, y, houseDoorPercentX("bungalow"), "bungalow"),
    ).not.toContain("Shower, toilet and sink belong on the wet tiles.");
  });
});

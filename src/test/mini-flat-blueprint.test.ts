import { describe, expect, it } from "vitest";
import { Box3, Mesh, Vector3 } from "three";
import { miniFlatBlueprint } from "@/components/game/housing/house-blueprints";
import {
  createBlueprintInterior,
  disposeStudioInterior,
} from "@/components/game/housing/studio-interior";
import {
  HOUSE_ROOM_SIZE,
  houseDoorThreshold,
  housePartitionSegments,
  houseRoomViews,
  houseWallsDefaultClosed,
} from "@/components/game/housing/house-room-contract";
import { findRoomPath, roomObstacles, type RoomPoint } from "@/game/house-navigation";

const [width, depth] = HOUSE_ROOM_SIZE["mini-flat"]!;
describe("mini-flat blueprint", () => {
  it("keeps separate room views and renders the same partitions used for movement", () => {
    expect(houseRoomViews("mini-flat", width, depth).map((room) => room.id)).toEqual([
      "sitting",
      "kitchen",
      "bedroom",
      "bathroom",
    ]);
    const scene = createBlueprintInterior("mini-flat", width, depth);
    for (const wall of housePartitionSegments("mini-flat", width, depth)) {
      const mesh = scene.getObjectByName(wall.id) as Mesh;
      expect(mesh.position.toArray()).toEqual(wall.position);
      expect(mesh.scale.toArray()).toEqual(wall.size);
    }
    for (const door of miniFlatBlueprint(width, depth).interiorDoors)
      expect(scene.getObjectByName(door.id)).toBeDefined();
    disposeStudioInterior(scene);
  });

  it("can reach all four rooms without crossing walls or the folded-back door leaves", () => {
    const scene = createBlueprintInterior("mini-flat", width, depth);
    scene.updateMatrixWorld(true);
    const panels = miniFlatBlueprint(width, depth).interiorDoors.map((door) =>
      new Box3().setFromObject(scene.getObjectByName(door.id)!),
    );
    const start = houseDoorThreshold("mini-flat", width, depth);
    const obstacles = roomObstacles("mini-flat", width, depth, [], []);
    for (const target of [
      [-2, 0.06, -1.5],
      [2, 0.06, -1.5],
      [-2, 0.06, 1.5],
      [2, 0.06, 1.5],
    ] as RoomPoint[]) {
      const path = findRoomPath(start, target, width, depth, obstacles);
      expect(path).not.toBeNull();
      for (const [x, , z] of path!)
        expect(panels.some((box) => box.containsPoint(new Vector3(x, 1, z)))).toBe(false);
    }
    disposeStudioInterior(scene);
  });

  it("starts as a cutaway while retaining the older large-home defaults", () => {
    expect(houseWallsDefaultClosed("mini-flat")).toBe(false);
    expect(houseWallsDefaultClosed("bungalow")).toBe(true);
    expect(houseWallsDefaultClosed("duplex")).toBe(true);
    const scene = createBlueprintInterior("mini-flat", width, depth);
    const cutaway = scene.getObjectByName("studio-front-cutaway") as Mesh;
    expect(cutaway.scale.y).toBeLessThan(0.5);
    disposeStudioInterior(scene);
  });
});

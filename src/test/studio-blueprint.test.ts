import { describe, expect, it } from "vitest";
import { InstancedMesh, Mesh, Raycaster, Vector3 } from "three";
import { studioBlueprint } from "@/components/game/housing/house-blueprints";
import {
  createStudioInterior,
  disposeStudioInterior,
} from "@/components/game/housing/studio-interior";
import {
  housePartitionSegments,
  houseRoomViews,
  roomViewContains,
  houseRearDoorCenter,
  HOUSE_ROOM_SIZE,
} from "@/components/game/housing/house-room-contract";
import { findRoomPath, roomObstacles, type RoomPoint } from "@/game/house-navigation";
import { houseDoorPercentX } from "@/components/game/housing/house-arrangement-guide";

const [width, depth] = HOUSE_ROOM_SIZE["studio-flat"]!;
describe("blueprint studio", () => {
  it("keeps the main space open and encloses only the existing wet quadrant", () => {
    const walls = housePartitionSegments("studio-flat", width, depth);
    expect(walls).toHaveLength(3);
    expect(walls.every((wall) => wall.position[0] >= 0 && wall.position[2] >= 0)).toBe(true);
    const [main, bath] = houseRoomViews("studio-flat", width, depth);
    for (const [x, z] of [
      [-2, -1],
      [-2, 1],
      [2, -1],
    ]) {
      expect(roomViewContains(main!, x!, z!)).toBe(true);
      expect(roomViewContains(bath!, x!, z!, 0)).toBe(false);
    }
    expect(roomViewContains(main!, 2, 1)).toBe(false);
    expect(roomViewContains(bath!, 2, 1)).toBe(true);
    expect(houseRearDoorCenter("studio-flat", width)).toBe(studioBlueprint(width, depth).entranceX);
    expect(houseDoorPercentX("studio-flat")).toBe(22);
  });

  it("routes between every zone through the bathroom opening without crossing walls", () => {
    const obstacles = roomObstacles("studio-flat", width, depth, [], []);
    const entrance: RoomPoint = [houseRearDoorCenter("studio-flat", width), 0.06, -depth / 2 + 0.6];
    for (const target of [
      [-2, 0.06, 1.5],
      [-2, 0.06, -1.5],
      [2, 0.06, -1.5],
      [2, 0.06, 1.5],
    ] as RoomPoint[]) {
      const path = findRoomPath(entrance, target, width, depth, obstacles);
      expect(path).not.toBeNull();
      for (const [x, , z] of path!) {
        expect(
          obstacles.some(
            (wall) =>
              Math.abs(x - wall.x) < wall.w / 2 + 0.19 && Math.abs(z - wall.z) < wall.d / 2 + 0.19,
          ),
        ).toBe(false);
      }
      expect(Math.hypot(path!.at(-1)![0] - target[0], path!.at(-1)![2] - target[2])).toBeLessThan(
        0.2,
      );
    }
  });

  it("uses the same partition geometry for navigation and rendering", () => {
    const scene = createStudioInterior(width, depth);
    scene.updateMatrixWorld(true);
    for (const wall of housePartitionSegments("studio-flat", width, depth)) {
      const mesh = scene.getObjectByName(wall.id) as Mesh;
      expect(mesh.position.toArray()).toEqual(wall.position);
      expect(mesh.scale.toArray()).toEqual(wall.size);
    }
    // Window glazing has a genuine opening through the plaster, not a pane covering a solid wall.
    for (const z of studioBlueprint(width, depth).windows) {
      const ray = new Raycaster(
        new Vector3(-width / 2 - 1, 1.4, z + 0.1),
        new Vector3(1, 0, 0),
        0,
        1.3,
      );
      const hits = ray.intersectObject(scene, true);
      expect(hits.some((hit) => hit.object.name === "window-glazing")).toBe(true);
      expect(hits.some((hit) => hit.object.name.startsWith("studio-window-pier"))).toBe(false);
    }
    const tileBatches: InstancedMesh[] = [];
    scene.traverse((object) => {
      if (object instanceof InstancedMesh) tileBatches.push(object);
    });
    expect(tileBatches.length).toBeLessThanOrEqual(5);
    expect(tileBatches.reduce((sum, batch) => sum + batch.count, 0)).toBeGreaterThan(300);
    disposeStudioInterior(scene);
  });
});

import { describe, expect, it } from "vitest";
import { findRoomPath, roomObstacles, type RoomPoint } from "@/game/house-navigation";
import { housePartitionSegments } from "@/components/game/housing/house-room-contract";
describe("house navigation", () => {
  it("routes through the doorway rather than crossing partitions", () => {
    const obstacles = roomObstacles("mini-flat", 9, 6.8, [], []);
    const path = findRoomPath([-3, 0.06, 2], [-3, 0.06, -2], 9, 6.8, obstacles)!;
    expect(path).not.toBeNull();
    for (const point of path)
      for (const wall of housePartitionSegments("mini-flat", 9, 6.8)) {
        expect(
          Math.abs(point[0] - wall.position[0]) < wall.size[0] / 2 + 0.19 &&
            Math.abs(point[2] - wall.position[2]) < wall.size[2] / 2 + 0.19,
        ).toBe(false);
      }
    expect(path.some((p) => Math.abs(p[0] - 0.45) < 0.5 && Math.abs(p[2]) < 0.3)).toBe(
      true,
    );
  });
  it("stops next to furniture rather than walking into it", () => {
    const obstacle = { x: 1, z: 1, w: 1.4, d: 2 };
    const path = findRoomPath([-2, 0.06, 0], [1, 0.06, 1], 7, 6, [obstacle], true)!;
    expect(path).not.toBeNull();
    for (const [x, , z] of path)
      expect(Math.abs(x - 1) < 0.89 && Math.abs(z - 1) < 1.19).toBe(false);
  });
  it("rejects unreachable destinations and out of room taps", () => {
    const start: RoomPoint = [-2, 0.06, 0];
    expect(findRoomPath(start, [2, 0.06, 0], 6, 6, [{ x: 0, z: 0, w: 0.2, d: 6 }])).toBeNull();
    expect(findRoomPath(start, [99, 0.06, 0], 6, 6, [])).toBeNull();
    expect(findRoomPath(start, [NaN, 0.06, 0], 6, 6, [])).toBeNull();
  });
});

it("will not interact through a wall when the other room is inaccessible", () => {
  expect(
    findRoomPath(
      [-1, 0.06, 0],
      [0.5, 0.06, 0],
      6,
      6,
      [{ x: 0, z: 0, w: 0.12, d: 6, wall: true }],
      true,
    ),
  ).toBeNull();
});

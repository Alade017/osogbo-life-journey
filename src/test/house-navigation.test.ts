import { describe, expect, it } from "vitest";
import { findRoomPath, roomObstacles, type RoomPoint } from "@/game/house-navigation";
import {
  houseDoorThreshold,
  houseStairs,
  housePartitionSegments,
} from "@/components/game/housing/house-room-contract";
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
    expect(path.some((p) => Math.abs(p[0] + 2.25) < 0.6 && Math.abs(p[2]) < 0.3)).toBe(true);
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

describe("duplex stairs", () => {
  const width = 13.2;
  const depth = 9.7;
  const stairs = houseStairs("duplex", width, depth);
  const at = ([x, z]: [number, number]): RoomPoint => [x, 0.06, z];

  it("has stairs in a duplex only", () => {
    expect(stairs).not.toBeNull();
    expect(houseStairs("studio-flat", width, depth)).toBeNull();
  });

  it("reaches the foot of the stairs from the door on the ground floor", () => {
    const door = houseDoorThreshold("duplex", width, depth);
    const obstacles = roomObstacles("duplex", width, depth, [], [], 0);
    expect(findRoomPath(door, at(stairs!.bottom), width, depth, obstacles)).not.toBeNull();
  });

  it("reaches the top of the stairs upstairs and can walk into the upstairs rooms", () => {
    const obstacles = roomObstacles("duplex", width, depth, [], [], 1);
    expect(findRoomPath(at(stairs!.top), at([2, -1.5]), width, depth, obstacles)).not.toBeNull();
    expect(findRoomPath(at(stairs!.top), at([3.5, -3.5]), width, depth, obstacles)).not.toBeNull();
  });

  it("keeps each stair landing clear of walls on its floor", () => {
    const ground = roomObstacles("duplex", width, depth, [], [], 0);
    const upstairs = roomObstacles("duplex", width, depth, [], [], 1);
    const clear = (point: [number, number], list: typeof ground) =>
      list.every(
        (o) => Math.abs(point[0] - o.x) > o.w / 2 + 0.1 || Math.abs(point[1] - o.z) > o.d / 2 + 0.1,
      );
    expect(clear(stairs!.bottom, ground)).toBe(true);
    expect(clear(stairs!.top, upstairs)).toBe(true);
  });
});

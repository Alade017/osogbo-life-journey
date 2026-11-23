import { describe, expect, it } from "vitest";
import { findRoomPath, type RoomPoint } from "@/game/house-navigation";

describe("floor taps near the walls", () => {
  const start: RoomPoint = [0, 0.06, 0];

  it("walks to a tap in the wall band instead of reporting no clear path", () => {
    const path = findRoomPath(start, [2.9, 0.06, -2.4], 6, 6, []);
    expect(path).not.toBeNull();
    const end = path![path!.length - 1]!;
    expect(Math.abs(end[0] - 2.9)).toBeLessThanOrEqual(0.35);
    expect(Math.abs(end[2] + 2.4)).toBeLessThanOrEqual(0.35);
  });

  it("still refuses taps far outside the room", () => {
    expect(findRoomPath(start, [4, 0.06, 0], 6, 6, [])).toBeNull();
    expect(findRoomPath(start, [0, 0.06, -4], 6, 6, [])).toBeNull();
  });

  it("does not let a wall-band tap cross a wall to reach the far side", () => {
    const wall = [{ x: 0, z: 0, w: 0.2, d: 6 }];
    expect(findRoomPath(start, [2.9, 0.06, 0], 6, 6, wall)).toBeNull();
  });
});

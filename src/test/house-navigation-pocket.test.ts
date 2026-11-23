import { describe, expect, it } from "vitest";
import { findRoomPath, type RoomObstacle } from "@/game/house-navigation";

// Four pieces of furniture that enclose a small pocket around the origin. Their inflated footprints
// close every gap, so the character standing inside cannot reach the rest of the room.
const pocket: RoomObstacle[] = [
  { x: -0.9, z: 0, w: 0.2, d: 2 },
  { x: 0.9, z: 0, w: 0.2, d: 2 },
  { x: 0, z: -0.9, w: 2, d: 0.2 },
  { x: 0, z: 0.9, w: 2, d: 0.2 },
];

describe("findRoomPath when the character is walled into a pocket", () => {
  it("still finds a way out to the rest of the room", () => {
    const path = findRoomPath([0, 0.06, 0], [2, 0.06, 2], 6, 6, pocket);
    expect(path).not.toBeNull();
    const last = path![path!.length - 1]!;
    expect(Math.hypot(last[0] - 2, last[2] - 2)).toBeLessThanOrEqual(0.35);
  });

  it("can still walk within the open room after leaving the pocket", () => {
    const path = findRoomPath([0, 0.06, 0], [-2, 0.06, -2], 6, 6, pocket);
    expect(path).not.toBeNull();
  });

  it("does not change the route for a character in the open", () => {
    const path = findRoomPath([2, 0.06, 2], [-2, 0.06, -2], 6, 6, pocket);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual([expect.any(Number), 0.06, expect.any(Number)]);
  });
});

import { describe, expect, it } from "vitest";
import {
  houseRoomViews,
  houseWallSegments,
  housePartitionSegmentsForFloor,
  roomViewContains,
  roomViewHidesSegment,
} from "@/components/game/housing/house-room-contract";

const width = 6;
const depth = 5;

describe("room view", () => {
  it("shows a single-room home as one room that fills the house", () => {
    const [room, ...rest] = houseRoomViews("shared-room", width, depth);
    expect(rest).toEqual([]);
    expect(room).toMatchObject({ id: "room", minX: -3, maxX: 3, minZ: -2.5, maxZ: 2.5 });
  });

  it("gives each room of a four-room home its own view", () => {
    const views = houseRoomViews("mini-flat", width, depth);
    expect(views.map((view) => view.id)).toEqual(["sitting", "kitchen", "bedroom", "bathroom"]);
    const bathroom = views.find((view) => view.id === "bathroom")!;
    expect(roomViewContains(bathroom, 2, 1)).toBe(true);
    expect(roomViewContains(bathroom, -2, -1)).toBe(false);
  });

  it("hides the walls on the camera's side and keeps the far walls", () => {
    const [room] = houseRoomViews("shared-room", width, depth);
    const walls = houseWallSegments(width, depth, 2.4, 1.1, 0, true);
    const shown = walls.filter((wall) => !roomViewHidesSegment(wall, room!)).map((wall) => wall.id);
    expect(shown).toEqual(expect.arrayContaining(["rear-left", "rear-right", "left-back"]));
    expect(shown).not.toContain("front-wall");
    expect(shown).not.toContain("right-back");
    expect(shown.some((id) => id.endsWith("cutaway"))).toBe(false);
  });

  it("keeps the partitions that bound a room from the far side only", () => {
    const sitting = houseRoomViews("mini-flat", width, depth).find(
      (view) => view.id === "sitting",
    )!;
    const partitions = housePartitionSegmentsForFloor("mini-flat", width, depth, 0);
    const shown = partitions
      .filter((wall) => !roomViewHidesSegment(wall, sitting))
      .map((wall) => wall.id);
    expect(shown).toEqual([]);

    const bedroom = houseRoomViews("mini-flat", width, depth).find(
      (view) => view.id === "bedroom",
    )!;
    const bedroomShown = partitions
      .filter((wall) => !roomViewHidesSegment(wall, bedroom))
      .map((wall) => wall.id);
    expect(bedroomShown).toContain("sitting-bedroom-left");
    expect(bedroomShown).not.toContain("bedroom-bath-back");
  });
});

import { describe, expect, it } from "vitest";
import { houseRoomViews, roomViewContains } from "@/components/game/housing/house-room-contract";

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
});

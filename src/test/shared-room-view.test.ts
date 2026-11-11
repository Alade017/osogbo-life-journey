import { describe, expect, it } from "vitest";
import {
  parseSharedHome,
  sharedRoomPlacements,
  sharedSlotKey,
} from "@/components/game/housing/shared-room-view";

const serverValue = {
  unit_id: "unit-1",
  my_bed_slot: 2,
  zones: [
    { bed_slot: 1, x_min: 0, x_max: 50, y_min: 0, y_max: 100 },
    { bed_slot: 2, x_min: 50, x_max: 100, y_min: 0, y_max: 100 },
  ],
  placements: [
    {
      id: "p1",
      item_id: "bed-1",
      slot: "bed-1",
      bed_slot: 1,
      x: 24,
      y: 30,
      rotation_deg: 0,
      art_key: "starter-bed",
      category: "furniture",
      slot_type: "bed",
    },
    { id: "p2", item_id: "stove", slot: "stove", x: 92, y: 62, art_key: null, slot_type: "stove" },
    { id: "bad", item_id: "tv", slot: "television", x: "left", y: 84 },
  ],
};

describe("shared room view", () => {
  it("reads the tenant's bed, zones and shared pieces from the server value", () => {
    const shared = parseSharedHome(serverValue);
    expect(shared).toMatchObject({ unitId: "unit-1", myBedSlot: 2 });
    expect(shared?.zones).toHaveLength(2);
    expect(shared?.zones[1]).toEqual({ bedSlot: 2, xMin: 50, xMax: 100, yMin: 0, yMax: 100 });
  });

  it("drops malformed shared pieces instead of drawing them", () => {
    const shared = parseSharedHome(serverValue);
    expect(shared?.placements.map((item) => item.item_id)).toEqual(["bed-1", "stove"]);
  });

  it("marks shared pieces as game-placed so they never reach a move or remove call", () => {
    const placements = sharedRoomPlacements(parseSharedHome(serverValue));
    expect(placements[0]).toMatchObject({
      id: "shared-p1",
      slot: sharedSlotKey("bed-1"),
      slot_type: "bed",
      art_key: "starter-bed",
      floor: 0,
    });
    // Missing art falls back to the item id.
    expect(placements[1]?.art_key).toBe("stove");
  });

  it("treats a non-tenant or malformed value as no shared room", () => {
    expect(parseSharedHome(null)).toBeNull();
    expect(parseSharedHome({ unit_id: 5, my_bed_slot: 1 })).toBeNull();
    expect(sharedRoomPlacements(null)).toEqual([]);
  });
});

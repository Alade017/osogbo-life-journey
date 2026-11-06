import { describe, expect, it } from "vitest";
import { renderSlotForPlacement } from "@/components/game/housing/house-room-contract";
import type { HousePlacement, HouseSlot } from "@/components/game/housing/HouseRoomScene";

const slots: HouseSlot[] = [{ id: "sofa", slot_type: "seat", x: 30, y: 40 }];

function placement(overrides: Partial<HousePlacement>): HousePlacement {
  return {
    id: "p1",
    item_id: "item-1",
    slot: "sofa",
    art_key: "sofa",
    category: "furniture",
    slot_type: "seat",
    ...overrides,
  };
}

describe("moved house placements", () => {
  it("draws a placement in its fixed slot when it still has one", () => {
    expect(renderSlotForPlacement(placement({ x: 10, y: 10 }), slots)).toBe(slots[0]);
  });

  it("keeps drawing a moved placement from its own coordinates", () => {
    const moved = placement({ slot: "free:p1", x: 62.5, y: 18 });
    expect(renderSlotForPlacement(moved, slots)).toEqual({
      id: "free:p1",
      slot_type: "seat",
      x: 62.5,
      y: 18,
    });
  });

  it("hides a placement that has neither a fixed slot nor a position", () => {
    expect(renderSlotForPlacement(placement({ slot: "free:p1" }), slots)).toBeUndefined();
  });
});

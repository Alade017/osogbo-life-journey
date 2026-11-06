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

import {
  HOUSE_GRID_SIZE,
  gridCellOf,
  isHouseGridCellOccupied,
  snapToHouseGrid,
} from "@/components/game/housing/house-room-contract";

describe("house grid", () => {
  it("uses an 8 × 8 grid", () => {
    expect(HOUSE_GRID_SIZE).toBe(8);
    expect(gridCellOf(4, 4)).toEqual({ col: 0, row: 0 });
    expect(gridCellOf(96, 96)).toEqual({ col: 7, row: 7 });
  });

  it("snaps any point to the centre of its cell", () => {
    const [x, y] = snapToHouseGrid(50, 50);
    expect(gridCellOf(x, y)).toEqual(gridCellOf(50, 50));
    expect(snapToHouseGrid(50, 50)).toEqual(snapToHouseGrid(x, y));
  });

  it("reports a cell as occupied only when another item is in it", () => {
    const others = [{ id: "a", x: 50, y: 50 }];
    expect(isHouseGridCellOccupied(51, 51, others)).toBe(true);
    expect(isHouseGridCellOccupied(10, 10, others)).toBe(false);
    expect(isHouseGridCellOccupied(50, 50, others, "a")).toBe(false);
  });
});

import { draftStartFor } from "@/components/game/housing/house-room-contract";

describe("placement mode start", () => {
  it("starts from the saved spot when the item was moved", () => {
    expect(draftStartFor(placement({ slot: "free:p1", x: 62.5, y: 18 }), slots)).toEqual({
      x: 62.5,
      y: 18,
    });
  });

  it("starts from the fixed slot when the item was never moved", () => {
    expect(draftStartFor(placement({}), slots)).toEqual({ x: 30, y: 40 });
  });

  it("cannot start when the item has no spot at all", () => {
    expect(draftStartFor(placement({ slot: "missing" }), slots)).toBeNull();
  });
});

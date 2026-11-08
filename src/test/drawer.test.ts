import { describe, expect, it } from "vitest";
import {
  drawerErrorMessage,
  isStorableWearable,
  parseDrawerState,
  storableRows,
  type DrawerInventoryRow,
} from "@/lib/drawer";

const cap: DrawerInventoryRow = { id: "a", item_id: "cap", category: "outfit", slot_type: "head" };
const shoes: DrawerInventoryRow = {
  id: "b",
  item_id: "boots",
  category: "outfit",
  slot_type: "shoes",
};
const watch: DrawerInventoryRow = {
  id: "c",
  item_id: "watch",
  category: "accessory",
  slot_type: "accessory",
};
const chair: DrawerInventoryRow = {
  id: "d",
  item_id: "stool",
  category: "furniture",
  slot_type: "seat",
};

describe("drawer rules", () => {
  it("accepts clothes, caps, footwear and accessories only", () => {
    expect(isStorableWearable(cap)).toBe(true);
    expect(isStorableWearable(shoes)).toBe(true);
    expect(isStorableWearable(watch)).toBe(true);
    expect(isStorableWearable(chair)).toBe(false);
  });

  it("leaves out anything the player is wearing", () => {
    const rows = storableRows([cap, shoes, chair, watch], new Set(["cap"]));
    expect(rows.map((row) => row.item_id)).toEqual(["boots", "watch"]);
  });

  it("parses a valid drawer payload and reads the server capacity", () => {
    const state = parseDrawerState({
      capacity: 24,
      items: [
        {
          id: "x",
          item_id: "cap",
          quantity: 1,
          stored_at: "2026-11-07T00:00:00Z",
          category: "outfit",
          slot_type: "head",
          art_key: "cap",
        },
      ],
    });
    expect(state?.capacity).toBe(24);
    expect(state?.items).toHaveLength(1);
  });

  it("rejects a payload with no valid capacity and drops malformed items", () => {
    expect(parseDrawerState({ items: [] })).toBeNull();
    expect(parseDrawerState({ capacity: -1, items: [] })).toBeNull();
    const state = parseDrawerState({ capacity: 4, items: [{ id: 5 }, null] });
    expect(state?.items).toEqual([]);
  });

  it("maps server codes to messages with a neutral fallback", () => {
    expect(drawerErrorMessage("DRAWER_FULL")).toMatch(/full/);
    expect(drawerErrorMessage("SOMETHING_ELSE")).toBe("That change was not saved. Try again.");
    expect(drawerErrorMessage(null)).toBe("That change was not saved. Try again.");
  });
});

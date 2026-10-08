import { describe, expect, it } from "vitest";
import {
  countInventoryUnits,
  filterInventory,
  normalizeInventoryCategory,
} from "@/lib/inventory-service";
import type { PlayerInventoryEntry } from "@/lib/player-state";

function entry(id: string, category: string, name: string, icon = "package"): PlayerInventoryEntry {
  return {
    id,
    user_id: "profile-1",
    character_id: "character-1",
    item_id: `item-${id}`,
    quantity: 2,
    acquired_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    item: {
      id: `item-${id}`,
      slug: id,
      name,
      description: "A starter item.",
      category,
      icon,
      created_at: "2026-01-01T00:00:00Z",
      effects: {},
      buy_price: 0,
      equippable: false,
      equipment_slot: null,
      max_stack: 1,
      stackable: false,
      sell_price: 0,
      sellable: false,
      usable: false,
      value: 0,
    },
  };
}

describe("inventory service", () => {
  const starterItems = [
    entry("pie", "consumable", "Meat Pie", "utensils"),
    entry("water", "consumable", "Bottled Water", "glass-water"),
    entry("shirt", "clothing", "Black T-shirt", "shirt"),
    entry("phone", "gadget", "Basic Phone", "smartphone"),
    entry("bag", "gear", "Canvas Bag", "backpack"),
  ];

  it("maps existing item categories into the six canonical filters", () => {
    expect(starterItems.map((item) => normalizeInventoryCategory(item.item))).toEqual([
      "food",
      "drinks",
      "clothing",
      "electronics",
      "tools",
    ]);
  });

  it("filters normalized inventory and counts owned units", () => {
    expect(filterInventory(starterItems, "food").map((item) => item.id)).toEqual(["pie"]);
    expect(filterInventory(starterItems, "all")).toHaveLength(5);
    expect(countInventoryUnits(starterItems)).toBe(10);
  });

  it("routes unknown and missing definitions to miscellaneous", () => {
    expect(normalizeInventoryCategory(null)).toBe("miscellaneous");
    expect(
      normalizeInventoryCategory({
        category: "unknown",
        name: "Mystery item",
        icon: "package",
        slug: "mystery",
      }),
    ).toBe("miscellaneous");
  });
});

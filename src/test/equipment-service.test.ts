import { describe, expect, it } from "vitest";
import type { EquippedItem, ItemDefinition } from "@/lib/player-state";
import {
  EQUIPMENT_SLOTS,
  getEquipmentForSlot,
  isEquipmentSlot,
  removeEquippedItem,
  replaceEquippedItem,
  validateEquipItem,
} from "@/lib/equipment-service";

function item(overrides: Record<string, unknown> = {}): ItemDefinition {
  return {
    id: "shirt-1",
    slug: "basic_outfit",
    name: "Basic Outfit",
    description: "A simple outfit.",
    category: "clothing",
    icon: "shirt",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ItemDefinition;
}

function equipped(id: string, slot: EquippedItem["slot"]): EquippedItem {
  return {
    id,
    character_id: "character-1",
    item_id: `item-${id}`,
    slot,
    durability: null,
    metadata: {},
    item: null,
  };
}

describe("equipment model", () => {
  it("supports the five defined slots", () => {
    expect(EQUIPMENT_SLOTS).toEqual(["head", "top", "bottom", "shoes", "accessory"]);
    expect(isEquipmentSlot("top")).toBe(true);
    expect(isEquipmentSlot("food")).toBe(false);
  });

  it("requires an owned item definition that is equippable in the requested slot", () => {
    expect(validateEquipItem(item({ equippable: true, equipment_slot: "top" }), "top")).toBeNull();
    expect(validateEquipItem(item({ equippable: true, equipment_slot: "head" }), "top")).toBe(
      "This item belongs in the head slot.",
    );
    expect(validateEquipItem(item({ category: "consumable", equippable: true }), "top")).toBe(
      "Consumables cannot be equipped.",
    );
    expect(validateEquipItem(item(), "top")).toBe("This item cannot be equipped.");
  });

  it("keeps worn items separate and returns the displaced item on replacement", () => {
    const previous = equipped("old-shirt", "top");
    const hat = equipped("hat", "head");
    const next = equipped("new-shirt", "top");
    expect(getEquipmentForSlot([previous, hat], "top")).toEqual(previous);
    expect(replaceEquippedItem([previous, hat], next)).toEqual({
      equipment: [hat, next],
      displaced: previous,
    });
  });

  it("returns the unequipped item for transfer back to inventory", () => {
    const shirt = equipped("shirt", "top");
    expect(removeEquippedItem([shirt], "top")).toEqual({ equipment: [], removed: shirt });
    expect(removeEquippedItem([], "top")).toEqual({ equipment: [], removed: null });
  });
});

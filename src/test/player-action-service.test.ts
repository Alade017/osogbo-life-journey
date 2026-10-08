import { describe, expect, it } from "vitest";
import type { EquippedItem, ItemDefinition, PlayerInventoryEntry } from "@/lib/player-state";
import { validatePlayerAction } from "@/lib/player-action-service";

function definition(overrides: Record<string, unknown> = {}): ItemDefinition {
  return {
    id: "item-1",
    slug: "water_bottle",
    name: "Water Bottle",
    description: "A bottle of drinking water.",
    category: "consumable",
    icon: "glass-water",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ItemDefinition;
}

function ownedItem(
  item: ItemDefinition | null = definition(),
  overrides: Record<string, unknown> = {},
): PlayerInventoryEntry {
  return {
    id: "owned-1",
    user_id: "profile-1",
    character_id: "character-1",
    item_id: "item-1",
    quantity: 2,
    acquired_at: "2026-01-01T00:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
    item,
    ...overrides,
  };
}

describe("player action validation", () => {
  it("allows inspect and use only for owned, configured items", () => {
    expect(
      validatePlayerAction({
        action: "inspect",
        characterId: "character-1",
        inventoryEntry: ownedItem(),
      }),
    ).toBeNull();
    expect(
      validatePlayerAction({
        action: "use",
        characterId: "character-1",
        inventoryEntry: ownedItem(
          definition({ usable: true, effects: { stat_changes: { thirst: -30 }, time_minutes: 1 } }),
        ),
      }),
    ).toBeNull();
    expect(
      validatePlayerAction({
        action: "use",
        characterId: "character-1",
        inventoryEntry: ownedItem(),
      }),
    ).toBe("This item cannot be used.");
  });

  it("rejects missing, foreign, empty, and insufficient inventory rows", () => {
    expect(validatePlayerAction({ action: "inspect", characterId: "character-1" })).toBe(
      "You do not own this item.",
    );
    expect(
      validatePlayerAction({
        action: "use",
        characterId: "character-1",
        inventoryEntry: ownedItem(null, { character_id: "character-2" }),
      }),
    ).toBe("This item belongs to another character.");
    expect(
      validatePlayerAction({
        action: "use",
        characterId: "character-1",
        inventoryEntry: ownedItem(null, { quantity: 0 }),
      }),
    ).toBe("You do not have enough of this item.");
    expect(
      validatePlayerAction({
        action: "discard",
        characterId: "character-1",
        inventoryEntry: ownedItem(),
        quantity: 3,
      }),
    ).toBe("You do not have enough of this item.");
  });

  it("blocks invalid equip requests and accepts a matching owned clothing item", () => {
    const shirt = definition({
      slug: "basic_outfit",
      name: "Basic Outfit",
      icon: "shirt",
      category: "clothing",
      equippable: true,
      equipment_slot: "top",
    });
    expect(
      validatePlayerAction({
        action: "equip",
        characterId: "character-1",
        inventoryEntry: ownedItem(shirt),
        slot: "top",
      }),
    ).toBeNull();
    expect(
      validatePlayerAction({
        action: "equip",
        characterId: "character-1",
        inventoryEntry: ownedItem(),
        slot: "top",
      }),
    ).toBe("Consumables cannot be equipped.");
  });

  it("validates unequip ownership and slot", () => {
    const hat: EquippedItem = {
      id: "hat-1",
      character_id: "character-1",
      item_id: "hat-definition",
      slot: "head",
      durability: null,
      metadata: {},
      item: null,
    };
    expect(
      validatePlayerAction({
        action: "unequip",
        characterId: "character-1",
        slot: "head",
        equippedItem: hat,
      }),
    ).toBeNull();
    expect(
      validatePlayerAction({
        action: "unequip",
        characterId: "character-1",
        slot: "top",
        equippedItem: hat,
      }),
    ).toBe("There is no item equipped in that slot.");
  });
});

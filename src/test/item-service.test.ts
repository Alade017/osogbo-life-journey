import { describe, expect, it } from "vitest";
import type { ItemDefinition } from "@/lib/player-state";
import {
  hasValidItemDefinition,
  itemCapabilities,
  itemUseEffect,
  validateItemUse,
} from "@/lib/item-service";

function item(overrides: Record<string, unknown> = {}): ItemDefinition {
  return {
    id: "item-water",
    slug: "water_bottle",
    name: "Water Bottle",
    description: "A sealed bottle of water.",
    category: "consumable",
    icon: "glass-water",
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as ItemDefinition;
}

describe("item definitions and effects", () => {
  it("keeps category, price, stack, and action capabilities in one item definition", () => {
    expect(
      itemCapabilities(
        item({ value: 250, stackable: true, max_stack: 5, usable: true, equippable: false }),
      ),
    ).toEqual({
      category: "drinks",
      value: 250,
      stackable: true,
      maxStack: 5,
      usable: true,
      equippable: false,
    });
  });

  it("validates effect stat names and amount bounds before use", () => {
    const water = item({
      usable: true,
      effects: { stat_changes: { thirst: -35 }, time_minutes: 1 },
    });
    expect(itemUseEffect(water)).toEqual({
      action: "drink",
      statChanges: { thirst: -35 },
      timeMinutes: 1,
    });
    expect(validateItemUse(water)).toBeNull();

    expect(
      itemUseEffect(
        item({ usable: true, effects: { stat_changes: { cash: 1000 }, time_minutes: 1 } }),
      ),
    ).toBeNull();
    expect(
      itemUseEffect(
        item({ usable: true, effects: { stat_changes: { thirst: -101 }, time_minutes: 1 } }),
      ),
    ).toBeNull();
  });

  it("rejects unconfigured or non-usable item actions", () => {
    expect(validateItemUse(item())).toBe("This item cannot be used.");
    expect(validateItemUse(item({ usable: true }))).toBe(
      "This item's use effect is not configured.",
    );
    expect(itemUseEffect(null)).toBeNull();
  });

  it("checks stack and value rules for item definitions", () => {
    expect(
      hasValidItemDefinition(
        item({ value: 0, stackable: false, max_stack: 1, usable: false, equippable: true }),
      ),
    ).toBe(true);
    expect(hasValidItemDefinition(item({ value: -5 }))).toBe(false);
    expect(hasValidItemDefinition(item({ stackable: false, max_stack: 10 }))).toBe(false);
  });
});

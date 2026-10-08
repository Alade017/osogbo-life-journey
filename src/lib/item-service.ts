import type { Json } from "@/integrations/supabase/types";
import { normalizeInventoryCategory, type InventoryCategory } from "@/lib/inventory-service";
import type { ItemDefinition } from "@/lib/player-state";
import { STAT_MAX, STAT_MIN, type VitalName } from "@/lib/stats-service";

export type ItemActionKind = "eat" | "drink" | "use";

export type ItemUseEffect = {
  action: ItemActionKind;
  statChanges: Partial<Record<VitalName, number>>;
  timeMinutes: number;
};

export type ItemCapabilities = {
  category: InventoryCategory;
  value: number | null;
  stackable: boolean | null;
  maxStack: number | null;
  usable: boolean;
  equippable: boolean;
};

const VITALS = new Set<VitalName>(["health", "energy", "hunger", "thirst"]);

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readStatChanges(value: Json | undefined): Partial<Record<VitalName, number>> | null {
  if (!isRecord(value)) return null;
  const changes: Partial<Record<VitalName, number>> = {};
  for (const [key, amount] of Object.entries(value)) {
    if (!VITALS.has(key as VitalName)) return null;
    if (typeof amount !== "number" || !Number.isInteger(amount)) return null;
    if (amount < -STAT_MAX || amount > STAT_MAX) return null;
    changes[key as VitalName] = amount;
  }
  return changes;
}

export function itemCapabilities(item: ItemDefinition | null): ItemCapabilities {
  const category = normalizeInventoryCategory(item);
  const maxStack = item?.max_stack;
  return {
    category,
    value: typeof item?.value === "number" && item.value >= 0 ? item.value : null,
    stackable: item?.stackable ?? null,
    maxStack: typeof maxStack === "number" && maxStack > 0 ? maxStack : null,
    usable: item?.usable === true,
    equippable: item?.equippable === true,
  };
}

export function itemUseEffect(item: ItemDefinition | null): ItemUseEffect | null {
  if (!item?.usable || !isRecord(item.effects)) return null;
  const rawChanges = item.effects["stat_changes"];
  const statChanges = readStatChanges(rawChanges);
  const timeMinutes = item.effects["time_minutes"];
  if (!statChanges || typeof timeMinutes !== "number" || !Number.isInteger(timeMinutes)) {
    return null;
  }
  if (timeMinutes < 1 || timeMinutes > 60) return null;

  const category = normalizeInventoryCategory(item);
  const action: ItemActionKind =
    category === "food" ? "eat" : category === "drinks" ? "drink" : "use";

  return { action, statChanges, timeMinutes };
}

export function validateItemUse(item: ItemDefinition | null): string | null {
  if (!item) return "Item definition is unavailable.";
  if (!item.usable) return "This item cannot be used.";
  if (!itemUseEffect(item)) return "This item's use effect is not configured.";
  return null;
}

export function hasValidItemDefinition(item: ItemDefinition): boolean {
  const capabilities = itemCapabilities(item);
  if (!Number.isInteger(item.value ?? 0) || (item.value ?? 0) < 0) return false;
  if (capabilities.stackable === false && capabilities.maxStack !== 1) return false;
  if (capabilities.maxStack !== null && capabilities.maxStack < STAT_MIN + 1) return false;
  if (capabilities.usable && !itemUseEffect(item)) return false;
  return true;
}

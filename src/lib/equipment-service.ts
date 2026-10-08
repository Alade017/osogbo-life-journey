import { normalizeInventoryCategory } from "@/lib/inventory-service";
import type { EquippedItem, EquipmentSlot, ItemDefinition } from "@/lib/player-state";

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  "head",
  "top",
  "bottom",
  "shoes",
  "accessory",
];

export function isEquipmentSlot(value: unknown): value is EquipmentSlot {
  return typeof value === "string" && EQUIPMENT_SLOTS.includes(value as EquipmentSlot);
}

export function validateEquipItem(
  item: ItemDefinition | null,
  requestedSlot: EquipmentSlot,
): string | null {
  if (!item) return "Item definition is unavailable.";
  const category = normalizeInventoryCategory(item);
  if (category === "food" || category === "drinks") return "Consumables cannot be equipped.";
  if (item.equippable !== true) return "This item cannot be equipped.";
  if (!isEquipmentSlot(item.equipment_slot)) return "This item has no valid equipment slot.";
  if (item.equipment_slot !== requestedSlot) {
    return `This item belongs in the ${item.equipment_slot} slot.`;
  }
  return null;
}

export function getEquipmentForSlot(
  equipment: readonly EquippedItem[],
  slot: EquipmentSlot,
): EquippedItem | null {
  return equipment.find((item) => item.slot === slot) ?? null;
}

export function replaceEquippedItem(
  equipment: readonly EquippedItem[],
  item: EquippedItem,
): { equipment: EquippedItem[]; displaced: EquippedItem | null } {
  const displaced = getEquipmentForSlot(equipment, item.slot);
  return {
    equipment: [...equipment.filter((equipped) => equipped.slot !== item.slot), item],
    displaced,
  };
}

export function removeEquippedItem(
  equipment: readonly EquippedItem[],
  slot: EquipmentSlot,
): { equipment: EquippedItem[]; removed: EquippedItem | null } {
  const removed = getEquipmentForSlot(equipment, slot);
  return {
    equipment: equipment.filter((equipped) => equipped.slot !== slot),
    removed,
  };
}

import { validateEquipItem } from "@/lib/equipment-service";
import { validateItemUse } from "@/lib/item-service";
import type { EquippedItem, EquipmentSlot, PlayerInventoryEntry } from "@/lib/player-state";

export type PlayerAction = "inspect" | "use" | "equip" | "unequip" | "discard";

export type PlayerActionRequest = {
  action: PlayerAction;
  characterId: string;
  inventoryEntry?: PlayerInventoryEntry | null;
  equippedItem?: EquippedItem | null;
  slot?: EquipmentSlot;
  quantity?: number;
};

function validateOwnedEntry(
  entry: PlayerInventoryEntry | null | undefined,
  characterId: string,
  quantity: number,
): string | null {
  if (!entry) return "You do not own this item.";
  if (entry.character_id !== characterId) return "This item belongs to another character.";
  if (!Number.isInteger(quantity) || quantity < 1) return "Choose a valid quantity.";
  if (!Number.isInteger(entry.quantity) || entry.quantity < quantity) {
    return "You do not have enough of this item.";
  }
  return null;
}

export function validatePlayerAction(request: PlayerActionRequest): string | null {
  const quantity = request.quantity ?? 1;

  if (request.action === "unequip") {
    if (!request.slot) return "Choose an equipment slot.";
    if (!request.equippedItem || request.equippedItem.slot !== request.slot) {
      return "There is no item equipped in that slot.";
    }
    if (request.equippedItem.character_id !== request.characterId) {
      return "This equipment belongs to another character.";
    }
    return null;
  }

  const ownershipError = validateOwnedEntry(
    request.inventoryEntry,
    request.characterId,
    request.action === "discard" ? quantity : 1,
  );
  if (ownershipError) return ownershipError;

  if (request.action === "use") return validateItemUse(request.inventoryEntry?.item ?? null);

  if (request.action === "equip") {
    if (!request.slot) return "Choose an equipment slot.";
    return validateEquipItem(request.inventoryEntry?.item ?? null, request.slot);
  }

  return null;
}

import { supabase } from "@/integrations/supabase/client";
import { isEquipmentSlot } from "@/lib/equipment-service";

/** One wearable kept in a drawer. The drawer is separate from the inventory. */
export type DrawerItem = {
  id: string;
  item_id: string;
  quantity: number;
  stored_at: string;
  category: string;
  slot_type: string;
  art_key: string;
};

export type DrawerState = {
  /** Server-defined size. The client never guesses it. */
  capacity: number;
  items: DrawerItem[];
};

export type DrawerInventoryRow = {
  id: string;
  item_id: string;
  category: string;
  slot_type: string;
};

export const DRAWER_ERROR_MESSAGES: Record<string, string> = {
  DRAWER_FULL: "Your drawer is full. Take something out first.",
  ITEM_WORN: "Take this off before you store it.",
  NOT_WEARABLE: "Only clothes, caps and footwear go in the drawer.",
  NOT_IN_DRAWER: "That item is no longer in your drawer.",
  NOT_OWNED: "You no longer have that item.",
  NOT_EQUIPPABLE: "This item cannot be worn.",
  ALREADY_OWNED: "You already own this item.",
};

/** Whether an inventory row is a wearable that may be stored: a clothes, cap, footwear or accessory slot. */
export function isStorableWearable(row: DrawerInventoryRow): boolean {
  return (
    (row.category === "outfit" || row.category === "accessory") && isEquipmentSlot(row.slot_type)
  );
}

/** Only wearables the player does not currently wear, in inventory order. */
export function storableRows(
  inventory: readonly DrawerInventoryRow[],
  worn: ReadonlySet<string>,
): DrawerInventoryRow[] {
  return inventory.filter((row) => isStorableWearable(row) && !worn.has(row.item_id));
}

/** Normalise the drawer payload from the server. Unknown or malformed fields become safe defaults. */
export function parseDrawerState(value: unknown): DrawerState | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const capacity = typeof record["capacity"] === "number" ? record["capacity"] : null;
  if (capacity === null || !Number.isInteger(capacity) || capacity < 0) return null;
  const rawItems = Array.isArray(record["items"]) ? record["items"] : [];
  const items = rawItems.flatMap((raw): DrawerItem[] => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    if (
      typeof item["id"] !== "string" ||
      typeof item["item_id"] !== "string" ||
      typeof item["category"] !== "string" ||
      typeof item["slot_type"] !== "string" ||
      typeof item["art_key"] !== "string"
    )
      return [];
    return [
      {
        id: item["id"],
        item_id: item["item_id"],
        quantity: typeof item["quantity"] === "number" ? item["quantity"] : 1,
        stored_at: typeof item["stored_at"] === "string" ? item["stored_at"] : "",
        category: item["category"],
        slot_type: item["slot_type"],
        art_key: item["art_key"],
      },
    ];
  });
  return { capacity, items };
}

/** Readable name for an item id, e.g. "wooden-wardrobe" becomes "wooden wardrobe". */
export function drawerItemName(itemId: string): string {
  return itemId.replaceAll("-", " ");
}

/** The message to show for a server error code, or a neutral fallback. */
export function drawerErrorMessage(code: string | null | undefined): string {
  if (code && DRAWER_ERROR_MESSAGES[code]) return DRAWER_ERROR_MESSAGES[code];
  return "That change was not saved. Try again.";
}

async function authorizedHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function fetchDrawerState(): Promise<DrawerState | null> {
  const response = await fetch("/api/drawer/state", { headers: await authorizedHeaders() });
  if (!response.ok) throw new Error("The drawer could not be loaded.");
  return parseDrawerState(await response.json().catch(() => null));
}

export type DrawerActionResult = { house: unknown; drawer: DrawerState | null };

/** Store, retrieve or equip a drawer item. The server returns the new house and drawer state. */
export async function drawerAction(
  action: "store" | "retrieve" | "equip",
  body: Record<string, string>,
): Promise<DrawerActionResult> {
  const response = await fetch(`/api/drawer/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await authorizedHeaders()) },
    body: JSON.stringify(body),
  });
  const result = (await response.json().catch(() => null)) as {
    state?: unknown;
    drawer?: unknown;
    error?: { code?: string };
  } | null;
  if (!response.ok) throw new Error(drawerErrorMessage(result?.error?.code));
  return { house: result?.state ?? null, drawer: parseDrawerState(result?.drawer) };
}

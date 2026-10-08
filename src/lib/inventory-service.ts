import type { ItemDefinition, PlayerInventoryEntry } from "@/lib/player-state";

export const INVENTORY_CATEGORIES = [
  "food",
  "drinks",
  "clothing",
  "tools",
  "electronics",
  "miscellaneous",
] as const;

export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const INVENTORY_CATEGORY_LABELS: Record<InventoryCategory, string> = {
  food: "Food",
  drinks: "Drinks",
  clothing: "Clothing",
  tools: "Tools",
  electronics: "Electronics",
  miscellaneous: "Miscellaneous",
};

export function normalizeInventoryCategory(
  item: Pick<ItemDefinition, "category" | "icon" | "slug" | "name"> | null,
): InventoryCategory {
  if (!item) return "miscellaneous";
  const category = item.category.trim().toLocaleLowerCase();
  const searchable = `${item.icon} ${item.slug} ${item.name}`.toLocaleLowerCase();

  if (category === "drink" || category === "drinks" || /water|drink|beverage/.test(searchable)) {
    return "drinks";
  }
  if (category === "food" || category === "consumable") return "food";
  if (category === "clothing" || category === "apparel") return "clothing";
  if (category === "tool" || category === "tools" || category === "gear") return "tools";
  if (category === "electronics" || category === "gadget") return "electronics";
  return "miscellaneous";
}

export function filterInventory(
  items: readonly PlayerInventoryEntry[],
  category: InventoryCategory | "all",
): PlayerInventoryEntry[] {
  if (category === "all") return [...items];
  return items.filter((entry) => normalizeInventoryCategory(entry.item) === category);
}

export function countInventoryUnits(items: readonly PlayerInventoryEntry[]): number {
  return items.reduce((total, entry) => total + Math.max(0, entry.quantity), 0);
}

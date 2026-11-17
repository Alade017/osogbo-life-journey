import { normalizeInventoryCategory } from "./inventory-service";
/** Use the existing inventory categorisation; never infer a menu, price or stat bonus from scene props. */
export function isDiningItem(item: Parameters<typeof normalizeInventoryCategory>[0]) {
  const category = normalizeInventoryCategory(item);
  return category === "food" || category === "drinks";
}

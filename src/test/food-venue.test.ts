import { expect, it } from "vitest";
import { isDiningItem } from "@/lib/food-venue";
import { BUKA_VENUE_DESIGN, getLocationVenueDesign } from "@/lib/location-venue-designs";
import { FOOD_VENUE_LAYOUTS } from "@/game/food-venue-layout";
it("uses the existing inventory categories for food offers", () => {
  const item = (category: string) => ({ category, icon: "", slug: "catalog-item", name: "Catalog item" });
  expect(isDiningItem(item("food"))).toBe(true);
  expect(isDiningItem(item("drinks"))).toBe(true);
  expect(isDiningItem(item("electronics"))).toBe(false);
  expect(isDiningItem(null)).toBe(false);
});
it("preserves the food court model and gives Buka its own canteen layout", () => {
  const court = getLocationVenueDesign("riverside-food-court", "Riverside");
  expect(court.foodInterior).toBe("courtyard");
  expect(court.environment?.url).toBe("/models/environments/market-and-bank/street-food-market-yard.glb");
  expect(court.fixtures.map(f => f.id)).toEqual(["riverside-counter", "riverside-tables", "riverside-planter"]);
  expect(BUKA_VENUE_DESIGN.foodInterior).toBe("buka");
  for (const f of BUKA_VENUE_DESIGN.fixtures) {
    expect(Math.abs(f.position[0])).toBeLessThan(FOOD_VENUE_LAYOUTS.buka.width / 2);
    expect(Math.abs(f.position[1])).toBeLessThan(FOOD_VENUE_LAYOUTS.buka.depth / 2);
  }
});

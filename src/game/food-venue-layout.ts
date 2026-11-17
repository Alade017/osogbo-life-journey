export const FOOD_VENUE_LAYOUTS = {
  courtyard: { width: 10, depth: 7 },
  buka: { width: 12, depth: 9 },
} as const;
export type FoodVenueVariant = keyof typeof FOOD_VENUE_LAYOUTS;

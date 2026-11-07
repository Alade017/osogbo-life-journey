// Cooking menu: Osun dishes grouped by tier. Presentation only; every dish uses the cook action.
// Raw ingredients are not listed; they are not dishes.
export type MealTier = "street" | "home" | "prestige" | "party";

export const MEAL_TIERS: { id: MealTier; label: string }[] = [
  { id: "street", label: "Street food & quick meals" },
  { id: "home", label: "Home-cooked staples" },
  { id: "prestige", label: "Prestige & gourmet" },
  { id: "party", label: "Party food" },
];

export const MEALS = [
  { id: "bread-tea", tier: "street", name: "Bread & tea", symbol: "🍞" },
  { id: "ojojo", tier: "street", name: "Ojojo", symbol: "🍌" },
  { id: "kokoro", tier: "street", name: "Kokoro", symbol: "🍠" },
  { id: "boiled-plantain-egg", tier: "street", name: "Boiled plantain & egg", symbol: "🍳" },
  { id: "fried-dodo", tier: "street", name: "Fried dodo", symbol: "🍌" },
  { id: "jollof", tier: "home", name: "Jollof rice", symbol: "🍚" },
  { id: "ewa-agoyin", tier: "home", name: "Ewa agoyin", symbol: "🫘" },
  { id: "eba-ewedu", tier: "home", name: "Eba & ewedu", symbol: "🥬" },
  { id: "amala-gbegiri", tier: "home", name: "Amala & gbegiri", symbol: "🥣" },
  { id: "yam-porridge", tier: "home", name: "Yam porridge", symbol: "🍲" },
  { id: "ofada-ayamase", tier: "home", name: "Ofada rice & ayamase", symbol: "🍛" },
  { id: "pounded-yam-egusi", tier: "prestige", name: "Pounded yam & egusi", symbol: "🍲" },
  { id: "efo-riro", tier: "prestige", name: "Efo riro", symbol: "🥬" },
  { id: "ikokore", tier: "prestige", name: "Ikokore", symbol: "🐟" },
  { id: "suya-platter", tier: "prestige", name: "Suya platter", symbol: "🍢" },
  { id: "isi-ewu", tier: "prestige", name: "Isi ewu", symbol: "🐐" },
  { id: "party-jollof", tier: "party", name: "Party jollof", symbol: "🔥" },
  { id: "moin-moin", tier: "party", name: "Moin moin", symbol: "🫔" },
  { id: "akara-ogi", tier: "party", name: "Akara & ogi", symbol: "🧆" },
  { id: "small-chops", tier: "party", name: "Small chops platter", symbol: "🥟" },
  { id: "chin-chin", tier: "party", name: "Chin chin", symbol: "🍪" },
] as const;

export const DEFAULT_MEAL_ID = "jollof";

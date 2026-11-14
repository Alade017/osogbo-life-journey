import type { NeighborhoodZoneTag } from "./neighborhood-zones.ts";
import type { WorldPoint } from "./neighborhood-model.ts";
import type { NeedName } from "../lib/life-simulation.ts";

export type InteractableCategory =
  "filling-station" | "bank" | "adire" | "market" | "shops" | "transit" | "npc";

export type ZoneActionOutcome = {
  id: string;
  label: string;
  description: string;
  /** Positive adds Naira to pocket wallet; negative spends Naira from pocket wallet. */
  walletDelta: number;
  /** Optional bank savings delta when depositing/withdrawing via ATM or Bank Lobby. */
  bankDelta?: number;
  needDeltas?: Partial<Record<NeedName, number>>;
  xpGain?: number;
  craftItem?: {
    slug: string;
    name: string;
    category: string;
    description: string;
    slot?: "accessory" | "top" | "bottom" | "shoes";
  };
  equipSlot?: {
    slot: "accessory" | "top" | "bottom" | "shoes";
    slug: string;
    name: string;
  };
  toastMessage: string;
  activityKind?: "purchase" | "shift" | "craft" | "service" | "transit";
};

export interface InteractableZoneSpec {
  id: string;
  zoneTag: NeighborhoodZoneTag;
  category: InteractableCategory;
  title: string;
  subtitle: string;
  promptLabel: string;
  /** 3D scene world anchor where the ring, collider, and badge appear. */
  position: WorldPoint;
  /** Verified walkable point where tap-to-walk routes the player before opening the interaction. */
  accessPoint: WorldPoint;
  interactRadius: number;
  ringRadius: number;
  badgeHeight: number;
  hitSize: [number, number, number];
  /** Optional linked shop slug or travel mode hint. */
  shopSlug?: string | null;
  actions: readonly ZoneActionOutcome[];
}

export interface ZoneNpcSpec {
  id: string;
  name: string;
  role: string;
  zoneTag: NeighborhoodZoneTag;
  position: WorldPoint;
  accessPoint: WorldPoint;
  shirtColor: string;
  trouserColor: string;
  accentColor: string;
  greeting: string;
  tips: readonly string[];
  /** Optional DB npc_definitions id if mirrored on the server. */
  catalogNpcId?: string;
}

export const NEIGHBORHOOD_INTERACTABLE_ZONES: readonly InteractableZoneSpec[] = [
  {
    id: "zone-fuel-pumps",
    zoneTag: "FILLING_STATION",
    category: "filling-station",
    title: "Fuel & Go Forecourt Pumps",
    subtitle: "Refuel vehicles, stock 10L jerrycans, or clock in as a station attendant.",
    promptLabel: "Fuel Pumps",
    position: { x: 668, y: 250 },
    accessPoint: { x: 668, y: 242 },
    interactRadius: 88,
    ringRadius: 1.05,
    badgeHeight: 2.35,
    hitSize: [2.2, 2.4, 3.6],
    actions: [
      {
        id: "fuel-buy-jerrycan",
        label: "Buy 10L Petrol Jerrycan",
        description: "Fill a yellow 10L emergency keg for generator or trips.",
        walletDelta: -3200,
        xpGain: 12,
        craftItem: {
          slug: "fuel_jerrycan_10l",
          name: "10L Petrol Jerrycan",
          category: "utility",
          description: "Bright yellow 10L fuel keg filled at Olaiya Fuel & Go.",
        },
        toastMessage: "Filled a 10L Petrol Jerrycan (₦3,200) — added to inventory.",
        activityKind: "purchase",
      },
      {
        id: "fuel-attendant-shift",
        label: "Work Attendant Shift",
        description: "Serve motorists along Left Avenue for quick pocket cash.",
        walletDelta: 2600,
        needDeltas: { energy: -16, hunger: -10, social: 6 },
        xpGain: 28,
        toastMessage: "Completed a Fuel & Go attendant shift (+₦2,600).",
        activityKind: "shift",
      },
    ],
  },
  {
    id: "zone-mini-mart",
    zoneTag: "FILLING_STATION",
    category: "filling-station",
    title: "Fuel & Go Mini-Mart",
    subtitle: "Air-conditioned convenience counter with snacks, chilled drinks, and essentials.",
    promptLabel: "Enter Mart",
    position: { x: 820, y: 230 },
    accessPoint: { x: 805, y: 205 },
    interactRadius: 84,
    ringRadius: 1.0,
    badgeHeight: 2.55,
    hitSize: [2.4, 2.8, 3.6],
    shopSlug: null,
    actions: [
      {
        id: "mart-meatpie-water",
        label: "Meat Pie & Chilled Water",
        description: "Quick forecourt combo to restore hunger and hydration.",
        walletDelta: -950,
        needDeltas: { hunger: 26, energy: 10, fun: 4 },
        xpGain: 8,
        toastMessage: "Enjoyed Meat Pie & Chilled Water (+26 Hunger, +10 Energy).",
        activityKind: "purchase",
      },
      {
        id: "mart-chilled-malt",
        label: "Chilled Malt & Gala",
        description: "Boost energy and mood before your next neighbourhood hustle.",
        walletDelta: -1200,
        needDeltas: { hunger: 20, energy: 18, fun: 8 },
        xpGain: 10,
        craftItem: {
          slug: "mart_energy_pack",
          name: "Gala & Malt Pack",
          category: "food",
          description: "Quick energy snack pack from Fuel & Go Mini-Mart.",
        },
        toastMessage: "Bought Gala & Chilled Malt (+20 Hunger, +18 Energy).",
        activityKind: "purchase",
      },
    ],
  },
  {
    id: "zone-vulcanizer",
    zoneTag: "FILLING_STATION",
    category: "filling-station",
    title: "Vulcanizer & Tire Corner",
    subtitle: "Pump tires, patch tubes, or lend a hand at the compressor.",
    promptLabel: "Vulcanizer",
    position: { x: 615, y: 412 },
    accessPoint: { x: 615, y: 358 },
    interactRadius: 84,
    ringRadius: 0.95,
    badgeHeight: 2.4,
    hitSize: [1.8, 2.2, 1.8],
    actions: [
      {
        id: "vulcanizer-check",
        label: "Air Gauge & Patch Hustle",
        description: "Help pump danfo & okada tires under the umbrella.",
        walletDelta: 1400,
        needDeltas: { energy: -10, hygiene: -4, social: 6 },
        xpGain: 18,
        toastMessage: "Pumped commuter tires at the vulcanizer corner (+₦1,400).",
        activityKind: "shift",
      },
      {
        id: "vulcanizer-kit",
        label: "Buy Mini Tire Inflator",
        description: "Handy roadside inflator kit stored in your pack.",
        walletDelta: -2500,
        xpGain: 12,
        craftItem: {
          slug: "tire_patch_kit",
          name: "Roadside Tire Kit",
          category: "utility",
          description: "Compact tire patch & valve kit from Olaiya vulcanizer.",
        },
        toastMessage: "Picked up Roadside Tire Kit (₦2,500) — added to inventory.",
        activityKind: "purchase",
      },
    ],
  },
  {
    id: "zone-bank-atm",
    zoneTag: "BANK",
    category: "bank",
    title: "Meridian Bank ATM Alcove",
    subtitle: "24/7 exterior cash point for quick withdrawals, deposits, and receipts.",
    promptLabel: "Use ATM",
    position: { x: 1130, y: 110 },
    accessPoint: { x: 1136, y: 110 },
    interactRadius: 82,
    ringRadius: 0.95,
    badgeHeight: 2.55,
    hitSize: [1.6, 2.6, 2.2],
    actions: [
      {
        id: "atm-withdraw-2000",
        label: "Quick Withdraw ₦2,000",
        description: "Pull spending cash from bank savings straight to pocket.",
        walletDelta: 2000,
        bankDelta: -2000,
        xpGain: 5,
        toastMessage: "Withdrew ₦2,000 from Meridian ATM to pocket cash.",
        activityKind: "service",
      },
      {
        id: "atm-deposit-2000",
        label: "Quick Deposit ₦2,000",
        description: "Secure pocket Naira into your Osun Bank savings.",
        walletDelta: -2000,
        bankDelta: 2000,
        xpGain: 5,
        toastMessage: "Deposited ₦2,000 into Osun Bank savings via ATM.",
        activityKind: "service",
      },
    ],
  },
  {
    id: "zone-bank-lobby",
    zoneTag: "BANK",
    category: "bank",
    title: "Meridian Bank Customer Lobby",
    subtitle: "Walk-in teller hall for deposits, withdrawals, account status, and ledger.",
    promptLabel: "Bank Lobby",
    position: { x: 1015, y: 36 },
    accessPoint: { x: 1020, y: 24 },
    interactRadius: 88,
    ringRadius: 1.05,
    badgeHeight: 2.6,
    hitSize: [2.4, 3.2, 2.8],
    actions: [
      {
        id: "bank-deposit-5000",
        label: "Teller Deposit ₦5,000",
        description: "Deposit pocket earnings into savings with zero queue.",
        walletDelta: -5000,
        bankDelta: 5000,
        xpGain: 10,
        toastMessage: "Teller confirmed ₦5,000 deposit to bank savings.",
        activityKind: "service",
      },
      {
        id: "bank-withdraw-5000",
        label: "Teller Withdraw ₦5,000",
        description: "Withdraw market budget cash from your savings.",
        walletDelta: 5000,
        bankDelta: -5000,
        xpGain: 8,
        toastMessage: "Teller dispensed ₦5,000 to your pocket wallet.",
        activityKind: "service",
      },
    ],
  },
  {
    id: "zone-adire-vats",
    zoneTag: "ADIRE_MARKET",
    category: "adire",
    title: "Indigo Dye Vats & Zinc Shed",
    subtitle: "Traditional Osogbo cassava-resist dyeing pits steeped in deep indigo (#16225C).",
    promptLabel: "Dye Adire",
    position: { x: -165, y: 50 },
    accessPoint: { x: -165, y: 112 },
    interactRadius: 90,
    ringRadius: 1.1,
    badgeHeight: 2.6,
    hitSize: [3.0, 2.6, 2.4],
    actions: [
      {
        id: "adire-craft-wrapper",
        label: "Dye Adire Eleko Cloth",
        description: "Dip tied cotton cloth into indigo vats and add to inventory.",
        walletDelta: -1500,
        needDeltas: { fun: 16, energy: -8, hygiene: -4 },
        xpGain: 32,
        craftItem: {
          slug: "adire_indigo_wrapper",
          name: "Indigo Adire Eleko Cloth",
          category: "craft",
          description: "Hand-dyed deep indigo Osogbo Adire cloth crafted at the yard.",
        },
        toastMessage: "Dyed Indigo Adire Eleko Cloth (+16 Fun, +32 XP) — added to inventory!",
        activityKind: "craft",
      },
      {
        id: "adire-artisan-shift",
        label: "Work Adire Artisan Shift",
        description: "Stir indigo vats and press starch patterns for local weavers.",
        walletDelta: 3400,
        needDeltas: { energy: -18, hunger: -10, social: 8, fun: 10 },
        xpGain: 36,
        toastMessage: "Completed an Adire artisan shift (+₦3,400, +36 XP).",
        activityKind: "shift",
      },
    ],
  },
  {
    id: "zone-adire-racks",
    zoneTag: "ADIRE_MARKET",
    category: "adire",
    title: "Adire Drying & Folding Racks",
    subtitle: "Sun-dried indigo patterns hanging across wooden market frames.",
    promptLabel: "Fold Adire",
    position: { x: 15, y: 92 },
    accessPoint: { x: 15, y: 88 },
    interactRadius: 88,
    ringRadius: 1.0,
    badgeHeight: 2.35,
    hitSize: [2.6, 2.3, 2.8],
    actions: [
      {
        id: "adire-craft-scarf",
        label: "Craft Indigo Adire Scarf",
        description: "Finish and fold a sun-cured indigo neck scarf.",
        walletDelta: -900,
        needDeltas: { fun: 12, energy: -5 },
        xpGain: 22,
        craftItem: {
          slug: "adire_indigo_scarf",
          name: "Indigo Adire Scarf",
          category: "craft",
          description: "Sun-cured cassava-resist indigo scarf from Olaiya Makers' Yard.",
        },
        toastMessage: "Folded a fresh Indigo Adire Scarf — added to inventory!",
        activityKind: "craft",
      },
      {
        id: "adire-sell-batch",
        label: "Package Market Bundle",
        description: "Bundle dried Adire sheets for wholesale traders.",
        walletDelta: 1800,
        needDeltas: { energy: -10, social: 6 },
        xpGain: 20,
        toastMessage: "Packaged dried Adire sheets for traders (+₦1,800).",
        activityKind: "shift",
      },
    ],
  },
  {
    id: "zone-market-stalls",
    zoneTag: "ADIRE_MARKET",
    category: "market",
    title: "Open Market Produce & Cloth Tables",
    subtitle: "Umbrella stalls stocked with staples, groceries, and folded yardage.",
    promptLabel: "Market Stalls",
    position: { x: -10, y: 325 },
    accessPoint: { x: -10, y: 274 },
    interactRadius: 90,
    ringRadius: 1.05,
    badgeHeight: 2.5,
    hitSize: [3.2, 2.5, 1.8],
    shopSlug: "market-sales-stall",
    actions: [
      {
        id: "market-groceries-bag",
        label: "Buy Plantain & Garri Staples",
        description: "Fresh roadside produce basket to restock home supplies.",
        walletDelta: -1600,
        needDeltas: { hunger: 14, social: 4 },
        xpGain: 12,
        craftItem: {
          slug: "olaiya_groceries_basket",
          name: "Olaiya Groceries Basket",
          category: "groceries",
          description: "Ripe plantain, ijebu garri, and groundnuts from the open market.",
        },
        toastMessage: "Bought Olaiya Groceries Basket (₦1,600) — added to inventory.",
        activityKind: "purchase",
      },
      {
        id: "market-fresh-oranges",
        label: "Peel Oranges & Roasted Corn",
        description: "Quick market snack for instant energy and thirst relief.",
        walletDelta: -500,
        needDeltas: { hunger: 16, energy: 8, fun: 6 },
        xpGain: 6,
        toastMessage: "Had Roasted Corn & Fresh Oranges (+16 Hunger, +8 Energy).",
        activityKind: "purchase",
      },
    ],
  },
  {
    id: "zone-buka-stall",
    zoneTag: "ADIRE_MARKET",
    category: "market",
    title: "Mama Sikira Buka Kitchen",
    subtitle: "Steaming local pots serving hot Amala, Ewedu, Jollof Rice, and chilled Zobo.",
    promptLabel: "Buka Meals",
    position: { x: 165, y: 325 },
    accessPoint: { x: 165, y: 272 },
    interactRadius: 86,
    ringRadius: 1.0,
    badgeHeight: 2.45,
    hitSize: [2.2, 2.4, 1.8],
    actions: [
      {
        id: "buka-amala-ewedu",
        label: "Amala, Ewedu & Gbegiri",
        description: "Hearty hot Osogbo buka plate that fills your hunger bar fast.",
        walletDelta: -1500,
        needDeltas: { hunger: 45, energy: 14, fun: 10, social: 5 },
        xpGain: 14,
        toastMessage: "Finished hot Amala & Ewedu (+45 Hunger, +14 Energy)!",
        activityKind: "purchase",
      },
      {
        id: "buka-jollof-zobo",
        label: "Smoky Jollof & Cold Zobo",
        description: "Party jollof with spiced hibiscus drink for full refreshment.",
        walletDelta: -1800,
        needDeltas: { hunger: 38, energy: 18, fun: 14 },
        xpGain: 14,
        toastMessage: "Enjoyed Smoky Jollof & Cold Zobo (+38 Hunger, +18 Energy)!",
        activityKind: "purchase",
      },
    ],
  },
  {
    id: "zone-shop-barber",
    zoneTag: "COMMERCIAL_SHOPS",
    category: "shops",
    title: "Dele Cutz Barber Salon",
    subtitle: "Walk-in clippers & grooming shop keeping your fade crisp and fresh.",
    promptLabel: "Barber Shop",
    position: { x: 1515, y: 65 },
    accessPoint: { x: 1502, y: 55 },
    interactRadius: 86,
    ringRadius: 1.0,
    badgeHeight: 2.75,
    hitSize: [2.6, 3.0, 2.4],
    actions: [
      {
        id: "barber-fresh-fade",
        label: "Fresh Skin Fade & Beard Trim",
        description: "Full grooming service boosting hygiene and confidence.",
        walletDelta: -1500,
        needDeltas: { hygiene: 38, fun: 18, social: 8 },
        xpGain: 16,
        toastMessage: "Stepped out with a crisp fade (+38 Hygiene, +18 Fun)!",
        activityKind: "service",
      },
      {
        id: "barber-hot-towel",
        label: "Cool Wash & Hot Towel Refresh",
        description: "Quick spruce-up between errands.",
        walletDelta: -700,
        needDeltas: { hygiene: 22, energy: 8, fun: 8 },
        xpGain: 8,
        toastMessage: "Hot towel refresh complete (+22 Hygiene, +8 Energy).",
        activityKind: "service",
      },
    ],
  },
  {
    id: "zone-shop-pos",
    zoneTag: "COMMERCIAL_SHOPS",
    category: "shops",
    title: "FastCash POS & Airtime Kiosk",
    subtitle: "Instant roadside cash-out, airtime recharge, and utility bill payments.",
    promptLabel: "POS Kiosk",
    position: { x: 1515, y: 190 },
    accessPoint: { x: 1452, y: 185 },
    interactRadius: 82,
    ringRadius: 0.95,
    badgeHeight: 2.55,
    hitSize: [2.0, 2.5, 1.8],
    actions: [
      {
        id: "pos-cashout-2000",
        label: "POS Cash-Out ₦2,000 (₦100 fee)",
        description: "Convert ₦2,100 from bank savings into instant pocket cash.",
        walletDelta: 2000,
        bankDelta: -2100,
        xpGain: 6,
        toastMessage: "POS agent handed you ₦2,000 cash (₦100 convenience fee).",
        activityKind: "service",
      },
      {
        id: "pos-airtime-topup",
        label: "Buy ₦500 Airtime & Data Bundle",
        description: "Top up your phone for faster social calls and job alerts.",
        walletDelta: -500,
        needDeltas: { fun: 12, social: 14 },
        xpGain: 8,
        toastMessage: "Recharged ₦500 Airtime & Data (+14 Social, +12 Fun).",
        activityKind: "service",
      },
    ],
  },
  {
    id: "zone-shop-accessory",
    zoneTag: "COMMERCIAL_SHOPS",
    category: "shops",
    title: "Iya Adire Style & Accessories",
    subtitle: "Walk-in boutique for leather backpacks, woven totes, and streetwear accents.",
    promptLabel: "Accessories",
    position: { x: 1515, y: 345 },
    accessPoint: { x: 1502, y: 335 },
    interactRadius: 86,
    ringRadius: 1.0,
    badgeHeight: 2.75,
    hitSize: [2.6, 3.0, 2.4],
    actions: [
      {
        id: "accessory-leather-backpack",
        label: "Buy & Equip Leather Backpack",
        description: "Sturdy Osogbo craft backpack worn visibly on your character.",
        walletDelta: -4500,
        needDeltas: { fun: 18, social: 10 },
        xpGain: 25,
        craftItem: {
          slug: "backpack",
          name: "Craft Leather Backpack",
          category: "accessory",
          description: "Wearable brown leather field backpack from Iya Adire Style.",
          slot: "accessory",
        },
        equipSlot: {
          slot: "accessory",
          slug: "backpack",
          name: "Craft Leather Backpack",
        },
        toastMessage: "Bought & equipped Craft Leather Backpack on your character!",
        activityKind: "purchase",
      },
      {
        id: "accessory-indigo-cap",
        label: "Buy Adire Street Cap",
        description: "Indigo-dyed snapback added to your wardrobe collection.",
        walletDelta: -1800,
        needDeltas: { fun: 12, social: 8 },
        xpGain: 14,
        craftItem: {
          slug: "adire_street_cap",
          name: "Adire Indigo Cap",
          category: "accessory",
          description: "Hand-dyed indigo cap from Olaiya lock-up shops.",
        },
        toastMessage: "Bought Adire Indigo Cap (+12 Fun, +8 Social) — added to inventory.",
        activityKind: "purchase",
      },
    ],
  },
  {
    id: "zone-transit-stand",
    zoneTag: "COMMERCIAL_SHOPS",
    category: "transit",
    title: "Keke Napep & Korope Loading Stand",
    subtitle: "Catch a ride across Osogbo districts or run a fast shuttle trip for fares.",
    promptLabel: "Board Korope",
    position: { x: 1362, y: 290 },
    accessPoint: { x: 1322, y: 295 },
    interactRadius: 96,
    ringRadius: 1.15,
    badgeHeight: 2.35,
    hitSize: [2.2, 2.4, 5.2],
    actions: [
      {
        id: "transit-korope-hustle",
        label: "Run Olaiya–Oja Oba Korope Trip",
        description: "Assist conductor & collect passenger fares on a quick loop.",
        walletDelta: 2800,
        needDeltas: { energy: -16, hunger: -8, social: 12 },
        xpGain: 30,
        toastMessage: "Completed Korope shuttle run (+₦2,800, +12 Social)!",
        activityKind: "shift",
      },
      {
        id: "transit-keke-ride",
        label: "Quick Keke Commute Refresh",
        description: "Hop a breezy Keke Napep stretch to clear your head.",
        walletDelta: -300,
        needDeltas: { fun: 14, energy: -4, social: 6 },
        xpGain: 10,
        toastMessage: "Took a breezy Keke ride around Olaiya (+14 Fun).",
        activityKind: "transit",
      },
    ],
  },
];

export const NEIGHBORHOOD_ZONE_NPCS: readonly ZoneNpcSpec[] = [
  {
    id: "zone-npc-tunde",
    name: "Tunde · Pump Attendant",
    role: "Fuel & Go Attendant",
    zoneTag: "FILLING_STATION",
    position: { x: 618, y: 168 },
    accessPoint: { x: 618, y: 196 },
    shirtColor: "#0f766e",
    trouserColor: "#1e293b",
    accentColor: "#f59e0b",
    greeting: "Welcome to Fuel & Go! Morning queue is moving fast today.",
    tips: [
      "Step straight inside the Mini-Mart door for chilled water and meat pies — no queue inside.",
      "Our vulcanizer at the south corner checks tires and pays extra for quick compressor help.",
      "Need emergency fuel at home? Grab a yellow 10L jerrycan right at the pumps.",
    ],
  },
  {
    id: "zone-npc-musa",
    name: "Musa · Bank Security",
    role: "Meridian Guard",
    zoneTag: "BANK",
    position: { x: 1172, y: 192 },
    accessPoint: { x: 1152, y: 192 },
    shirtColor: "#1e3a8a",
    trouserColor: "#0f172a",
    accentColor: "#38bdf8",
    greeting: "Afternoon, neighbour. Keep your Naira safe in your savings.",
    tips: [
      "The exterior ATM alcove is open around the clock, or walk right through the glass doors to the teller hall.",
      "Depositing pocket cash keeps it protected while you explore busy market rows.",
      "Notice our gated parking courtyard on the south side? Staff and customers pull in from Right Avenue.",
    ],
  },
  {
    id: "zone-npc-risi",
    name: "Iya Risi · Adire Master",
    role: "Indigo Dyer",
    zoneTag: "ADIRE_MARKET",
    position: { x: -82, y: 78 },
    accessPoint: { x: -82, y: 112 },
    shirtColor: "#16225C",
    trouserColor: "#312e81",
    accentColor: "#e2e8f0",
    greeting: "E kaabo! The indigo bath is rich and deep today.",
    tips: [
      "Cassava paste resists the indigo dye so every Adire Eleko wrapper carries a crisp Osogbo pattern.",
      "Tap the dye vats under the zinc shed to dye cloth or pick up an artisan shift.",
      "Fresh cloth dries fast on the wooden racks — grab one for your collection anytime.",
    ],
  },
  {
    id: "zone-npc-sikira",
    name: "Mama Sikira · Buka Chef",
    role: "Market Cook",
    zoneTag: "ADIRE_MARKET",
    position: { x: 112, y: 312 },
    accessPoint: { x: 112, y: 274 },
    shirtColor: "#c2410c",
    trouserColor: "#7c2d12",
    accentColor: "#fde68a",
    greeting: "Amala is piping hot! Come eat well before you tire out.",
    tips: [
      "Never let your hunger drop low when working shifts — a plate of Amala & Ewedu restores energy fast.",
      "The produce tables beside my buka stall sell fresh plantain and garri staples for later.",
      "Pair your jollof with chilled zobo to boost mood and social energy together.",
    ],
  },
  {
    id: "zone-npc-chidi",
    name: "Chidi · Korope Rider",
    role: "Transit Regular",
    zoneTag: "COMMERCIAL_SHOPS",
    position: { x: 1332, y: 162 },
    accessPoint: { x: 1312, y: 162 },
    shirtColor: "#ca8a04",
    trouserColor: "#1f2937",
    accentColor: "#fef08a",
    greeting: "Oja-Oba, Ataoja Palace, or Oke-Fia — Korope leaves every few minutes!",
    tips: [
      "Walk into Dele Cutz Barber or Iya Adire Accessories — both lock-up shops open straight inside.",
      "FastCash POS handles quick cash-outs and airtime when you do not want to cross to the bank.",
      "Tap the yellow Korope minibus on the shoulder bay to pick any Osogbo district route.",
    ],
  },
];

export function findInteractableZone(id: string | null | undefined): InteractableZoneSpec | null {
  if (!id) return null;
  return NEIGHBORHOOD_INTERACTABLE_ZONES.find((zone) => zone.id === id) ?? null;
}

export function findZoneNpc(id: string | null | undefined): ZoneNpcSpec | null {
  if (!id) return null;
  return NEIGHBORHOOD_ZONE_NPCS.find((npc) => npc.id === id) ?? null;
}

export function nearestInteractableZone(
  point: WorldPoint,
  zones: readonly InteractableZoneSpec[] = NEIGHBORHOOD_INTERACTABLE_ZONES,
): { zone: InteractableZoneSpec; distance: number } | null {
  let best: { zone: InteractableZoneSpec; distance: number } | null = null;
  for (const zone of zones) {
    const dCenter = Math.hypot(point.x - zone.position.x, point.y - zone.position.y);
    const dAccess = Math.hypot(point.x - zone.accessPoint.x, point.y - zone.accessPoint.y);
    const distance = Math.min(dCenter, dAccess);
    if (distance <= zone.interactRadius && (!best || distance < best.distance)) {
      best = { zone, distance };
    }
  }
  return best;
}

export function nearestZoneNpc(
  point: WorldPoint,
  npcs: readonly ZoneNpcSpec[] = NEIGHBORHOOD_ZONE_NPCS,
  radius = 78,
): { npc: ZoneNpcSpec; distance: number } | null {
  let best: { npc: ZoneNpcSpec; distance: number } | null = null;
  for (const npc of npcs) {
    const distance = Math.min(
      Math.hypot(point.x - npc.position.x, point.y - npc.position.y),
      Math.hypot(point.x - npc.accessPoint.x, point.y - npc.accessPoint.y),
    );
    if (distance <= radius && (!best || distance < best.distance)) {
      best = { npc, distance };
    }
  }
  return best;
}

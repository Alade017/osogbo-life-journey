import { neighborhoodSceneBounds, type WorldPoint } from "../game/neighborhood-model.ts";
import { findInteractableZone } from "../game/neighborhood-interactions.ts";
import type { NeighborhoodZoneTag } from "../game/neighborhood-zones.ts";
import { WORLD_SCALE } from "../components/3d/world-theme.ts";

export type NeighborhoodFilterCategory = "all" | "work-hustle" | "food-shops" | "banking-transit";

export type LandmarkCategoryKey = Exclude<NeighborhoodFilterCategory, "all">;

export interface NeighborhoodLandmarkActivity {
  id: string;
  label: string;
  detail: string;
  kind: "craft" | "shift" | "food" | "shop" | "bank" | "transit";
}

export interface NeighborhoodLandmarkSpec {
  id: string;
  name: string;
  shortLabel: string;
  zoneTag: NeighborhoodZoneTag;
  zoneCategory: LandmarkCategoryKey;
  badgeLabel: string;
  accentColor: "#16225C" | "#F2B21C" | "#1E9A5F" | "#C8452D";
  description: string;
  /** Simulation scene coordinates [x, y] matching neighborhood-zones.ts & neighborhood-interactions.ts. */
  scenePoint: WorldPoint;
  /** Verified walkable front entrance where "Walk Here" routes the character. */
  walkToPoint: WorldPoint;
  /** Verified walkable curb drop-off point where "Board Keke / Korope" lands the character. */
  dropOffPoint: WorldPoint;
  /** Exact 3D scene [x, z] coordinates in meters (synced with R3FNeighborhoodSurface). */
  world3D: readonly [number, number];
  /** Normalized 2D interactive map coordinates in [0..1] across OLAIYA_MAP_VIEWPORT. */
  mapCoords: Readonly<{ x: number; y: number }>;
  /** Small Naira fare for Keke / Korope fast-travel drop-off. */
  kekeFare: number;
  /** Primary InteractableZone ID opened automatically on arrival. */
  primaryZoneId: string;
  /** All sub-zone IDs located at this landmark. */
  zoneIds: readonly string[];
  activities: readonly NeighborhoodLandmarkActivity[];
}

export interface SurroundingDistrictNode {
  id: string;
  landmarkId: string;
  name: string;
  directionLabel: string;
  compassPosition: "north" | "south" | "east" | "west";
  summary: string;
}

export const OLAIYA_ORIGIN: WorldPoint = { x: 7, y: 6 };
export const OLAIYA_SCENE_BOUNDS = neighborhoodSceneBounds(OLAIYA_ORIGIN);

/** Viewport window covering the interactive Olaiya hero block & surrounding avenues on the 2D City Map. */
export const OLAIYA_MAP_VIEWPORT = {
  minX: -380,
  maxX: 1700,
  minY: -220,
  maxY: 580,
} as const;

export function scenePointToThreeXZ(
  point: WorldPoint,
  bounds: { left: number; top: number; width: number; height: number } = OLAIYA_SCENE_BOUNDS,
): readonly [number, number] {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const centerX = bounds.left + bounds.width / 2;
  const centerZ = bounds.top + bounds.height / 2;
  return [
    Math.round((point.x - centerX) * unit * 100) / 100,
    Math.round((point.y - centerZ) * unit * 100) / 100,
  ];
}

export function threeXZToScenePoint(
  x3d: number,
  z3d: number,
  bounds: { left: number; top: number; width: number; height: number } = OLAIYA_SCENE_BOUNDS,
): WorldPoint {
  const unit = WORLD_SCALE.neighborhoodUnit;
  const centerX = bounds.left + bounds.width / 2;
  const centerZ = bounds.top + bounds.height / 2;
  return {
    x: Math.round((centerX + x3d / unit) * 100) / 100,
    y: Math.round((centerZ + z3d / unit) * 100) / 100,
  };
}

export function scenePointToNormalized2D(point: WorldPoint): { x: number; y: number } {
  const spanX = OLAIYA_MAP_VIEWPORT.maxX - OLAIYA_MAP_VIEWPORT.minX;
  const spanY = OLAIYA_MAP_VIEWPORT.maxY - OLAIYA_MAP_VIEWPORT.minY;
  const clamp = (value: number) => Math.min(0.96, Math.max(0.04, value));
  return {
    x: Math.round(clamp((point.x - OLAIYA_MAP_VIEWPORT.minX) / spanX) * 1000) / 1000,
    y: Math.round(clamp((point.y - OLAIYA_MAP_VIEWPORT.minY) / spanY) * 1000) / 1000,
  };
}

export const NEIGHBORHOOD_FILTER_PILLS: readonly {
  id: NeighborhoodFilterCategory;
  label: string;
}[] = [
  { id: "all", label: "All" },
  { id: "work-hustle", label: "Work & Hustle" },
  { id: "food-shops", label: "Food & Shops" },
  { id: "banking-transit", label: "Banking & Transit" },
];

export const HOME_MAP_ANCHOR: Readonly<{
  name: string;
  scenePoint: WorldPoint;
  world3D: readonly [number, number];
  mapCoords: Readonly<{ x: number; y: number }>;
}> = {
  name: "Your Home Entrance",
  scenePoint: { x: 320, y: 300 },
  world3D: scenePointToThreeXZ({ x: 320, y: 300 }),
  mapCoords: scenePointToNormalized2D({ x: 320, y: 300 }),
};

function requireZoneAccess(zoneId: string, fallback: WorldPoint): WorldPoint {
  return findInteractableZone(zoneId)?.accessPoint ?? fallback;
}

function buildLandmark(spec: {
  id: string;
  name: string;
  shortLabel: string;
  zoneTag: NeighborhoodZoneTag;
  zoneCategory: LandmarkCategoryKey;
  badgeLabel: string;
  accentColor: "#16225C" | "#F2B21C" | "#1E9A5F" | "#C8452D";
  description: string;
  scenePoint: WorldPoint;
  dropOffPoint: WorldPoint;
  kekeFare: number;
  primaryZoneId: string;
  zoneIds: readonly string[];
  activities: readonly NeighborhoodLandmarkActivity[];
}): NeighborhoodLandmarkSpec {
  const walkToPoint = requireZoneAccess(spec.primaryZoneId, spec.scenePoint);
  return {
    ...spec,
    walkToPoint,
    world3D: scenePointToThreeXZ(spec.scenePoint),
    mapCoords: scenePointToNormalized2D(spec.scenePoint),
  };
}

export const NEIGHBORHOOD_LANDMARKS: readonly NeighborhoodLandmarkSpec[] = [
  buildLandmark({
    id: "adire-makers-yard",
    name: "Adire Makers' Yard",
    shortLabel: "Adire Yard",
    zoneTag: "ADIRE_MARKET",
    zoneCategory: "work-hustle",
    badgeLabel: "Craft & Hustle",
    accentColor: "#16225C",
    description:
      "Traditional cassava-resist indigo dye vats under a zinc shed paired with sun-cured drying racks along Left Outer Strip.",
    scenePoint: { x: -115, y: 78 },
    dropOffPoint: { x: 255, y: 112 },
    kekeFare: 150,
    primaryZoneId: "zone-adire-vats",
    zoneIds: ["zone-adire-vats", "zone-adire-racks"],
    activities: [
      {
        id: "dye-adire-cloth",
        label: "Dye Adire Cloth",
        detail: "Steep cotton in deep indigo vats to craft Adire Eleko cloth.",
        kind: "craft",
      },
      {
        id: "adire-artisan-shift",
        label: "Work Adire Artisan Shift",
        detail: "Assist local dyers for ₦3,400 pay and craft XP.",
        kind: "shift",
      },
      {
        id: "fold-adire-scarf",
        label: "Craft Indigo Adire Scarf",
        detail: "Sun-dry and fold indigo scarves on the wooden racks.",
        kind: "craft",
      },
    ],
  }),
  buildLandmark({
    id: "filling-station-mart",
    name: "Filling Station & Mini-Mart",
    shortLabel: "Fuel & Go",
    zoneTag: "FILLING_STATION",
    zoneCategory: "work-hustle",
    badgeLabel: "Fuel & Mart",
    accentColor: "#F2B21C",
    description:
      "Bustling forecourt facing Left Avenue with two pump islands, an air-conditioned walk-in mini-mart, and a vulcanizer tire corner.",
    scenePoint: { x: 720, y: 240 },
    dropOffPoint: { x: 562, y: 242 },
    kekeFare: 120,
    primaryZoneId: "zone-fuel-pumps",
    zoneIds: ["zone-fuel-pumps", "zone-mini-mart", "zone-vulcanizer"],
    activities: [
      {
        id: "work-attendant-shift",
        label: "Work Attendant Shift",
        detail: "Serve motorists along Left Avenue to earn ₦2,600.",
        kind: "shift",
      },
      {
        id: "buy-mart-snacks",
        label: "Enter Mini-Mart Counter",
        detail: "Pick up Meat Pie, Gala & Chilled Water to restore Hunger & Energy.",
        kind: "food",
      },
      {
        id: "vulcanizer-hustle",
        label: "Vulcanizer Tire Hustle",
        detail: "Check tire pressure or pick up a roadside patch kit.",
        kind: "shift",
      },
    ],
  }),
  buildLandmark({
    id: "commercial-bank-atm",
    name: "Commercial Bank & ATM",
    shortLabel: "Meridian Bank",
    zoneTag: "BANK",
    zoneCategory: "banking-transit",
    badgeLabel: "Bank & ATM",
    accentColor: "#16225C",
    description:
      "Two-story Meridian Commercial Bank facing Right Avenue with a 24/7 exterior ATM alcove, walk-in teller hall, and gated courtyard.",
    scenePoint: { x: 1085, y: 78 },
    dropOffPoint: { x: 1202, y: 112 },
    kekeFare: 150,
    primaryZoneId: "zone-bank-atm",
    zoneIds: ["zone-bank-atm", "zone-bank-lobby"],
    activities: [
      {
        id: "use-atm",
        label: "Use ATM",
        detail: "Withdraw or deposit ₦2,000 instantaneously at the exterior alcove.",
        kind: "bank",
      },
      {
        id: "bank-teller-lobby",
        label: "Walk-In Teller Lobby",
        detail: "Step inside for ₦5,000 deposits, account ledger, and savings.",
        kind: "bank",
      },
      {
        id: "chat-bank-security",
        label: "Speak with Bank Security",
        detail: "Check in with Musa at the courtyard gate for safety tips.",
        kind: "bank",
      },
    ],
  }),
  buildLandmark({
    id: "open-market-buka",
    name: "Open Market & Buka",
    shortLabel: "Market & Buka",
    zoneTag: "ADIRE_MARKET",
    zoneCategory: "food-shops",
    badgeLabel: "Buka & Produce",
    accentColor: "#C8452D",
    description:
      "Warm laterite market row on the left strip featuring umbrella produce stalls and Mama Sikira's steaming Amala & Jollof buka.",
    scenePoint: { x: 75, y: 318 },
    dropOffPoint: { x: 118, y: 272 },
    kekeFare: 140,
    primaryZoneId: "zone-buka-stall",
    zoneIds: ["zone-buka-stall", "zone-market-stalls"],
    activities: [
      {
        id: "buy-buka-meal",
        label: "Buy Buka Meal",
        detail: "Order hot Amala & Ewedu or Smoky Jollof & Cold Zobo (+45 Hunger).",
        kind: "food",
      },
      {
        id: "buy-market-staples",
        label: "Buy Plantain & Garri Staples",
        detail: "Stock up on fresh produce baskets from open market tables.",
        kind: "shop",
      },
      {
        id: "browse-oja-catalog",
        label: "Browse Market Catalog",
        detail: "Access Osogbo produce items directly from the stalls.",
        kind: "shop",
      },
    ],
  }),
  buildLandmark({
    id: "roadside-shops-pos",
    name: "Roadside Lock-Up Shops & POS",
    shortLabel: "Shops & POS",
    zoneTag: "COMMERCIAL_SHOPS",
    zoneCategory: "food-shops",
    badgeLabel: "Shops & POS",
    accentColor: "#1E9A5F",
    description:
      "Walk-in single-story commercial row along Right Outer Strip: Dele Cutz Barber, FastCash POS kiosk, and Iya Adire Accessories.",
    scenePoint: { x: 1505, y: 192 },
    dropOffPoint: { x: 1405, y: 185 },
    kekeFare: 180,
    primaryZoneId: "zone-shop-pos",
    zoneIds: ["zone-shop-barber", "zone-shop-pos", "zone-shop-accessory"],
    activities: [
      {
        id: "pos-cashout",
        label: "FastCash POS & Airtime",
        detail: "Quick roadside cash-out or ₦500 airtime & data recharge.",
        kind: "bank",
      },
      {
        id: "barber-fade",
        label: "Dele Cutz Barber Salon",
        detail: "Walk inside for a skin fade & hot towel (+38 Hygiene).",
        kind: "shop",
      },
      {
        id: "equip-backpack",
        label: "Iya Adire Accessories",
        detail: "Buy & equip the wearable Craft Leather Backpack or Indigo Cap.",
        kind: "shop",
      },
    ],
  }),
  buildLandmark({
    id: "keke-korope-stand",
    name: "Keke / Korope Transit Stand",
    shortLabel: "Transit Stand",
    zoneTag: "COMMERCIAL_SHOPS",
    zoneCategory: "banking-transit",
    badgeLabel: "Transit Hub",
    accentColor: "#F2B21C",
    description:
      "Asphalt loading shoulder beside Right Avenue where yellow Korope minibuses and Keke Napeps connect Olaiya to Osogbo districts.",
    scenePoint: { x: 1362, y: 292 },
    dropOffPoint: { x: 1322, y: 295 },
    kekeFare: 100,
    primaryZoneId: "zone-transit-stand",
    zoneIds: ["zone-transit-stand"],
    activities: [
      {
        id: "korope-shuttle-hustle",
        label: "Run Korope Shuttle Hustle",
        detail: "Assist conductor on the Olaiya–Oja Oba loop (+₦2,800).",
        kind: "shift",
      },
      {
        id: "board-keke-ride",
        label: "Quick Keke Commute",
        detail: "Refresh mood with a quick ride along Olaiya Junction.",
        kind: "transit",
      },
      {
        id: "district-routes",
        label: "Osogbo District Connections",
        detail: "Transfer straight to Oja-Oba, Ataoja Palace, or Oke-Fia.",
        kind: "transit",
      },
    ],
  }),
];

export const SURROUNDING_CITY_DISTRICTS: readonly SurroundingDistrictNode[] = [
  {
    id: "oja-oba",
    landmarkId: "oja-oba-market",
    name: "Oja-Oba Market",
    directionLabel: "West · 4 min Keke",
    compassPosition: "west",
    summary: "Osogbo's central trading square & wholesale produce stalls.",
  },
  {
    id: "government-area",
    landmarkId: "civic-court",
    name: "Civic Services",
    directionLabel: "North · 5 min ride",
    compassPosition: "north",
    summary: "Civic court, community safety desk & public administration.",
  },
  {
    id: "old-garage",
    landmarkId: "old-garage-motor-park",
    name: "Old Garage Park",
    directionLabel: "East · 6 min Korope",
    compassPosition: "east",
    summary: "Regional motor park & commercial transport corridor.",
  },
  {
    id: "state-hospital",
    landmarkId: "state-hospital-gate",
    name: "State Hospital",
    directionLabel: "South · 7 min ride",
    compassPosition: "south",
    summary: "Osun healthcare clinics, recovery & pharmacy corridor.",
  },
];

export function findNeighborhoodLandmark(
  id: string | null | undefined,
): NeighborhoodLandmarkSpec | null {
  if (!id) return null;
  return NEIGHBORHOOD_LANDMARKS.find((item) => item.id === id) ?? null;
}

export function filterNeighborhoodLandmarks(
  category: NeighborhoodFilterCategory,
): readonly NeighborhoodLandmarkSpec[] {
  if (category === "all") return NEIGHBORHOOD_LANDMARKS;
  return NEIGHBORHOOD_LANDMARKS.filter((landmark) => landmark.zoneCategory === category);
}

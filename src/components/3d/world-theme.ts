/** Presentation units only. Never use these to change simulation coordinates. */
const CHARACTER_HEIGHT = 1.7;
/**
 * The playable street is drawn larger than the character so buildings, roads and lamps read at a
 * believable size next to people. Collision and positions stay in simulation coordinates.
 */
export const NEIGHBORHOOD_STREET_SCALE = 1.5;

export const WORLD_SCALE = {
  character: CHARACTER_HEIGHT,
  door: CHARACTER_HEIGHT * (2.1 / 1.7),
  road: CHARACTER_HEIGHT * (3.6 / 1.7),
  townCell: CHARACTER_HEIGHT * (3.6 / 1.7),
  neighborhoodUnit: (CHARACTER_HEIGHT / 68) * NEIGHBORHOOD_STREET_SCALE,
  neighborhoodStreetCell: CHARACTER_HEIGHT * (3.6 / 1.7) * NEIGHBORHOOD_STREET_SCALE,
  neighborhoodBuildingHeight: CHARACTER_HEIGHT * (2.1 / 1.7) * 1.4 * NEIGHBORHOOD_STREET_SCALE,
  furniture: CHARACTER_HEIGHT / 1.7,
} as const;

/**
 * Shared visual palette for the city overview and playable neighborhood.
 * Keep these values presentation-only. Do not use them for game logic.
 */
export const WORLD_PALETTE = {
  // Outdoor environment
  ground: "#d9c9ad",
  wall: "#d4bea0",
  clay: "#b77f68",
  foliage: "#89977c",
  timber: "#82705d",
  road: "#777872",
  slate: "#71848b",
  linen: "#f1e9d9",

  // Building and architectural details
  concrete: "#b9b3a7",
  roof: "#74685e",
  roofLight: "#918174",
  accent: "#c47c45",
  sign: "#e7c77f",
  metal: "#626b6b",
  glass: "#9bc8d8",
  windowFrame: "#e7dfce",
  door: "#70401f",

  // Street details
  roadMarking: "#eee6d5",
  sidewalk: "#c5b9a5",
  path: "#b8a58a",
  drainage: "#555b59",

  // Interior tones retained for existing interior scenes
  partition: "#087f74",
  trim: "#e5e3d8",
  tileLight: "#d8d6cd",
  tileShade: "#c8c6bd",
  tileBath: "#adb8b9",
  tileBathShade: "#9eabad",
  tileDark: "#292b30",
  tileDarkShade: "#202226",
} as const;

export type WorldTone = keyof typeof WORLD_PALETTE;

export const WORLD_MATERIAL = {
  roughness: 1,
  metalness: 0,
  flatShading: true,
} as const;

export const WORLD_CAMERA = {
  fov: 42,
  azimuth: Math.PI / 4,
  polar: Math.PI / 3.4,
  defaultZoom: 1,
  minZoom: 0.8,
  maxZoom: 1.35,
} as const;

/** Shared foliage variation used by procedural town and neighborhood trees. */
const FOLIAGE_VARIANTS = ["#607d4b", "#718b52", "#82965c", "#536f49", "#91a267"] as const;
export function worldFoliageColor(seed: number): string {
  const index = Math.abs(Math.trunc(seed)) % FOLIAGE_VARIANTS.length;
  return FOLIAGE_VARIANTS[index] ?? FOLIAGE_VARIANTS[0];
}

/** Subtle, deterministic surface palettes for repeated procedural buildings. */
const BUILDING_SURFACES = [
  { wall: "#d4bea0", roof: "#74685e", trim: "#b9b3a7" },
  { wall: "#d9c7aa", roof: "#806f62", trim: "#c2b8a8" },
  { wall: "#cdb99b", roof: "#6d665e", trim: "#b4ad9f" },
  { wall: "#dfcdb2", roof: "#796b60", trim: "#c8bdac" },
  { wall: "#d0c2aa", roof: "#71675d", trim: "#bdb5a7" },
] as const;
export function worldBuildingSurfaces(seed: number) {
  const index = Math.abs(Math.trunc(seed)) % BUILDING_SURFACES.length;
  return BUILDING_SURFACES[index] ?? BUILDING_SURFACES[0];
}

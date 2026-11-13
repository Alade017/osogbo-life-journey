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
  sky: "#cfe3ea",
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

/** Warm cutaway colours for a house room seen on its own. Presentation only. */
// Taken from the housing blueprints: cream walls and tiles, warm lamp light.
export const ROOM_VIEW_PALETTE = {
  wall: "#e8dcc4",
  floorLight: "#f1e8d6",
  floorShade: "#dccbaf",
  light: "#ffd9a0",
} as const;

/** Camera distance for a room view, relative to the framed room. */
export const ROOM_VIEW_CAMERA = { distanceScale: 0.9 } as const;

export const WORLD_CAMERA = {
  fov: 42,
  azimuth: Math.PI / 4,
  polar: Math.PI / 3.4,
  defaultZoom: 1,
  minZoom: 0.8,
  maxZoom: 1.35,
} as const;

/** Playable-neighbourhood zoom limits, isolated from shared interior camera framing. */
// Camera distance is the base distance divided by zoom, so a higher zoom sits closer to the street.
export const NEIGHBORHOOD_CAMERA = {
  defaultZoom: 1.8,
  minZoom: 1.1,
  maxZoom: 2.8,
} as const;

/** Overview-map camera tuning, kept separate from shared world and interior camera limits. */
export const TOWN_MAP_CAMERA = {
  defaultZoom: 1.55,
  minZoom: 0.42,
  maxZoom: 3.4,
} as const;

/** Presentation units only. Never use these to change simulation coordinates. */
const CHARACTER_HEIGHT = 1.7;
export const WORLD_SCALE = {
  character: CHARACTER_HEIGHT,
  door: CHARACTER_HEIGHT * (2.1 / 1.7),
  road: CHARACTER_HEIGHT * (3.6 / 1.7),
  townCell: CHARACTER_HEIGHT * (3.6 / 1.7),
  neighborhoodUnit: CHARACTER_HEIGHT / 68,
  furniture: CHARACTER_HEIGHT / 1.7,
} as const;

export const WORLD_PALETTE = {
  // Eight shared outdoor tones.
  ground: "#e5d6bc",
  wall: "#d4bea0",
  clay: "#b77f68",
  foliage: "#89977c",
  timber: "#82705d",
  road: "#99978e",
  slate: "#71848b",
  linen: "#f1e9d9",
  // Additional interior tones retained at the owner's explicit request.
  partition: "#087f74",
  trim: "#e5e3d8",
  window: "#9bc8d8",
  door: "#70401f",
  tileLight: "#d8d6cd",
  tileShade: "#c8c6bd",
  tileBath: "#adb8b9",
  tileBathShade: "#9eabad",
  tileDark: "#292b30",
  tileDarkShade: "#202226",
} as const;
export type WorldTone = keyof typeof WORLD_PALETTE;
export const WORLD_MATERIAL = { roughness: 1, metalness: 0, flatShading: true } as const;
export const WORLD_CAMERA = {
  fov: 42,
  azimuth: Math.PI / 4,
  polar: Math.PI / 3.4,
  defaultZoom: 1,
  minZoom: 0.8,
  maxZoom: 1.35,
} as const;

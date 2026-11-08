export type NeighborhoodBuildingKind = "compound" | "shop" | "kiosk" | "market" | "work";
export type NeighborhoodPropKind = "tree" | "streetlight" | "bench" | "bin" | "sign";

type BuildingProfile = {
  wallColors: readonly [number, number];
  roofColor: number;
  trimColor: number;
  doorColor: number;
  windowColor: number;
  awningColor?: number;
  wallHeightRatio: number;
  roofOverhangRatio: number;
  roofRibSpacingRatio: number;
  windowCount: number;
  windowGrilles: boolean;
  frontage: "veranda" | "awning" | "recessed";
};

type PropProfile = {
  shape: "canopy" | "lamp" | "bench" | "bin" | "sign";
  colors: readonly number[];
  widthRatio: number;
  heightRatio: number;
};

export const NEIGHBORHOOD_BUILDING_PROFILES: Readonly<
  Record<NeighborhoodBuildingKind, BuildingProfile>
> = {
  compound: {
    wallColors: [0xd8cbb4, 0xc8b99e],
    roofColor: 0xa6533d,
    trimColor: 0xeee0c6,
    doorColor: 0x68442f,
    windowColor: 0x536b68,
    wallHeightRatio: 0.52,
    roofOverhangRatio: 0.08,
    roofRibSpacingRatio: 0.11,
    windowCount: 2,
    windowGrilles: true,
    frontage: "veranda",
  },
  shop: {
    wallColors: [0xd1c3a9, 0xaebeaf],
    roofColor: 0x536f62,
    trimColor: 0xe8ddc8,
    doorColor: 0x694a34,
    windowColor: 0x425c5b,
    awningColor: 0xd4a45f,
    wallHeightRatio: 0.58,
    roofOverhangRatio: 0.07,
    roofRibSpacingRatio: 0.09,
    windowCount: 2,
    windowGrilles: true,
    frontage: "awning",
  },
  market: {
    wallColors: [0xd9bd8f, 0xc7a777],
    roofColor: 0x9b593e,
    trimColor: 0xf0dfbd,
    doorColor: 0x69452f,
    windowColor: 0x405b56,
    awningColor: 0xc98245,
    wallHeightRatio: 0.54,
    roofOverhangRatio: 0.12,
    roofRibSpacingRatio: 0.075,
    windowCount: 3,
    windowGrilles: true,
    frontage: "awning",
  },
  work: {
    wallColors: [0xc4c9c2, 0xaeb8ae],
    roofColor: 0x596a63,
    trimColor: 0xe2e5d9,
    doorColor: 0x4d5c55,
    windowColor: 0x526c70,
    wallHeightRatio: 0.62,
    roofOverhangRatio: 0.055,
    roofRibSpacingRatio: 0.12,
    windowCount: 2,
    windowGrilles: false,
    frontage: "recessed",
  },
  kiosk: {
    wallColors: [0xd7c7a8, 0xb9aa8c],
    roofColor: 0x528266,
    trimColor: 0xe6d8be,
    doorColor: 0x68452f,
    windowColor: 0x405b56,
    awningColor: 0xd4a35b,
    wallHeightRatio: 0.44,
    roofOverhangRatio: 0.1,
    roofRibSpacingRatio: 0.08,
    windowCount: 1,
    windowGrilles: false,
    frontage: "awning",
  },
};

export const NEIGHBORHOOD_PROP_PROFILES: Readonly<
  Record<NeighborhoodPropKind, PropProfile>
> = {
  tree: {
    shape: "canopy",
    colors: [0x795a3d, 0x4f7048, 0x66834e, 0x81985a],
    widthRatio: 0.92,
    heightRatio: 0.9,
  },
  streetlight: {
    shape: "lamp",
    colors: [0x48534d, 0x3f4b44, 0xf5d98c],
    widthRatio: 0.42,
    heightRatio: 0.96,
  },
  bench: {
    shape: "bench",
    colors: [0x8b6846, 0xa27a50, 0x48534a],
    widthRatio: 0.92,
    heightRatio: 0.62,
  },
  bin: {
    shape: "bin",
    colors: [0x3e6b58, 0x35483e, 0xa8c19a],
    widthRatio: 0.62,
    heightRatio: 0.82,
  },
  sign: {
    shape: "sign",
    colors: [0x70563d, 0xd6b46d, 0x3e5e4b, 0xf2e4c8],
    widthRatio: 0.82,
    heightRatio: 0.9,
  },
};

export function neighborhoodPropKind(kind: string): NeighborhoodPropKind | null {
  if (kind === "landmark" || kind === "sign") return "sign";
  return kind in NEIGHBORHOOD_PROP_PROFILES
    ? (kind as NeighborhoodPropKind)
    : null;
}


/** Resolve world-object semantics to reusable architectural families. */
export function neighborhoodBuildingKind(kind: string): NeighborhoodBuildingKind | null {
  if (kind === "home") return "compound";
  if (kind === "market") return "market";
  if (kind === "work") return "work";
  return null;
}

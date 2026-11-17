/** Architectural boundaries in room metres. Rendering and movement consume these together. */
export type FloorBounds = { minX: number; maxX: number; minZ: number; maxZ: number };

export const STUDIO_FINISH = {
  plaster: "#dbc9ac",
  trim: "#665545",
  tile: "#e4d7c0",
  tileAlternate: "#dfd0b8",
  grout: "#c3b39b",
  wetTile: "#a8ada3",
  wood: "#a4784d",
  woodAlternate: "#b18658",
  sage: "#677357",
  curtain: "#c5aa76",
  glass: "#afc7bf",
  brass: "#b79654",
  rug: "#a98a58",
  rugBorder: "#5b6e58",
} as const;

export function studioBlueprint(width: number, depth: number) {
  const whole: FloorBounds = {
    minX: -width / 2,
    maxX: width / 2,
    minZ: -depth / 2,
    maxZ: depth / 2,
  };
  // Retain the existing wet quadrant so a redesign never relocates saved bathroom fittings.
  const bathroom: FloorBounds = { minX: 0, maxX: width / 2, minZ: 0, maxZ: depth / 2 };
  const doorwayWidth = 1.1;
  return {
    whole,
    bathroom,
    sleep: { minX: -width / 2, maxX: 0, minZ: 0, maxZ: depth / 2 } satisfies FloorBounds,
    entranceX: -width * 0.25,
    bathroomDoor: { x: bathroom.minX, z: depth * 0.25, width: doorwayWidth },
    windows: [-depth * 0.25, depth * 0.25],
  };
}

export function boundsContain(bounds: FloorBounds, x: number, z: number, margin = 0) {
  return (
    x >= bounds.minX - margin &&
    x <= bounds.maxX + margin &&
    z >= bounds.minZ - margin &&
    z <= bounds.maxZ + margin
  );
}

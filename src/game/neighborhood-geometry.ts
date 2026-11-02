/** Pure presentation/footprint contract shared by Phaser and movement validation. */
export const NEIGHBORHOOD_TILE_SIZE = 80;
export const NEIGHBORHOOD_PROJECTION = { x: 0.45, y: 0.22, originX: 1180, originY: 920 } as const;
export type GroundRect = { left: number; top: number; width: number; height: number };

export function projectNeighborhood(x: number, y: number) {
  const p = NEIGHBORHOOD_PROJECTION;
  return { x: p.originX + (x - y) * p.x, y: p.originY + (x + y) * p.y };
}

export function unprojectNeighborhood(x: number, y: number) {
  const p = NEIGHBORHOOD_PROJECTION;
  const difference = (x - p.originX) / p.x;
  const sum = (y - p.originY) / p.y;
  return { x: (sum + difference) / 2, y: (sum - difference) / 2 };
}

export function neighborhoodDepth(x: number, y: number, bias = 0) {
  return (x + y) * 0.25 + bias;
}

/** Preserve the existing authoritative building extents and entrance opening. */
export function neighborhoodBuildingFootprint(object: { x: number; y: number }): GroundRect {
  return { left: object.x - 57, top: object.y - 62, width: 114, height: 58 };
}

export function neighborhoodObstacleFootprint(object: {
  x: number;
  y: number;
  width: number;
  height: number;
}): GroundRect {
  return {
    left: object.x - object.width / 2,
    top: object.y - object.height / 2,
    width: object.width,
    height: object.height,
  };
}

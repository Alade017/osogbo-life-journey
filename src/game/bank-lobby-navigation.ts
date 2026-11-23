import { findGridWalkPath, type WalkPoint } from "./grid-walk-path";

export const BANK_LOBBY = {
  halfWidth: 5.7,
  halfDepth: 3.45,
  bodyRadius: 0.2,
  bodyHeight: 1.55,
  cell: 0.125,
} as const;
export type BankObstaclePolygon = readonly WalkPoint[];

function segmentDistanceSquared(p: WalkPoint, a: WalkPoint, b: WalkPoint) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const length = dx * dx + dz * dz;
  const t = length
    ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / length))
    : 0;
  return (p[0] - a[0] - t * dx) ** 2 + (p[1] - a[1] - t * dz) ** 2;
}
function touchesPolygon(point: WalkPoint, polygon: BankObstaclePolygon, radius: number) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!,
      b = polygon[i]!;
    if (segmentDistanceSquared(point, a, b) <= radius * radius) return true;
    if (
      a[1] > point[1] !== b[1] > point[1] &&
      point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}

/** Rasterize once per loaded model, then use the existing sampled grid pathfinder. */
export function createBankNavigation(polygons: readonly BankObstaclePolygon[]) {
  const { halfWidth, halfDepth, cell, bodyRadius } = BANK_LOBBY;
  const width = Math.ceil((halfWidth * 2) / cell),
    depth = Math.ceil((halfDepth * 2) / cell);
  const blocked = new Uint8Array(width * depth);
  // Include the entire cell, so an arbitrary point within it still has body clearance.
  const padding = bodyRadius + cell / Math.SQRT2;
  for (const polygon of polygons) {
    if (polygon.length < 2 || polygon.some((p) => !p.every(Number.isFinite))) continue;
    const xs = polygon.map((p) => p[0]),
      zs = polygon.map((p) => p[1]);
    const left = Math.max(0, Math.floor((Math.min(...xs) - padding + halfWidth) / cell));
    const right = Math.min(width - 1, Math.floor((Math.max(...xs) + padding + halfWidth) / cell));
    const back = Math.max(0, Math.floor((Math.min(...zs) - padding + halfDepth) / cell));
    const front = Math.min(depth - 1, Math.floor((Math.max(...zs) + padding + halfDepth) / cell));
    for (let z = back; z <= front; z++)
      for (let x = left; x <= right; x++) {
        const index = z * width + x;
        if (
          !blocked[index] &&
          touchesPolygon(
            [-halfWidth + (x + 0.5) * cell, -halfDepth + (z + 0.5) * cell],
            polygon,
            padding,
          )
        )
          blocked[index] = 1;
      }
  }
  const canWalk = (point: WalkPoint) => {
    const [x, z] = point;
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(z) ||
      Math.abs(x) > halfWidth - bodyRadius ||
      Math.abs(z) > halfDepth - bodyRadius
    )
      return false;
    const col = Math.floor((x + halfWidth) / cell),
      row = Math.floor((z + halfDepth) / cell);
    return blocked[row * width + col] === 0;
  };
  const nearest = (point: WalkPoint, occupied: readonly WalkPoint[] = []): WalkPoint | null => {
    let best: WalkPoint | null = null,
      distance = Infinity;
    for (let z = -Math.floor(halfDepth * 2) / 2; z <= halfDepth; z += 0.5)
      for (let x = -Math.floor(halfWidth * 2) / 2; x <= halfWidth; x += 0.5) {
        if (
          !canWalk([x, z]) ||
          occupied.some(([ox, oz]) => Math.hypot(x - ox, z - oz) < bodyRadius * 2 + 0.15)
        )
          continue;
        const d = (x - point[0]) ** 2 + (z - point[1]) ** 2;
        if (d < distance) {
          distance = d;
          best = [x, z];
        }
      }
    return best;
  };
  return {
    canWalk,
    nearest,
    route: (from: WalkPoint, to: WalkPoint) =>
      canWalk(from) && canWalk(to) ? findGridWalkPath(from, to, canWalk) : null,
  };
}
export type BankNavigation = ReturnType<typeof createBankNavigation>;

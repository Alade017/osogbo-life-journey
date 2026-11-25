import type { TownMobilityPoint } from "./town-mobility.ts";

/** Conservative circular footprints enclose the existing vehicle models, including hover scaling. */
export const TRAFFIC_FOOTPRINTS = {
  danfo: Math.hypot(0.72 / 2, 1.45 / 2) * 1.15,
  keke: Math.hypot(0.58 / 2, 0.94 / 2) * 1.15,
  okada: Math.hypot(0.14 / 2, 0.7 / 2) * 1.2,
  taxi: Math.hypot(0.69 / 2, 1.2 / 2) * 1.15,
} as const;

export type TrafficOccupant = { position: TownMobilityPoint; radius: number };
const FOLLOWING_MARGIN = 0.15;

/** Distance to first contact along a straight segment. A pre-existing overlap
 * may separate, but must not deepen. No movement beyond the segment is authorized. */
export function trafficClearDistance(from: TownMobilityPoint, to: TownMobilityPoint,
  radius: number, occupied: Iterable<TrafficOccupant>): number {
  const dx = to[0] - from[0], dz = to[1] - from[1];
  const length = Math.hypot(dx, dz);
  if (!Number.isFinite(length) || length === 0) return 0;
  const ux = dx / length, uz = dz / length;
  let limit = length;
  for (const other of occupied) {
    const x = other.position[0] - from[0], z = other.position[1] - from[1];
    const projection = x * ux + z * uz;
    if (projection <= 0) continue;
    const gap = radius + other.radius + FOLLOWING_MARGIN;
    const initial = Math.hypot(x, z);
    if (initial < gap) { limit = 0; continue; }
    const lateralSquared = Math.max(0, initial ** 2 - projection ** 2);
    if (lateralSquared >= gap ** 2) continue;
    limit = Math.min(limit, Math.max(0, projection - Math.sqrt(gap ** 2 - lateralSquared)));
  }
  return limit;
}

/** Scene-local occupancy registry; each accepted movement updates the shared snapshot. */
export class TownTrafficOccupancy {
  private readonly actors = new Map<string, TrafficOccupant>();
  set(id: string, occupant: TrafficOccupant): void { this.actors.set(id, occupant); }
  remove(id: string): void { this.actors.delete(id); }
  clearance(id: string, from: TownMobilityPoint, to: TownMobilityPoint, radius: number): number {
    return trafficClearDistance(from, to, radius,
      [...this.actors].filter(([other]) => other !== id).map(([, actor]) => actor));
  }
}

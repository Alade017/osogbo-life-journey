export type WorldPoint = { x: number; y: number };
export type NeighborhoodObject = {
  id: string;
  name: string;
  kind: "home" | "market" | "work" | "npc";
  x: number;
  y: number;
};
export const WORLD_SCALE = 160;
export const NEIGHBORHOOD_SIZE = { width: 640, height: 560 };
export const NEIGHBORHOOD_OBJECTS: readonly NeighborhoodObject[] = [
  { id: "home", name: "Your home", kind: "home", x: 170, y: 210 },
  { id: "market", name: "Neighbourhood market", kind: "market", x: 470, y: 210 },
  { id: "work", name: "Work & opportunities", kind: "work", x: 470, y: 420 },
  { id: "npc", name: "Bisi · neighbour", kind: "npc", x: 200, y: 420 },
];
export function neighborhoodOrigin(entrance: WorldPoint, checkpoint: WorldPoint): WorldPoint {
  // Preserve old checkpoints outside the entrance block rather than snapping them.
  const anchor =
    Math.abs(checkpoint.x - entrance.x) <= 1.7 && Math.abs(checkpoint.y - entrance.y) <= 1.6
      ? entrance
      : { x: Math.floor(checkpoint.x / 3) * 3 + 1.5, y: Math.floor(checkpoint.y / 3) * 3 + 1.5 };
  return { x: Math.max(1.8, Math.min(12.2, anchor.x)), y: Math.max(1.9, Math.min(10.3, anchor.y)) };
}
export function toScene(point: WorldPoint, origin: WorldPoint): WorldPoint {
  return {
    x: 320 + (point.x - origin.x) * WORLD_SCALE,
    y: 300 + (point.y - origin.y) * WORLD_SCALE,
  };
}
export function toWorld(point: WorldPoint, origin: WorldPoint): WorldPoint {
  return {
    x: Math.round((origin.x + (point.x - 320) / WORLD_SCALE) * 10000) / 10000,
    y: Math.round((origin.y + (point.y - 300) / WORLD_SCALE) * 10000) / 10000,
  };
}
export function nearestInteraction(point: WorldPoint): NeighborhoodObject | null {
  let nearest: NeighborhoodObject | null = null;
  let distance = 65;
  for (const object of NEIGHBORHOOD_OBJECTS) {
    const next = Math.hypot(point.x - object.x, point.y - object.y);
    if (next < distance) {
      nearest = object;
      distance = next;
    }
  }
  return nearest;
}
export function validCheckpoint(point: WorldPoint): boolean {
  return (
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 14 &&
    point.y >= 0 &&
    point.y <= 12
  );
}

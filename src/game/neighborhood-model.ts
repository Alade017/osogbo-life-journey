export type WorldPoint = { x: number; y: number };
export type NeighborhoodObject = {
  id: string;
  name: string;
  kind: "home" | "market" | "work" | "npc";
  x: number;
  y: number;
};
export type NeighborhoodArea = {
  slug: string;
  name: string;
  objects: readonly NeighborhoodObject[];
  style: {
    ground: number;
    grid: number;
    road: number;
    paving: number;
    marking: number;
    verticalRoad: { x: number; width: number };
    horizontalRoad: { y: number; height: number };
  };
  marketStalls?: readonly WorldPoint[];
};
export const WORLD_SCALE = 160;
export const NEIGHBORHOOD_SIZE = { width: 640, height: 560 };
export const CITY_CENTRE_AREA: NeighborhoodArea = {
  slug: "city-centre",
  name: "Olaiya",
  objects: [
    { id: "home", name: "Your home", kind: "home", x: 170, y: 210 },
    { id: "market", name: "Neighbourhood market", kind: "market", x: 470, y: 210 },
    { id: "work", name: "Work & opportunities", kind: "work", x: 470, y: 420 },
    { id: "npc", name: "Bisi · neighbour", kind: "npc", x: 200, y: 420 },
  ],
  style: {
    ground: 0xe8eedf,
    grid: 0xd3dfcb,
    road: 0xbac6b4,
    paving: 0xe8ddbd,
    marking: 0xfffaf0,
    verticalRoad: { x: 278, width: 84 },
    horizontalRoad: { y: 260, height: 80 },
  },
};

/** A second, data-backed street layout for the seeded Oja-Oba Market destination. */
export const OJA_OBA_AREA: NeighborhoodArea = {
  slug: "oja-oba",
  name: "Oja-Oba Market",
  objects: [
    { id: "home", name: "Market-side courtyard", kind: "home", x: 515, y: 165 },
    { id: "market", name: "Oja-Oba stalls", kind: "market", x: 145, y: 165 },
    { id: "work", name: "Market loading yard", kind: "work", x: 500, y: 420 },
    { id: "npc", name: "Ayo · market trader", kind: "npc", x: 155, y: 420 },
  ],
  style: {
    ground: 0xeee5d2,
    grid: 0xded2ba,
    road: 0xb8b5a5,
    paving: 0xe1cfaa,
    marking: 0xfff8e7,
    verticalRoad: { x: 270, width: 92 },
    horizontalRoad: { y: 236, height: 92 },
  },
  marketStalls: [
    { x: 218, y: 178 },
    { x: 254, y: 178 },
    { x: 290, y: 178 },
  ],
};

export const NEIGHBORHOOD_AREAS: Readonly<Record<string, NeighborhoodArea>> = {
  [CITY_CENTRE_AREA.slug]: CITY_CENTRE_AREA,
  [OJA_OBA_AREA.slug]: OJA_OBA_AREA,
};
export const NEIGHBORHOOD_OBJECTS = CITY_CENTRE_AREA.objects;

export function neighborhoodAreaForSlug(slug: string | null | undefined): NeighborhoodArea {
  return (slug && NEIGHBORHOOD_AREAS[slug]) || CITY_CENTRE_AREA;
}
export function neighborhoodOrigin(entrance: WorldPoint, checkpoint: WorldPoint): WorldPoint {
  // Preserve old checkpoints outside the entrance block rather than snapping them.
  const anchor =
    Math.abs(checkpoint.x - entrance.x) <= 1.7 && Math.abs(checkpoint.y - entrance.y) <= 1.6
      ? entrance
      : { x: Math.floor(checkpoint.x / 3) * 3 + 1.5, y: Math.floor(checkpoint.y / 3) * 3 + 1.5 };
  return { x: Math.max(1.8, Math.min(12.2, anchor.x)), y: Math.max(1.9, Math.min(10.3, anchor.y)) };
}
/** Stable origin shared by every player in an area; per-checkpoint origins desync peers. */
export function neighborhoodAreaOrigin(entrance: WorldPoint): WorldPoint {
  return neighborhoodOrigin(entrance, entrance);
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
export function nearestInteraction(
  point: WorldPoint,
  objects: readonly NeighborhoodObject[] = NEIGHBORHOOD_OBJECTS,
): NeighborhoodObject | null {
  let nearest: NeighborhoodObject | null = null;
  let distance = 65;
  for (const object of objects) {
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

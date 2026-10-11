import { OSOGBO_WORLD_NODES, type WorldMapCategory } from "../lib/city-world.ts";

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

const AREA_STYLE_BY_CATEGORY: Record<WorldMapCategory, NeighborhoodArea["style"]> = {
  residential: {
    ground: 0xe8eedf,
    grid: 0xd3dfcb,
    road: 0xbac6b4,
    paving: 0xe8ddbd,
    marking: 0xfffaf0,
    verticalRoad: { x: 278, width: 84 },
    horizontalRoad: { y: 260, height: 80 },
  },
  commercial: {
    ground: 0xeee5d2,
    grid: 0xded2ba,
    road: 0xb8b5a5,
    paving: 0xe1cfaa,
    marking: 0xfff8e7,
    verticalRoad: { x: 270, width: 92 },
    horizontalRoad: { y: 236, height: 92 },
  },
  work_industrial: {
    ground: 0xe1e3df,
    grid: 0xcdd1cc,
    road: 0xaeb3b0,
    paving: 0xd4d0c4,
    marking: 0xfff7dc,
    verticalRoad: { x: 286, width: 96 },
    horizontalRoad: { y: 250, height: 88 },
  },
  education: {
    ground: 0xe6eddf,
    grid: 0xcbd9c3,
    road: 0xb7c1ae,
    paving: 0xe7ddbb,
    marking: 0xfffae8,
    verticalRoad: { x: 256, width: 88 },
    horizontalRoad: { y: 246, height: 96 },
  },
  health: {
    ground: 0xe5eeeb,
    grid: 0xcbd9d5,
    road: 0xb2c1bc,
    paving: 0xe7e2d0,
    marking: 0xfffdf0,
    verticalRoad: { x: 280, width: 88 },
    horizontalRoad: { y: 254, height: 82 },
  },
  transport: {
    ground: 0xece7d9,
    grid: 0xd8d0bd,
    road: 0xb7b1a1,
    paving: 0xdfd2ad,
    marking: 0xfff3d5,
    verticalRoad: { x: 266, width: 104 },
    horizontalRoad: { y: 240, height: 100 },
  },
  government: {
    ground: 0xe7e9df,
    grid: 0xd1d6c8,
    road: 0xb5b9ae,
    paving: 0xe4dec8,
    marking: 0xfff8e8,
    verticalRoad: { x: 274, width: 92 },
    horizontalRoad: { y: 258, height: 84 },
  },
  recreation: {
    ground: 0xe5eddf,
    grid: 0xcbd9c2,
    road: 0xb8c2ae,
    paving: 0xe7dbb9,
    marking: 0xfff9e5,
    verticalRoad: { x: 250, width: 92 },
    horizontalRoad: { y: 244, height: 88 },
  },
  water_nature: {
    ground: 0xe0ede4,
    grid: 0xc5d9ce,
    road: 0xb0c2b9,
    paving: 0xe1ddc0,
    marking: 0xfffae8,
    verticalRoad: { x: 284, width: 84 },
    horizontalRoad: { y: 248, height: 86 },
  },
};

const LEGACY_AREA_NODES: Readonly<Record<string, { name: string; category: WorldMapCategory }>> = {
  residential: { name: "Residential District", category: "residential" },
  "business-district": { name: "Business District", category: "commercial" },
};

const AREA_ANCHOR_SETS = [
  [
    { x: 150, y: 155 },
    { x: 490, y: 155 },
    { x: 490, y: 435 },
    { x: 150, y: 435 },
  ],
  [
    { x: 490, y: 155 },
    { x: 150, y: 155 },
    { x: 150, y: 435 },
    { x: 490, y: 435 },
  ],
  [
    { x: 150, y: 435 },
    { x: 490, y: 435 },
    { x: 490, y: 155 },
    { x: 150, y: 155 },
  ],
  [
    { x: 490, y: 435 },
    { x: 150, y: 435 },
    { x: 150, y: 155 },
    { x: 490, y: 155 },
  ],
] as const;

function generatedNeighborhoodArea(
  slug: string,
  name: string,
  category: WorldMapCategory,
): NeighborhoodArea {
  const variant = [...slug].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7) % 4;
  const anchors = AREA_ANCHOR_SETS[variant]!;
  const [home, market, work, npc] = anchors;
  return {
    slug,
    name,
    objects: [
      { id: "home", name: `${name} homes`, kind: "home", ...home },
      { id: "market", name: `${name} shops`, kind: "market", ...market },
      { id: "work", name: `${name} opportunities`, kind: "work", ...work },
      { id: "npc", name: `Neighbour in ${name}`, kind: "npc", ...npc },
    ],
    style: AREA_STYLE_BY_CATEGORY[category],
  };
}

const generatedAreas = Object.fromEntries(
  [
    ...Object.values(OSOGBO_WORLD_NODES),
    ...Object.entries(LEGACY_AREA_NODES).map(([slug, node]) => ({ slug, ...node })),
  ].map((node) => [node.slug, generatedNeighborhoodArea(node.slug, node.name, node.category)]),
);

export const NEIGHBORHOOD_AREAS: Readonly<Record<string, NeighborhoodArea>> = {
  ...generatedAreas,
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

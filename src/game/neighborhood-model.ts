import { OSOGBO_WORLD_NODES, type WorldMapCategory } from "../lib/city-world.ts";

export type WorldPoint = { x: number; y: number };
export type NeighborhoodNpcView = {
  id: string;
  name: string;
  role: string;
  activity: string;
  x: number;
  y: number;
};
export type NeighborhoodObject = {
  id: string;
  name: string;
  kind: "home" | "market" | "work" | "npc";
  x: number;
  y: number;
};
export type NeighborhoodObstacle = {
  id: string;
  kind:
    "compound" | "shop" | "kiosk" | "tree" | "streetlight" | "bench" | "bin" | "sign" | "landmark";
  label?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};
export type NeighborhoodRoad = {
  id: string;
  axis: "horizontal" | "vertical";
  offset: number;
  width: number;
  type: "arterial" | "street" | "lane";
  start?: number;
  end?: number;
};
export type NeighborhoodPath = {
  id: string;
  from: WorldPoint;
  to: WorldPoint;
  width: number;
};
export type NeighborhoodArea = {
  slug: string;
  name: string;
  objects: readonly NeighborhoodObject[];
  obstacles?: readonly NeighborhoodObstacle[];
  roads?: readonly NeighborhoodRoad[];
  paths?: readonly NeighborhoodPath[];
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
export const NEIGHBORHOOD_SCENE_BOUNDS = {
  left: -800,
  top: -660,
  width: 2240,
  height: 1920,
} as const;
const CITY_CENTRE_ROADS: readonly NeighborhoodRoad[] = [
  { id: "olaiya-arterial-north-south", axis: "vertical", offset: 500, width: 84, type: "arterial" },
  { id: "olaiya-arterial-east-west", axis: "horizontal", offset: 500, width: 80, type: "arterial" },
  {
    id: "home-access-lane",
    axis: "horizontal",
    offset: 340,
    width: 44,
    type: "lane",
    start: 320,
    end: 500,
  },
  { id: "west-residential-street", axis: "vertical", offset: -410, width: 58, type: "street" },
  { id: "east-market-street", axis: "vertical", offset: 850, width: 62, type: "street" },
  { id: "north-compound-lane", axis: "horizontal", offset: -280, width: 54, type: "lane" },
  { id: "south-compound-lane", axis: "horizontal", offset: 730, width: 58, type: "street" },
];
const CITY_CENTRE_OBSTACLES: readonly NeighborhoodObstacle[] = [
  { id: "compound-west-north", kind: "compound", x: -615, y: -470, width: 150, height: 92 },
  { id: "compound-west-centre", kind: "compound", x: -180, y: -470, width: 150, height: 92 },
  { id: "compound-east-north", kind: "compound", x: 510, y: -470, width: 150, height: 92 },
  { id: "compound-far-east-north", kind: "compound", x: 1130, y: -470, width: 150, height: 92 },
  { id: "compound-west-south", kind: "compound", x: -615, y: 800, width: 150, height: 92 },
  { id: "compound-west-far-south", kind: "compound", x: -180, y: 800, width: 150, height: 92 },
  { id: "compound-east-south", kind: "compound", x: 760, y: 800, width: 150, height: 92 },
  { id: "compound-east-far-south", kind: "compound", x: 1190, y: 800, width: 150, height: 92 },
  { id: "corner-kiosk-west", kind: "kiosk", x: -170, y: 190, width: 70, height: 54 },
  { id: "corner-kiosk-east", kind: "kiosk", x: 670, y: 385, width: 70, height: 54 },
  { id: "tree-west-north", kind: "tree", x: -730, y: -170, width: 42, height: 42 },
  { id: "tree-west-south", kind: "tree", x: -690, y: 805, width: 42, height: 42 },
  { id: "tree-east-north", kind: "tree", x: 1240, y: -180, width: 42, height: 42 },
  { id: "tree-east-south", kind: "tree", x: 1260, y: 850, width: 42, height: 42 },
  { id: "tree-market-north", kind: "tree", x: 635, y: -420, width: 42, height: 42 },
  { id: "streetlight-crossing-west", kind: "streetlight", x: 430, y: 430, width: 20, height: 20 },
  { id: "streetlight-crossing-east", kind: "streetlight", x: 570, y: 570, width: 20, height: 20 },
  { id: "streetlight-market-row", kind: "streetlight", x: 895, y: 275, width: 20, height: 20 },
  { id: "streetlight-south-row", kind: "streetlight", x: 90, y: 755, width: 20, height: 20 },
  { id: "bench-market-row", kind: "bench", x: 620, y: 300, width: 56, height: 24 },
  { id: "bench-neighbourhood-square", kind: "bench", x: 30, y: 555, width: 56, height: 24 },
  { id: "bin-market-row", kind: "bin", x: 670, y: 300, width: 22, height: 22 },
  { id: "bin-crossing", kind: "bin", x: 80, y: 345, width: 22, height: 22 },
  { id: "olaiya-wayfinding", kind: "sign", x: 455, y: 430, width: 28, height: 24 },
];
export const CITY_CENTRE_AREA: NeighborhoodArea = {
  slug: "city-centre",
  name: "Olaiya",
  roads: CITY_CENTRE_ROADS,
  paths: [
    { id: "home-to-street-path", from: { x: 320, y: 300 }, to: { x: 320, y: 340 }, width: 12 },
  ],
  obstacles: CITY_CENTRE_OBSTACLES,
  objects: [
    { id: "home", name: "Your home", kind: "home", x: 320, y: 300 },
    { id: "market", name: "Neighbourhood market", kind: "market", x: 700, y: 300 },
    { id: "work", name: "Work & opportunities", kind: "work", x: 750, y: 680 },
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
  roads: [
    { id: "market-spine", axis: "vertical", offset: 270, width: 92, type: "street" },
    { id: "market-crossing", axis: "horizontal", offset: 236, width: 92, type: "arterial" },
    {
      id: "loading-access",
      axis: "horizontal",
      offset: 480,
      width: 42,
      type: "lane",
      start: 270,
      end: 540,
    },
  ],
  paths: [
    { id: "courtyard-approach", from: { x: 515, y: 165 }, to: { x: 515, y: 236 }, width: 14 },
    { id: "stalls-approach", from: { x: 145, y: 165 }, to: { x: 145, y: 236 }, width: 14 },
    { id: "loading-yard-approach", from: { x: 500, y: 420 }, to: { x: 500, y: 480 }, width: 14 },
  ],
  obstacles: [
    { id: "produce-stall-west", kind: "kiosk", x: 65, y: 65, width: 38, height: 28 },
    { id: "produce-stall-centre", kind: "kiosk", x: 115, y: 65, width: 38, height: 28 },
    { id: "produce-stall-east", kind: "kiosk", x: 165, y: 65, width: 38, height: 28 },
    { id: "market-shade-tree", kind: "tree", x: 50, y: 350, width: 36, height: 36 },
    { id: "trader-bench", kind: "bench", x: 90, y: 390, width: 48, height: 20 },
    { id: "market-waste-point", kind: "bin", x: 375, y: 325, width: 22, height: 22 },
    { id: "market-crossing-light", kind: "streetlight", x: 205, y: 300, width: 18, height: 18 },
  ],
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
    { x: 65, y: 65 },
    { x: 115, y: 65 },
    { x: 165, y: 65 },
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
  const seed = [...slug].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  const variant = seed % AREA_ANCHOR_SETS.length;
  const anchors = AREA_ANCHOR_SETS[variant]!;
  const [home, market, work, npc] = anchors;
  const verticalMain = 270 + ((seed >>> 3) % 81);
  const horizontalMain = 250 + ((seed >>> 11) % 101);
  const westStreet = 70 + ((seed >>> 17) % 101);
  const eastStreet = 470 + ((seed >>> 23) % 101);
  const northLane = 70 + ((seed >>> 7) % 71);
  const southStreet = 460 + ((seed >>> 13) % 91);
  const outerShopX = 70 + ((seed >>> 19) % 81);
  const outerShopY = 70 + ((seed >>> 9) % 71);
  const furnitureX = seed % 2 === 0 ? 80 : 520;
  const furnitureY = seed % 3 === 0 ? 100 : 500;
  const pedestrianY = horizontalMain + (seed % 2 === 0 ? 62 : -62);
  const npcNames = [`Neighbour in ${name}`, `Shopper in ${name}`, `Street vendor in ${name}`];
  return {
    slug,
    name,
    roads: [
      {
        id: "district-arterial-north-south",
        axis: "vertical",
        offset: verticalMain,
        width: 76 + (seed % 25),
        type: "arterial",
      },
      {
        id: "district-arterial-east-west",
        axis: "horizontal",
        offset: horizontalMain,
        width: 76 + ((seed >>> 5) % 25),
        type: "arterial",
      },
      {
        id: "district-west-street",
        axis: "vertical",
        offset: westStreet,
        width: 48,
        type: "street",
      },
      {
        id: "district-east-street",
        axis: "vertical",
        offset: eastStreet,
        width: 54,
        type: "street",
      },
      { id: "district-north-lane", axis: "horizontal", offset: northLane, width: 42, type: "lane" },
      {
        id: "district-south-street",
        axis: "horizontal",
        offset: southStreet,
        width: 52,
        type: "street",
      },
    ],
    paths: [
      {
        id: "district-home-access",
        from: { x: home.x, y: home.y + 38 },
        to: { x: home.x, y: southStreet },
        width: 12,
      },
      {
        id: "district-market-approach",
        from: { x: market.x, y: northLane },
        to: { x: market.x, y: market.y - 36 },
        width: 12,
      },
    ],
    objects: [
      { id: "home", name: `${name} homes`, kind: "home", ...home },
      { id: "market", name: `${name} shops`, kind: "market", ...market },
      { id: "work", name: `${name} opportunities`, kind: "work", ...work },
      { id: "npc", name: npcNames[0]!, kind: "npc", ...npc },
      {
        id: "pedestrian-market",
        name: npcNames[1]!,
        kind: "npc",
        x: verticalMain + (seed % 2 === 0 ? 96 : -96),
        y: pedestrianY,
      },
      {
        id: "pedestrian-crossing",
        name: npcNames[2]!,
        kind: "npc",
        x: verticalMain + (seed % 2 === 0 ? -96 : 96),
        y: pedestrianY + 110,
      },
    ],
    obstacles: [
      {
        id: "district-corner-shop",
        kind: seed % 2 === 0 ? "shop" : "kiosk",
        x: outerShopX,
        y: northLane + 160,
        width: seed % 2 === 0 ? 92 : 66,
        height: seed % 2 === 0 ? 58 : 46,
      },
      {
        id: "district-community-compound",
        kind: "compound",
        x: 560,
        y: 510,
        width: 138,
        height: 82,
      },
      {
        id: "district-landmark",
        kind: "landmark",
        label: name.toUpperCase(),
        x: 60,
        y: 500,
        width: 58,
        height: 38,
      },
      {
        id: "district-shade-tree",
        kind: "tree",
        x: 60,
        y: 150,
        width: 38,
        height: 38,
      },
      {
        id: "district-streetlight",
        kind: "streetlight",
        x: furnitureX,
        y: furnitureY,
        width: 20,
        height: 20,
      },
      {
        id: "district-bench",
        kind: "bench",
        x: furnitureX - 56,
        y: furnitureY + 45,
        width: 52,
        height: 22,
      },
      {
        id: "district-bin",
        kind: "bin",
        x: furnitureX + 52,
        y: furnitureY + 42,
        width: 20,
        height: 20,
      },
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
/** Existing authoritative movement window expressed in the area's scene coordinates. */
export function neighborhoodSceneBounds(origin: WorldPoint) {
  const corner = toScene({ x: 0, y: 0 }, origin);
  return { left: corner.x, top: corner.y, width: 14 * WORLD_SCALE, height: 12 * WORLD_SCALE };
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

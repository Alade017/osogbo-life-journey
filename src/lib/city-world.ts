export type CityWorldPosition = { x: number; y: number };
export type WorldMapCategory =
  | "residential"
  | "commercial"
  | "work_industrial"
  | "education"
  | "health"
  | "transport"
  | "government"
  | "recreation"
  | "water_nature";
export type WorldEntryLoop = "shop" | "work" | "study" | "recover" | "travel" | "explore" | "social";
export type WorldBlueprintNode = {
  readonly slug: string;
  readonly name: string;
  readonly category: WorldMapCategory;
  /** Normalized anchor in the 1536x1024 blueprint canvas. */
  readonly anchor: Readonly<{ x: number; y: number }>;
  /** Existing movement-grid coordinate, kept separate from presentation coordinates. */
  readonly world: Readonly<CityWorldPosition>;
  readonly neighbors: readonly string[];
  readonly jobContracts: readonly string[];
  readonly entryLoops: readonly WorldEntryLoop[];
};
export type CityWorldDistrict = {
  id: string;
  name: string;
  tone: string;
  center: CityWorldPosition;
  radius: CityWorldPosition;
  detail: string;
};
export type CityRoadNode = { id: string; position: CityWorldPosition };
export type CityRoadEdge = {
  from: string;
  to: string;
  kind: "arterial" | "street" | "lane";
  cost: number;
};

export const CITY_WORLD_VERSION = 1;
export const CITY_WORLD_BOUNDS = { minX: 0, maxX: 14, minY: 0, maxY: 12 } as const;

/** Immutable blueprint registry. Coordinates are normalized for scalable rendering. */
export const OSOGBO_WORLD_NODES = {
  "city-centre": { slug: "city-centre", name: "Olaiya", category: "commercial", anchor: { x: 0.50, y: 0.47 }, world: { x: 7, y: 6 }, neighbors: ["oja-oba", "government-area", "state-hospital", "isale-osun", "old-garage", "oke-fia"], jobContracts: ["office_assistant", "shop_assistant", "stock_assistant"], entryLoops: ["shop", "social", "explore"] },
  "oja-oba": { slug: "oja-oba", name: "Oja-Oba Market", category: "commercial", anchor: { x: 0.60, y: 0.26 }, world: { x: 3, y: 5 }, neighbors: ["city-centre", "government-area", "student-district", "isale-osun"], jobContracts: ["market_trader", "market_sales_assistant", "food_vendor"], entryLoops: ["shop", "work", "social"] },
  "government-area": { slug: "government-area", name: "Government Area · State Secretariat", category: "government", anchor: { x: 0.38, y: 0.21 }, world: { x: 5.32, y: 2.52 }, neighbors: ["city-centre", "oja-oba", "student-district", "oke-fia"], jobContracts: [], entryLoops: ["work", "social"] },
  "student-district": { slug: "student-district", name: "UNIOSUN Campus", category: "education", anchor: { x: 0.12, y: 0.24 }, world: { x: 5, y: 9 }, neighbors: ["oja-oba", "government-area", "stadium", "oke-fia"], jobContracts: ["junior_frontend_developer", "computer_assistant", "tech_support_assistant", "computer_instructor"], entryLoops: ["study", "work", "social"] },
  "cultural-district": { slug: "cultural-district", name: "Sacred Grove · Osun Sacred Forest", category: "water_nature", anchor: { x: 0.69, y: 0.07 }, world: { x: 2, y: 2 }, neighbors: ["oke-baale", "atiku", "city-centre"], jobContracts: [], entryLoops: ["explore", "social"] },
  stadium: { slug: "stadium", name: "Stadium", category: "recreation", anchor: { x: 0.53, y: 0.73 }, world: { x: 7.42, y: 8.76 }, neighbors: ["student-district", "industrial-area", "airport-terminal", "atiku"], jobContracts: [], entryLoops: ["work", "explore", "social"] },
  "state-hospital": { slug: "state-hospital", name: "State Hospital", category: "health", anchor: { x: 0.32, y: 0.44 }, world: { x: 4.48, y: 5.28 }, neighbors: ["city-centre", "oke-fia", "old-garage"], jobContracts: [], entryLoops: ["recover", "work"] },
  "old-garage": { slug: "old-garage", name: "Transport Hub · Old Garage", category: "transport", anchor: { x: 0.14, y: 0.60 }, world: { x: 3, y: 8 }, neighbors: ["city-centre", "state-hospital", "industrial-area", "isale-osun"], jobContracts: ["driver_rider", "delivery_rider", "mechanic", "mechanic_assistant", "workshop_assistant"], entryLoops: ["travel", "work", "social"] },
  "airport-terminal": { slug: "airport-terminal", name: "Airport · Terminal", category: "transport", anchor: { x: 0.75, y: 0.80 }, world: { x: 10.5, y: 9.6 }, neighbors: ["stadium", "atiku", "rural-outskirts"], jobContracts: [], entryLoops: ["travel", "work"] },
  "oke-baale": { slug: "oke-baale", name: "Oke-Baale · Hill View", category: "recreation", anchor: { x: 0.48, y: 0.06 }, world: { x: 6.72, y: 0.72 }, neighbors: ["cultural-district", "government-area", "atiku"], jobContracts: [], entryLoops: ["explore", "social"] },
  "isale-osun": { slug: "isale-osun", name: "Isale-Osun", category: "commercial", anchor: { x: 0.68, y: 0.56 }, world: { x: 9.52, y: 6.72 }, neighbors: ["city-centre", "oja-oba", "old-garage", "atiku"], jobContracts: [], entryLoops: ["shop", "work", "social"] },
  atiku: { slug: "atiku", name: "Atiku Residential", category: "residential", anchor: { x: 0.93, y: 0.44 }, world: { x: 13.02, y: 5.28 }, neighbors: ["cultural-district", "oke-baale", "isale-osun", "stadium", "airport-terminal"], jobContracts: [], entryLoops: ["social", "explore"] },
  "rural-outskirts": { slug: "rural-outskirts", name: "Outskirts · Farms & Village", category: "water_nature", anchor: { x: 0.92, y: 0.66 }, world: { x: 13, y: 11 }, neighbors: ["airport-terminal", "stadium"], jobContracts: ["farm_assistant"], entryLoops: ["work", "explore", "social"] },
  "oke-fia": { slug: "oke-fia", name: "Oke-Fia", category: "residential", anchor: { x: 0.07, y: 0.44 }, world: { x: 10, y: 3 }, neighbors: ["city-centre", "government-area", "student-district", "state-hospital"], jobContracts: [], entryLoops: ["social", "explore"] },
  "industrial-area": { slug: "industrial-area", name: "Industrial Area", category: "work_industrial", anchor: { x: 0.33, y: 0.75 }, world: { x: 4.62, y: 9 }, neighbors: ["old-garage", "stadium", "rural-outskirts"], jobContracts: [], entryLoops: ["work"] },
} as const satisfies Readonly<Record<string, WorldBlueprintNode>>;

export const CITY_DISTRICTS: CityWorldDistrict[] = [
  {
    id: "central",
    name: "Central Market District",
    tone: "central",
    center: { x: 7, y: 5 },
    radius: { x: 2.5, y: 2 },
    detail: "Roundabouts, bus horns, banks and street-side businesses.",
  },
  {
    id: "market",
    name: "Oja Central Market",
    tone: "market",
    center: { x: 3, y: 4 },
    radius: { x: 2.2, y: 2 },
    detail: "A busy maze of stalls, food sellers and market lanes.",
  },
  {
    id: "commercial",
    name: "Commercial District",
    tone: "commercial",
    center: { x: 10.5, y: 3 },
    radius: { x: 2.5, y: 1.8 },
    detail: "Small offices, repair shops and late-opening restaurants.",
  },
  {
    id: "transport",
    name: "Transport District",
    tone: "transport",
    center: { x: 2, y: 8 },
    radius: { x: 2, y: 1.8 },
    detail: "Danfo ranks, keke stands and the sound of engines warming up.",
  },
  {
    id: "university",
    name: "University District",
    tone: "university",
    center: { x: 5, y: 10 },
    radius: { x: 2.4, y: 1.6 },
    detail: "Campus footpaths, hostels and students heading to class.",
  },
  {
    id: "residential",
    name: "Residential District",
    tone: "residential",
    center: { x: 10.5, y: 9 },
    radius: { x: 2.5, y: 2 },
    detail: "Courtyard homes, corner shops and neighbours out for a chat.",
  },
  {
    id: "business",
    name: "Business District",
    tone: "business",
    center: { x: 9, y: 6 },
    radius: { x: 2, y: 1.6 },
    detail: "Workplaces, civic services and a crowded lunchtime rush.",
  },
  {
    id: "culture",
    name: "Cultural District",
    tone: "culture",
    center: { x: 1, y: 1.5 },
    radius: { x: 2, y: 1.5 },
    detail: "Art spaces, community gatherings and festival grounds.",
  },
  {
    id: "outskirts",
    name: "Rural Outskirts",
    tone: "outskirts",
    center: { x: 13, y: 11 },
    radius: { x: 1.6, y: 1.2 },
    detail: "Quieter roads, open courtyards and small local farms.",
  },
];

export const WORLD_LOCATION_NODES: Record<
  string,
  { districtId: string; position: CityWorldPosition; entrance: CityWorldPosition }
> = {
  "city-centre": { districtId: "central", position: { x: 7, y: 5 }, entrance: { x: 7, y: 6 } },
  "oja-oba": { districtId: "market", position: { x: 3, y: 4 }, entrance: { x: 3, y: 5 } },
  "oke-fia": { districtId: "commercial", position: { x: 11, y: 3 }, entrance: { x: 10, y: 3 } },
  "old-garage": { districtId: "transport", position: { x: 2, y: 8 }, entrance: { x: 3, y: 8 } },
  "student-district": {
    districtId: "university",
    position: { x: 5, y: 10 },
    entrance: { x: 5, y: 9 },
  },
  residential: {
    districtId: "residential",
    position: { x: 10, y: 9 },
    entrance: { x: 9, y: 9 },
  },
  "business-district": {
    districtId: "business",
    position: { x: 9, y: 6 },
    entrance: { x: 8, y: 6 },
  },
  "cultural-district": {
    districtId: "culture",
    position: { x: 1, y: 2 },
    entrance: { x: 2, y: 2 },
  },
  "rural-outskirts": {
    districtId: "outskirts",
    position: { x: 13, y: 11 },
    entrance: { x: 12, y: 11 },
  },
};

const CLOSED_ROAD_EDGES = new Set(["4,4|4,5", "8,7|8,8", "11,5|12,5"]);
const nodeId = (x: number, y: number) => `road-${x}-${y}`;

export const CITY_ROAD_NODES: CityRoadNode[] = Array.from(
  { length: (CITY_WORLD_BOUNDS.maxX + 1) * (CITY_WORLD_BOUNDS.maxY + 1) },
  (_, index) => {
    const width = CITY_WORLD_BOUNDS.maxX + 1;
    const x = index % width;
    const y = Math.floor(index / width);
    return { id: nodeId(x, y), position: { x, y } };
  },
);

function edgeKey(a: CityWorldPosition, b: CityWorldPosition) {
  const first = `${a.x},${a.y}`;
  const second = `${b.x},${b.y}`;
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

export const CITY_ROAD_EDGES: CityRoadEdge[] = CITY_ROAD_NODES.flatMap(({ position }) => {
  const edges: CityRoadEdge[] = [];
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ] as const) {
    const next = { x: position.x + dx, y: position.y + dy };
    if (next.x > CITY_WORLD_BOUNDS.maxX || next.y > CITY_WORLD_BOUNDS.maxY) continue;
    if (CLOSED_ROAD_EDGES.has(edgeKey(position, next))) continue;
    const kind =
      position.x % 4 === 0 || position.y % 4 === 0
        ? "arterial"
        : position.x % 2 === 0 || position.y % 2 === 0
          ? "street"
          : "lane";
    edges.push({
      from: nodeId(position.x, position.y),
      to: nodeId(next.x, next.y),
      kind,
      cost: kind === "arterial" ? 0.85 : kind === "street" ? 1 : 1.2,
    });
  }
  return edges;
});

export const CITY_ROUNDABOUTS: CityWorldPosition[] = [
  { x: 7, y: 5 },
  { x: 4, y: 8 },
  { x: 10, y: 4 },
];

export const CITY_LIGHT_BEACONS = [
  { id: "market-crossing", position: { x: 4, y: 3 }, length: 0.5, color: "#ffd477" },
  { id: "central-square", position: { x: 7, y: 5 }, length: 0.7, color: "#b7e8ff" },
  { id: "oke-fia-road", position: { x: 10, y: 3 }, length: 0.55, color: "#8cebe1" },
  { id: "garage-entry", position: { x: 3, y: 8 }, length: 0.45, color: "#ffcb68" },
  { id: "campus-walk", position: { x: 5, y: 9 }, length: 0.5, color: "#c3f09a" },
  { id: "residential-corner", position: { x: 9, y: 9 }, length: 0.5, color: "#ffe19a" },
  { id: "culture-lane", position: { x: 2, y: 2 }, length: 0.45, color: "#e6bbff" },
  { id: "outskirts-road", position: { x: 12, y: 11 }, length: 0.4, color: "#c9edaa" },
] as const;

export function cityWorldToIso(position: CityWorldPosition, height = 0) {
  return {
    x: 500 + (position.x - position.y) * 31,
    y: 58 + (position.x + position.y) * 20 - height,
  };
}

export function cityIsoDiamond(center: CityWorldPosition, radius: CityWorldPosition) {
  return [
    cityWorldToIso({ x: center.x, y: center.y - radius.y }),
    cityWorldToIso({ x: center.x + radius.x, y: center.y }),
    cityWorldToIso({ x: center.x, y: center.y + radius.y }),
    cityWorldToIso({ x: center.x - radius.x, y: center.y }),
  ];
}

export function nearestCityRoadNode(position: CityWorldPosition) {
  const x = Math.round(Math.min(CITY_WORLD_BOUNDS.maxX, Math.max(0, position.x)));
  const y = Math.round(Math.min(CITY_WORLD_BOUNDS.maxY, Math.max(0, position.y)));
  return nodeId(x, y);
}

export function cityPositionForLocation(slug: string, fallback?: CityWorldPosition) {
  return WORLD_LOCATION_NODES[slug]?.position ?? fallback ?? { x: 7, y: 6 };
}

/** New location records use the existing 0-100 map_x/map_y fields for a deterministic fictional placement. */
export function cityPositionForRecord(location: {
  slug: string;
  map_x: number;
  map_y: number;
  canvas_x?: number;
  canvas_y?: number;
}): CityWorldPosition {
  const known = WORLD_LOCATION_NODES[location.slug];
  if (known) return known.position;
  const canvasX = location.canvas_x;
  const canvasY = location.canvas_y;
  if (typeof canvasX === "number" && Number.isFinite(canvasX) && typeof canvasY === "number" && Number.isFinite(canvasY)) {
    return {
      x: Math.round(Math.max(0, Math.min(1, canvasX) * CITY_WORLD_BOUNDS.maxX) * 100) / 100,
      y: Math.round(Math.max(0, Math.min(1, canvasY) * CITY_WORLD_BOUNDS.maxY) * 100) / 100,
    };
  }
  return {
    x: Math.round(Math.max(0, Math.min(14, location.map_x * 0.14)) * 100) / 100,
    y: Math.round(Math.max(0, Math.min(12, location.map_y * 0.12)) * 100) / 100,
  };
}

export function cityEntranceForRecord(location: {
  slug: string;
  map_x: number;
  map_y: number;
  canvas_x?: number;
  canvas_y?: number;
}): CityWorldPosition {
  return WORLD_LOCATION_NODES[location.slug]?.entrance ?? cityPositionForRecord(location);
}

export function cityEntranceForLocation(slug: string) {
  const node = WORLD_LOCATION_NODES[slug];
  return node?.entrance ?? cityPositionForLocation(slug);
}

export function cityDistrictForLocation(slug: string) {
  return WORLD_LOCATION_NODES[slug]?.districtId ?? "central";
}

export function findCityRoadPath(
  fromPosition: CityWorldPosition,
  toPosition: CityWorldPosition,
  blockedEdges: ReadonlySet<string> = new Set(),
): CityWorldPosition[] | null {
  const start = nearestCityRoadNode(fromPosition);
  const end = nearestCityRoadNode(toPosition);
  if (start === end) return [fromPosition, toPosition];

  const nodeById = new Map(CITY_ROAD_NODES.map((node) => [node.id, node.position]));
  const edgesByNode = new Map<string, Array<{ id: string; cost: number }>>();
  for (const edge of CITY_ROAD_EDGES) {
    const fromPosition = nodeById.get(edge.from)!;
    const toPosition = nodeById.get(edge.to)!;
    if (blockedEdges.has(edgeKey(fromPosition, toPosition))) continue;
    edgesByNode.set(edge.from, [
      ...(edgesByNode.get(edge.from) ?? []),
      { id: edge.to, cost: edge.cost },
    ]);
    edgesByNode.set(edge.to, [
      ...(edgesByNode.get(edge.to) ?? []),
      { id: edge.from, cost: edge.cost },
    ]);
  }
  const open = new Set([start]);
  const cameFrom = new Map<string, string>();
  const gScore = new Map([[start, 0]]);
  const fScore = new Map([[start, heuristic(nodeById.get(start)!, nodeById.get(end)!)]]);
  while (open.size) {
    let current = "";
    let bestScore = Number.POSITIVE_INFINITY;
    for (const candidate of open) {
      const score = fScore.get(candidate) ?? Number.POSITIVE_INFINITY;
      if (score < bestScore) {
        current = candidate;
        bestScore = score;
      }
    }
    if (current === end) {
      const path = [end];
      while (cameFrom.has(path[0]!)) path.unshift(cameFrom.get(path[0]!)!);
      const points = path.map((id) => nodeById.get(id)!);
      if (fromPosition.x !== points[0]?.x || fromPosition.y !== points[0]?.y)
        points.unshift(fromPosition);
      if (
        toPosition.x !== points[points.length - 1]?.x ||
        toPosition.y !== points[points.length - 1]?.y
      )
        points.push(toPosition);
      return points;
    }
    open.delete(current);
    for (const { id: neighbor, cost } of edgesByNode.get(current) ?? []) {
      const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + cost;
      if (tentative >= (gScore.get(neighbor) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(neighbor, current);
      gScore.set(neighbor, tentative);
      fScore.set(neighbor, tentative + heuristic(nodeById.get(neighbor)!, nodeById.get(end)!));
      open.add(neighbor);
    }
  }
  return null;
}

function heuristic(from: CityWorldPosition, to: CityWorldPosition) {
  return Math.abs(from.x - to.x) + Math.abs(from.y - to.y);
}

export function stableCityOffset(id: string, radius = 2) {
  let hash = 2166136261;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const span = radius * 2 + 1;
  return { x: ((hash >>> 0) % span) - radius, y: (((hash >>> 8) >>> 0) % span) - radius };
}

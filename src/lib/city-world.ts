export type CityWorldPosition = { x: number; y: number };
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

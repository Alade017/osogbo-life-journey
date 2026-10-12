import {
  CITY_ROAD_EDGES,
  CITY_ROAD_NODES,
  OSOGBO_WORLD_NODES,
  cityWorldToIso,
  type CityRoadEdge,
  type CityWorldPosition,
} from "@/lib/city-world";

export const MAX_FICTIONAL_CITY_SVG_NODES = 1200;
export const MAX_CITY_LOCATIONS = 60;
export const CITY_TREE_COUNT = 24;

const roadPositions = new Map(CITY_ROAD_NODES.map((node) => [node.id, node.position]));

function roadPathForKind(kinds: readonly CityRoadEdge["kind"][]) {
  return CITY_ROAD_EDGES.filter((edge) => kinds.includes(edge.kind))
    .map((edge) => {
      const from = roadPositions.get(edge.from);
      const to = roadPositions.get(edge.to);
      if (!from || !to) return "";
      const a = cityWorldToIso(from);
      const b = cityWorldToIso(to);
      return `M${a.x} ${a.y}L${b.x} ${b.y}`;
    })
    .filter(Boolean)
    .join("");
}

/** Road topology remains available for routing; its visual geometry is batched into four SVG paths. */
export const CITY_ROAD_SVG_PATHS = {
  arterial: roadPathForKind(["arterial"]),
  local: roadPathForKind(["street", "lane"]),
} as const;

export const CITY_TREE_POSITIONS: readonly CityWorldPosition[] = Array.from(
  { length: CITY_TREE_COUNT },
  (_, index) => ({
    x: 1 + ((index * 37) % 13),
    y: 1 + ((index * 19) % 11),
  }),
);

export const CITY_KNOWN_LOCATION_SLUGS = new Set(Object.keys(OSOGBO_WORLD_NODES));

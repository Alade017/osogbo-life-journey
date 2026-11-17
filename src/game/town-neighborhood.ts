import townData from "@/data/osogbo-town.json";
import type {
  NeighborhoodArea,
  NeighborhoodObject,
  NeighborhoodObstacle,
  NeighborhoodRoad,
  WorldPoint,
} from "./neighborhood-model.ts";

/**
 * Builds a walkable neighbourhood from the town map data (osogbo-town.json).
 *
 * The walk is a window of town cells centred on a landmark's grid cell. The landmark's cell sits
 * at the scene centre, so the player (who spawns at the centre) stands on that place. One town
 * cell is one 80 px tile, which matches NEIGHBORHOOD_TILE_SIZE and the 640 x 560 scene.
 */

type TownCell = { x: number; z: number };

type TownLandmark = {
  id: string;
  label: string;
  category: string;
  locationSlug?: string | null;
  grid?: TownCell;
};

type TownBuilding = { placeId: string; x: number; z: number; buildingType?: string };

type TownData = {
  landmarks: readonly TownLandmark[];
  grid: {
    rows: readonly string[];
    plotCells: readonly (readonly [number, number])[];
    treeCells: readonly (readonly [number, number])[];
    buildings: readonly TownBuilding[];
  };
};

const town = townData as unknown as TownData;

export const TOWN_TILE_SIZE = 80;
/** Scene centre, where the player stands. */
const CENTRE: WorldPoint = { x: 320, y: 300 };
/** Window in cells around the anchor: 8 columns by 7 rows fills the 640 x 560 scene. */
const WINDOW = { left: 4, right: 3, up: 3, down: 3 } as const;
/** Keep the spawn point and its neighbourhood clear of obstacles. */
const SPAWN_CLEARANCE = 28;
const ROAD_WIDTH = 72;

const TOWN_STYLE: NeighborhoodArea["style"] = {
  ground: 0xe8eedf,
  grid: 0xd3dfcb,
  road: 0xbac6b4,
  paving: 0xe8ddbd,
  marking: 0xfffaf0,
  verticalRoad: { x: CENTRE.x, width: ROAD_WIDTH },
  horizontalRoad: { y: CENTRE.y, height: ROAD_WIDTH },
};

/** The first town landmark that a location slug points at, if it has a grid cell. */
export function townAnchorForSlug(slug: string): TownLandmark | null {
  // Junctions are road features, not places to walk into, so they never anchor a slug.
  return (
    town.landmarks.find(
      (landmark) =>
        landmark.locationSlug === slug && landmark.grid && landmark.category !== "junction",
    ) ?? null
  );
}

function tileAt(cell: TownCell): string {
  return town.grid.rows[cell.z]?.[cell.x] ?? "g";
}

function offsetOf(cell: TownCell, anchor: TownCell): WorldPoint {
  return {
    x: CENTRE.x + (cell.x - anchor.x) * TOWN_TILE_SIZE,
    y: CENTRE.y + (cell.z - anchor.z) * TOWN_TILE_SIZE,
  };
}

function inWindow(cell: TownCell, anchor: TownCell): boolean {
  const dx = cell.x - anchor.x;
  const dz = cell.z - anchor.z;
  return dx >= -WINDOW.left && dx <= WINDOW.right && dz >= -WINDOW.up && dz <= WINDOW.down;
}

/** True when an obstacle box centred on `point` leaves the spawn point and its margin free. */
function clearOfSpawn(point: WorldPoint, width: number, height: number): boolean {
  return (
    Math.abs(point.x - CENTRE.x) > width / 2 + SPAWN_CLEARANCE ||
    Math.abs(point.y - CENTRE.y) > height / 2 + SPAWN_CLEARANCE
  );
}

function distanceTo(point: WorldPoint, target: WorldPoint): number {
  return Math.hypot(point.x - target.x, point.y - target.y);
}

function windowCells(anchor: TownCell): TownCell[] {
  const cells: TownCell[] = [];
  for (let z = anchor.z - WINDOW.up; z <= anchor.z + WINDOW.down; z += 1) {
    for (let x = anchor.x - WINDOW.left; x <= anchor.x + WINDOW.right; x += 1) {
      cells.push({ x, z });
    }
  }
  return cells;
}

/**
 * Keeps the roads that a walker can reach from the spawn point. Roads cut off by the window edge
 * or by gaps in the town grid are dropped so the walkable network stays connected.
 */
function connectedRoads(roads: readonly NeighborhoodRoad[]): NeighborhoodRoad[] {
  if (roads.length < 2) return [...roads];
  const span = (road: NeighborhoodRoad) => ({ lo: road.start ?? 0, hi: road.end ?? 0 });
  const slack = ROAD_WIDTH / 2;
  const crosses = (a: NeighborhoodRoad, b: NeighborhoodRoad) => {
    if (a.axis === b.axis) return false;
    const h = a.axis === "horizontal" ? a : b;
    const v = a.axis === "horizontal" ? b : a;
    const hs = span(h);
    const vs = span(v);
    return (
      v.offset >= hs.lo - slack &&
      v.offset <= hs.hi + slack &&
      h.offset >= vs.lo - slack &&
      h.offset <= vs.hi + slack
    );
  };
  const distanceToRoad = (road: NeighborhoodRoad) => {
    const { lo, hi } = span(road);
    if (road.axis === "horizontal") {
      const x = Math.min(Math.max(CENTRE.x, lo), hi);
      return Math.hypot(x - CENTRE.x, road.offset - CENTRE.y);
    }
    const y = Math.min(Math.max(CENTRE.y, lo), hi);
    return Math.hypot(road.offset - CENTRE.x, y - CENTRE.y);
  };
  let startIndex = 0;
  roads.forEach((road, index) => {
    if (distanceToRoad(road) < distanceToRoad(roads[startIndex]!)) startIndex = index;
  });
  const reached = new Set<number>([startIndex]);
  const queue = [startIndex];
  while (queue.length) {
    const current = queue.shift()!;
    roads.forEach((road, index) => {
      if (!reached.has(index) && crosses(roads[current]!, road)) {
        reached.add(index);
        queue.push(index);
      }
    });
  }
  return roads.filter((_, index) => reached.has(index));
}

/** Runs of road cells along one row or column, as [start, end] offsets from the anchor. */
function roadRuns(
  cells: readonly TownCell[],
  anchor: TownCell,
  axis: "horizontal" | "vertical",
): NeighborhoodRoad[] {
  const roads: NeighborhoodRoad[] = [];
  const lines = axis === "horizontal" ? WINDOW_LINES.rows : WINDOW_LINES.columns;
  for (const line of lines) {
    let runStart: number | null = null;
    const span = axis === "horizontal" ? WINDOW_SPANS.columns : WINDOW_SPANS.rows;
    for (let step = span.min; step <= span.max + 1; step += 1) {
      const cell =
        axis === "horizontal"
          ? { x: anchor.x + step, z: anchor.z + line }
          : { x: anchor.x + line, z: anchor.z + step };
      const isRoad = step <= span.max && tileAt(cell) === "r";
      if (isRoad && runStart === null) runStart = step;
      if (!isRoad && runStart !== null) {
        const from = offsetOf(
          axis === "horizontal"
            ? { x: anchor.x + runStart, z: anchor.z + line }
            : { x: anchor.x + line, z: anchor.z + runStart },
          anchor,
        );
        const to = offsetOf(
          axis === "horizontal"
            ? { x: anchor.x + step - 1, z: anchor.z + line }
            : { x: anchor.x + line, z: anchor.z + step - 1 },
          anchor,
        );
        const half = TOWN_TILE_SIZE / 2;
        roads.push({
          id: `town-road-${axis}-${line}-${runStart}`,
          axis,
          offset: axis === "horizontal" ? from.y : from.x,
          width: ROAD_WIDTH,
          type: "street",
          start: (axis === "horizontal" ? from.x : from.y) - half,
          end: (axis === "horizontal" ? to.x : to.y) + half,
        });
        runStart = null;
      }
    }
  }
  return roads;
}

const WINDOW_LINES = {
  rows: Array.from({ length: WINDOW.up + WINDOW.down + 1 }, (_, i) => i - WINDOW.up),
  columns: Array.from({ length: WINDOW.left + WINDOW.right + 1 }, (_, i) => i - WINDOW.left),
};
const WINDOW_SPANS = {
  columns: { min: -WINDOW.left, max: WINDOW.right },
  rows: { min: -WINDOW.up, max: WINDOW.down },
};

/** Points a walker can stand on: kept road cells, or open ground when the window has no roads. */
function accessPointsFor(
  cells: readonly TownCell[],
  anchor: TownCell,
  roads: readonly NeighborhoodRoad[],
): WorldPoint[] {
  const onKeptRoad = (point: WorldPoint) =>
    roads.some((road) => {
      const lo = road.start ?? 0;
      const hi = road.end ?? 0;
      return road.axis === "horizontal"
        ? Math.abs(point.y - road.offset) <= 1 && point.x >= lo && point.x <= hi
        : Math.abs(point.x - road.offset) <= 1 && point.y >= lo && point.y <= hi;
    });
  const roadCellPoints: WorldPoint[] = cells
    .filter((cell) => tileAt(cell) === "r")
    .map((cell) => offsetOf(cell, anchor))
    .filter(onKeptRoad);
  // A district without roads in its window still needs open ground for its destinations.
  return roadCellPoints.length
    ? roadCellPoints
    : cells.filter((cell) => tileAt(cell) !== "p").map((cell) => offsetOf(cell, anchor));
}

/**
 * Walkable area for one town landmark. Pure: the same anchor always yields the same area, so the
 * client and any other reader of the town data agree on the layout.
 */
export function townNeighborhoodArea(
  anchorLandmark: TownLandmark,
  displayName: string = anchorLandmark.label,
): NeighborhoodArea {
  const anchor = anchorLandmark.grid;
  if (!anchor) throw new Error(`Town landmark ${anchorLandmark.id} has no grid cell`);

  const cells = windowCells(anchor);
  const roads = connectedRoads([
    ...roadRuns(cells, anchor, "horizontal"),
    ...roadRuns(cells, anchor, "vertical"),
  ]);

  const coversKeptRoad = (point: WorldPoint, size: number) =>
    roads.some((road) => {
      const half = size / 2;
      const roadHalf = ROAD_WIDTH / 2;
      const lo = road.start ?? 0;
      const hi = road.end ?? 0;
      return road.axis === "horizontal"
        ? point.x + half > lo &&
            point.x - half < hi &&
            point.y + half > road.offset - roadHalf &&
            point.y - half < road.offset + roadHalf
        : point.y + half > lo &&
            point.y - half < hi &&
            point.x + half > road.offset - roadHalf &&
            point.x - half < road.offset + roadHalf;
    });
  const obstacles: NeighborhoodObstacle[] = [];
  const inside = (cell: TownCell) => inWindow(cell, anchor);

  for (const [x, z] of town.grid.plotCells) {
    const cell = { x, z };
    if (!inside(cell) || tileAt(cell) === "r") continue;
    const point = offsetOf(cell, anchor);
    const size = TOWN_TILE_SIZE - 8;
    if (!clearOfSpawn(point, size, size)) continue;
    obstacles.push({
      id: `town-plot-${x}-${z}`,
      kind: "compound",
      x: point.x,
      y: point.y,
      width: size,
      height: size,
    });
  }

  for (const [x, z] of town.grid.treeCells) {
    const cell = { x, z };
    if (!inside(cell)) continue;
    const point = offsetOf(cell, anchor);
    if (!clearOfSpawn(point, 36, 36)) continue;
    obstacles.push({
      id: `town-tree-${x}-${z}`,
      kind: "tree",
      x: point.x,
      y: point.y,
      width: 36,
      height: 36,
    });
  }

  // The place itself stands just in front of the spawn, so the player arrives at its entrance.
  // It must not sit across a road, so the first clear spot north (then south) is used.
  const frontageFor = (size: number): WorldPoint => {
    const options = [-2, -3, -4, 2].map((k) => ({ x: CENTRE.x, y: CENTRE.y + k * TOWN_TILE_SIZE }));
    const free = options.find((option) => !coversKeptRoad(option, size));
    return free ?? options[0]!;
  };
  const placed = new Set<string>();
  for (const building of town.grid.buildings) {
    const cell = { x: building.x, z: building.z };
    if (!inside(cell)) continue;
    const landmark = town.landmarks.find((item) => item.id === building.placeId);
    if (!landmark) continue;
    // A building is a 2 x 2 footprint, so its centre sits half a cell past its top-left cell.
    const footprint = TOWN_TILE_SIZE * 2 - 12;
    const point =
      landmark.id === anchorLandmark.id
        ? frontageFor(footprint)
        : offsetOf({ x: building.x + 0.5, z: building.z + 0.5 }, anchor);
    if (!clearOfSpawn(point, footprint, footprint)) continue;
    placed.add(landmark.id);
    obstacles.push({
      id: `town-building-${landmark.id}`,
      kind: "shop",
      label: landmark.label,
      x: point.x,
      y: point.y,
      width: TOWN_TILE_SIZE * 2 - 12,
      height: TOWN_TILE_SIZE * 2 - 12,
    });
  }

  const landmarksInside = town.landmarks.filter(
    (landmark) => landmark.grid && inside(landmark.grid),
  );
  for (const landmark of landmarksInside) {
    if (placed.has(landmark.id) || !landmark.grid) continue;
    const point =
      landmark.id === anchorLandmark.id ? frontageFor(60) : offsetOf(landmark.grid, anchor);
    if (!clearOfSpawn(point, 60, 60)) continue;
    obstacles.push({
      id: `town-landmark-${landmark.id}`,
      kind: "landmark",
      label: landmark.label,
      x: point.x,
      y: point.y,
      width: 60,
      height: 60,
    });
  }

  const plotPoints = obstacles
    .filter((obstacle) => obstacle.kind === "compound")
    .map((obstacle) => ({ x: obstacle.x, y: obstacle.y }));
  // Destinations sit on road cells so every place can be reached on foot.
  const accessPoints = accessPointsFor(cells, anchor, roads);

  const objects: NeighborhoodObject[] = [];
  const key = (point: WorldPoint) => `${point.x}:${point.y}`;
  const taken = new Set<string>();
  // Each destination takes the free access point nearest its target, so no two share a spot.
  const pick = (target: WorldPoint): WorldPoint => {
    const candidates = accessPoints.filter(
      (point) => !taken.has(key(point)) && distanceTo(point, CENTRE) > SPAWN_CLEARANCE,
    );
    if (!candidates.length) return target;
    const best = candidates.reduce((closest, point) =>
      distanceTo(point, target) < distanceTo(closest, target) ? point : closest,
    );
    taken.add(key(best));
    return best;
  };
  const landmarkPoint = (category: string) => {
    const match = landmarksInside.find((landmark) => landmark.category === category);
    return match?.grid ? offsetOf(match.grid, anchor) : null;
  };
  const plotCentre = plotPoints.length
    ? plotPoints.reduce((best, point) =>
        distanceTo(point, CENTRE) < distanceTo(best, CENTRE) ? point : best,
      )
    : null;

  // The player arrives at the spawn point, which is their home in this walk.
  objects.push({
    id: "home",
    name: `${displayName} homes`,
    kind: "home",
    walkIn: true,
    x: CENTRE.x,
    y: CENTRE.y,
  });
  objects.push({
    id: "market",
    name: `${displayName} shops`,
    kind: "market",
    walkIn: true,
    ...pick(landmarkPoint("market") ?? { x: CENTRE.x + TOWN_TILE_SIZE, y: CENTRE.y }),
  });
  objects.push({
    id: "work",
    name: `${displayName} opportunities`,
    kind: "work",
    walkIn: true,
    ...pick(landmarkPoint("services") ?? { x: CENTRE.x, y: CENTRE.y + TOWN_TILE_SIZE }),
  });
  const neighbourTargets: WorldPoint[] = [
    { x: CENTRE.x - TOWN_TILE_SIZE, y: CENTRE.y + TOWN_TILE_SIZE },
    { x: CENTRE.x + TOWN_TILE_SIZE, y: CENTRE.y - TOWN_TILE_SIZE },
    { x: CENTRE.x - TOWN_TILE_SIZE, y: CENTRE.y - TOWN_TILE_SIZE },
  ];
  neighbourTargets.forEach((target, index) => {
    objects.push({
      id: index === 0 ? "npc" : `npc-${index + 1}`,
      name: `${displayName} neighbour ${index + 1}`,
      kind: "npc",
      walkIn: true,
      ...pick(target),
    });
  });

  // Street dressing on the verge of each road, clear of the spawn and the destinations.
  let furnitureIndex = 0;
  for (const road of roads) {
    const span = { lo: road.start ?? 0, hi: road.end ?? 0 };
    for (let along = span.lo + TOWN_TILE_SIZE / 2; along < span.hi; along += TOWN_TILE_SIZE) {
      const point =
        road.axis === "horizontal" ? { x: along, y: road.offset } : { x: road.offset, y: along };
      const verge = (furnitureIndex % 2 === 0 ? -1 : 1) * (ROAD_WIDTH / 2 + 14);
      const at =
        road.axis === "horizontal"
          ? { x: point.x, y: point.y + verge }
          : { x: point.x + verge, y: point.y };
      furnitureIndex += 1;
      if (!clearOfSpawn(at, 16, 16)) continue;
      if (distanceTo(at, CENTRE) < 60) continue;
      obstacles.push({
        id: `town-furniture-${furnitureIndex}`,
        kind: furnitureIndex % 3 === 0 ? "bench" : "streetlight",
        x: at.x,
        y: at.y,
        width: 16,
        height: 16,
      });
    }
  }

  return {
    slug: anchorLandmark.locationSlug ?? anchorLandmark.id,
    name: displayName,
    objects,
    obstacles,
    roads,
    paths: [],
    dressing: [],
    style: TOWN_STYLE,
  };
}

/**
 * Where a town landmark stands in its anchor's walk, and the walkable point nearest to it. Places
 * authored as interaction spots (pumps, shops, stands) use this, so they move with the layout.
 */
export function townSpotFor(
  anchorSlug: string,
  landmarkId: string,
): { position: WorldPoint; accessPoint: WorldPoint } {
  const anchor = townAnchorForSlug(anchorSlug)?.grid;
  const landmark = town.landmarks.find((item) => item.id === landmarkId);
  if (!anchor) throw new Error(`No town anchor for slug ${anchorSlug}`);
  if (!landmark?.grid) throw new Error(`No town landmark ${landmarkId}`);
  const position = offsetOf(landmark.grid, anchor);

  // Other spots in this window, so the access point can be told apart from its neighbours.
  const occupied = new Set(
    town.landmarks
      .filter((item) => item.grid && item.id !== landmarkId && inWindow(item.grid, anchor))
      .map((item) => `${item.grid!.x}:${item.grid!.z}`),
  );
  const others = [...occupied].map((key) => {
    const [x, z] = key.split(":").map(Number) as [number, number];
    return offsetOf({ x, z }, anchor);
  });
  // Solid obstacles of this walk, so an access point never lands inside a building or spot.
  const solid = townNeighborhoodArea(townAnchorForSlug(anchorSlug)!).obstacles ?? [];
  const isOpen = (point: WorldPoint) =>
    !solid.some(
      (obstacle) =>
        Math.abs(point.x - obstacle.x) < (obstacle.width ?? 0) / 2 + 20 &&
        Math.abs(point.y - obstacle.y) < (obstacle.height ?? 0) / 2 + 20,
    );
  const sides: TownCell[] = [
    { x: landmark.grid.x, z: landmark.grid.z - 1 },
    { x: landmark.grid.x, z: landmark.grid.z + 1 },
    { x: landmark.grid.x + 1, z: landmark.grid.z },
    { x: landmark.grid.x - 1, z: landmark.grid.z },
  ].filter(
    (cell) =>
      inWindow(cell, anchor) &&
      tileAt(cell) !== "p" &&
      !occupied.has(`${cell.x}:${cell.z}`) &&
      isOpen(offsetOf(cell, anchor)),
  );
  if (!sides.length) return { position, accessPoint: CENTRE };

  // Prefer the side that is nearest this spot and furthest from every other spot.
  const score = (cell: TownCell) => {
    const point = offsetOf(cell, anchor);
    const nearestOther = others.length
      ? Math.min(...others.map((other) => distanceTo(point, other)))
      : TOWN_TILE_SIZE * 4;
    return nearestOther - distanceTo(point, position);
  };
  const best = sides.reduce((top, cell) => (score(cell) > score(top) ? cell : top));
  return { position, accessPoint: offsetOf(best, anchor) };
}

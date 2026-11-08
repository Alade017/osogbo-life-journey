import type {
  NeighborhoodArea,
  NeighborhoodObstacle,
  NeighborhoodRoad,
  WorldPoint,
} from "./neighborhood-model.ts";
import { neighborhoodBuildingFootprint } from "./neighborhood-geometry.ts";

/** A flat rectangle in neighbourhood units. Centre is (x, y); depth runs along y. */
export type DressingRect = { x: number; y: number; width: number; depth: number };
export type DressingBounds = { left: number; top: number; width: number; height: number };
export type CarSpot = WorldPoint & { rotation: number };
export type TrafficLightSpot = WorldPoint & { rotation: number };

const SIDEWALK_WIDTH = 16;
const CURB_WIDTH = 4;
const SEGMENT_LENGTH = 60;
const LIGHT_SPACING = 260;
const LIGHT_SETBACK = 14;
const CAR_SPACING = 240;
const PEOPLE_SPACING = 260;
const MAX_PEOPLE = 14;
const MAX_CARS = 12;
const MARKING_SPACING = 64;
const MARKING_LENGTH = 26;

/** Along-road extent of a road, using the area bounds when the road runs to the edge. */
export function roadExtent(road: NeighborhoodRoad, bounds: DressingBounds) {
  const vertical = road.axis === "vertical";
  const min = vertical ? bounds.top : bounds.left;
  const max = vertical ? bounds.top + bounds.height : bounds.left + bounds.width;
  return { start: road.start ?? min, end: road.end ?? max, vertical };
}

type Box = { x: number; y: number; width: number; height: number };

/** Everything street dressing must stay clear of: obstacles, and the main building footprints. */
function occupiedBoxes(area: NeighborhoodArea): Box[] {
  const obstacles: Box[] = (area.obstacles ?? []).map((o) => ({
    x: o.x,
    y: o.y,
    width: o.width,
    height: o.height,
  }));
  const buildings: Box[] = area.objects
    .filter((o) => o.kind !== "npc")
    .map((o) => {
      const footprint = neighborhoodBuildingFootprint(o);
      return {
        x: footprint.left + footprint.width / 2,
        y: footprint.top + footprint.height / 2,
        width: footprint.width,
        height: footprint.height,
      };
    });
  return [...obstacles, ...buildings];
}

function insideObstacle(x: number, y: number, boxes: readonly Box[], pad: number) {
  return boxes.some(
    (box) =>
      Math.abs(x - box.x) < box.width / 2 + pad && Math.abs(y - box.y) < box.height / 2 + pad,
  );
}

function overlapsObstacle(rect: DressingRect, boxes: readonly Box[], pad = 0) {
  return boxes.some(
    (box) =>
      Math.abs(rect.x - box.x) < (rect.width + box.width) / 2 + pad &&
      Math.abs(rect.y - box.y) < (rect.depth + box.height) / 2 + pad,
  );
}

/** Centre-line dashes along every street and arterial. */
export function roadMarkings(area: NeighborhoodArea, bounds: DressingBounds): DressingRect[] {
  const rects: DressingRect[] = [];
  const boxes = occupiedBoxes(area);
  const crossings = pedestrianCrossings(area);
  const crossingBoxes: Box[] = crossings.map(({ x, y, width, depth }) => ({
    x,
    y,
    width,
    height: depth,
  }));
  for (const road of area.roads ?? []) {
    if (road.type === "lane") continue;
    const { start, end, vertical } = roadExtent(road, bounds);
    for (let along = start + MARKING_SPACING / 2; along < end; along += MARKING_SPACING) {
      const x = vertical ? road.offset : along;
      const y = vertical ? along : road.offset;
      const width = vertical ? 4 : MARKING_LENGTH;
      const depth = vertical ? MARKING_LENGTH : 4;
      const marking = { x, y, width, depth };
      if (
        insideObstacle(x, y, boxes, Math.max(width, depth) / 2 + 2) ||
        overlapsObstacle(marking, crossingBoxes, 0)
      ) continue;
      rects.push(marking);
    }
  }
  return rects;
}

/** Sidewalks and kerbs on both sides of each road, skipping stretches that would sit inside a building. */
export function sidewalksAndCurbs(
  area: NeighborhoodArea,
  bounds: DressingBounds,
): { sidewalks: DressingRect[]; curbs: DressingRect[] } {
  const sidewalks: DressingRect[] = [];
  const curbs: DressingRect[] = [];
  const boxes = occupiedBoxes(area);
  const crossings = pedestrianCrossings(area);
  const crossingBoxes: Box[] = crossings.map(({ x, y, width, depth }) => ({
    x,
    y,
    width,
    height: depth,
  }));
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const offsetAcross = road.width / 2 + SIDEWALK_WIDTH / 2;
    for (const side of [-1, 1]) {
      for (let along = start; along < end; along += SEGMENT_LENGTH) {
        const segmentEnd = Math.min(end, along + SEGMENT_LENGTH);
        const span = segmentEnd - along;
        const mid = (along + segmentEnd) / 2;
        const across = road.offset + side * offsetAcross;
        const x = vertical ? across : mid;
        const y = vertical ? mid : across;
        const sidewalk: DressingRect = {
          x,
          y,
          width: vertical ? SIDEWALK_WIDTH : span,
          depth: vertical ? span : SIDEWALK_WIDTH,
        };
        // Test complete footprints and leave a clear break where a crossing meets the footpath.
        if (
          overlapsObstacle(sidewalk, boxes, 10) ||
          overlapsObstacle(sidewalk, crossingBoxes, 0)
        ) continue;
        sidewalks.push(sidewalk);
        const kerb = side * (road.width / 2 + CURB_WIDTH / 2);
        const curb: DressingRect = {
          x: vertical ? road.offset + kerb : x,
          y: vertical ? y : road.offset + kerb,
          width: vertical ? CURB_WIDTH : span,
          depth: vertical ? span : CURB_WIDTH,
        };
        if (!overlapsObstacle(curb, crossingBoxes, 0))
          curbs.push(curb);
      }
    }
  }
  return { sidewalks, curbs };
}

/** Zebra-style crossing blocks on the approach to every street junction. */
export function pedestrianCrossings(area: NeighborhoodArea): DressingRect[] {
  const roads = area.roads ?? [];
  const verticals = roads.filter((road) => road.axis === "vertical");
  const horizontals = roads.filter((road) => road.axis === "horizontal");
  const rects: DressingRect[] = [];
  const boxes = occupiedBoxes(area);
  const seen = new Set<string>();
  const withinRoadSpan = (road: NeighborhoodRoad, center: number, halfLength: number) =>
    (road.start === undefined || center - halfLength >= road.start) &&
    (road.end === undefined || center + halfLength <= road.end);
  const addCrossing = (key: string, rect: DressingRect) => {
    const overlapsObstacle = boxes.some(
      (box) =>
        Math.abs(rect.x - box.x) < (rect.width + box.width) / 2 + 2 &&
        Math.abs(rect.y - box.y) < (rect.depth + box.height) / 2 + 2,
    );
    if (seen.has(key) || overlapsObstacle) return;
    seen.add(key);
    rects.push(rect);
  };

  for (const vertical of verticals)
    for (const horizontal of horizontals) {
      const verticalStart = vertical.start;
      const verticalEnd = vertical.end;
      const horizontalStart = horizontal.start;
      const horizontalEnd = horizontal.end;
      if (
        (verticalStart !== undefined && horizontal.offset < verticalStart) ||
        (verticalEnd !== undefined && horizontal.offset > verticalEnd) ||
        (horizontalStart !== undefined && vertical.offset < horizontalStart) ||
        (horizontalEnd !== undefined && vertical.offset > horizontalEnd)
      ) continue;

      const verticalApproach = horizontal.width / 2 + 14;
      for (const y of [horizontal.offset - verticalApproach, horizontal.offset + verticalApproach]) {
        // Extend across both kerbs and footpaths so the crossing actually connects them.
        const width = vertical.width + 2 * (SIDEWALK_WIDTH + CURB_WIDTH);
        const depth = 14;
        if (
          !withinRoadSpan(vertical, y, depth / 2) ||
          !withinRoadSpan(horizontal, vertical.offset, width / 2)
        ) continue;
        addCrossing(`vertical:${vertical.id}:${horizontal.id}:${y}`, {
          x: vertical.offset,
          y,
          width,
          depth,
        });
      }

      const horizontalApproach = vertical.width / 2 + 14;
      for (const x of [vertical.offset - horizontalApproach, vertical.offset + horizontalApproach]) {
        const width = 14;
        const depth = horizontal.width + 2 * (SIDEWALK_WIDTH + CURB_WIDTH);
        if (
          !withinRoadSpan(vertical, horizontal.offset, depth / 2) ||
          !withinRoadSpan(horizontal, x, width / 2)
        ) continue;
        addCrossing(`horizontal:${vertical.id}:${horizontal.id}:${x}`, {
          x,
          y: horizontal.offset,
          width,
          depth,
        });
      }
    }
  return rects;
}

/** Split each crossing envelope into evenly spaced zebra stripes for rendering. */
export function pedestrianCrossingStripes(crossings: readonly DressingRect[]): DressingRect[] {
  const stripeCount = 4;
  return crossings.flatMap((crossing) => {
    const spansX = crossing.width >= crossing.depth;
    const travelSpan = spansX ? crossing.depth : crossing.width;
    const spacing = travelSpan / (stripeCount + 1);
    const thickness = Math.min(3, spacing * 0.55);
    return Array.from({ length: stripeCount }, (_, index) => {
      const offset = -travelSpan / 2 + spacing * (index + 1);
      return spansX
        ? {
            x: crossing.x,
            y: crossing.y + offset,
            width: crossing.width,
            depth: thickness,
          }
        : {
            x: crossing.x + offset,
            y: crossing.y,
            width: thickness,
            depth: crossing.depth,
          };
    });
  });
}

/** Signals at declared arterial junctions, positioned clear of road edges and existing props. */
export function trafficLightSpots(area: NeighborhoodArea): TrafficLightSpot[] {
  const verticals = (area.roads ?? []).filter(
    (road) => road.axis === "vertical" && road.type !== "lane",
  );
  const horizontals = (area.roads ?? []).filter(
    (road) => road.axis === "horizontal" && road.type !== "lane",
  );
  const boxes = occupiedBoxes(area);
  const spots: TrafficLightSpot[] = [];
  const seen = new Set<string>();
  for (const vertical of verticals)
    for (const horizontal of horizontals) {
      if (vertical.type !== "arterial" && horizontal.type !== "arterial") continue;
      const verticalStart = vertical.start;
      const verticalEnd = vertical.end;
      const horizontalStart = horizontal.start;
      const horizontalEnd = horizontal.end;
      if (
        (verticalStart !== undefined && horizontal.offset < verticalStart) ||
        (verticalEnd !== undefined && horizontal.offset > verticalEnd) ||
        (horizontalStart !== undefined && vertical.offset < horizontalStart) ||
        (horizontalEnd !== undefined && vertical.offset > horizontalEnd)
      ) continue;
      // Put signal poles beyond the footpath edge, not on the zebra crossings.
      const setbackX = vertical.width / 2 + SIDEWALK_WIDTH + CURB_WIDTH + 12;
      const setbackY = horizontal.width / 2 + SIDEWALK_WIDTH + CURB_WIDTH + 12;
      for (const sideX of [-1, 1])
        for (const sideY of [-1, 1]) {
          const x = vertical.offset + sideX * setbackX;
          const y = horizontal.offset + sideY * setbackY;
          const key = `${x}:${y}`;
          const withinVertical =
            (vertical.start === undefined || y >= vertical.start) &&
            (vertical.end === undefined || y <= vertical.end);
          const withinHorizontal =
            (horizontal.start === undefined || x >= horizontal.start) &&
            (horizontal.end === undefined || x <= horizontal.end);
          if (
            seen.has(key) ||
            !withinVertical ||
            !withinHorizontal ||
            insideObstacle(x, y, boxes, 8)
          ) continue;
          seen.add(key);
          spots.push({
            x,
            y,
            // The signal faces inward toward the approaching junction.
            rotation: Math.atan2(-sideX, -sideY),
          });
        }
    }
  return spots;
}

/** Street lights set back from the kerb along every street, away from existing lamp posts. */
export function streetLightSpots(area: NeighborhoodArea, bounds: DressingBounds): WorldPoint[] {
  const lamps = (area.obstacles ?? []).filter((o) => o.kind === "streetlight");
  const boxes = occupiedBoxes(area);
  const crossingBoxes: Box[] = pedestrianCrossings(area).map(({ x, y, width, depth }) => ({
    x,
    y,
    width,
    height: depth,
  }));
  const spots: WorldPoint[] = [];
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const across = road.width / 2 + LIGHT_SETBACK;
    // One side of each street, alternating along it, so lamps do not crowd the view.
    let side = 1;
    for (let along = start + LIGHT_SPACING / 2; along < end; along += LIGHT_SPACING) {
      side = -side;
      {
        const x = vertical ? road.offset + side * across : along;
        const y = vertical ? along : road.offset + side * across;
        if (lamps.some((lamp) => Math.hypot(lamp.x - x, lamp.y - y) < 40)) continue;
        if (
          insideObstacle(x, y, boxes, 6) ||
          insideObstacle(x, y, crossingBoxes, 6)
        ) continue;
        spots.push({ x, y });
      }
    }
  }
  return spots;
}

/** Cars in the lanes of arterials and streets, alternating direction by lane. */
export function carSpots(area: NeighborhoodArea, bounds: DressingBounds): CarSpot[] {
  const byRoad: CarSpot[][] = [];
  const boxes = occupiedBoxes(area);
  const crossingBoxes: Box[] = pedestrianCrossings(area).map(({ x, y, width, depth }) => ({
    x,
    y,
    width,
    height: depth,
  }));
  for (const road of area.roads ?? []) {
    if (road.type === "lane") continue;
    const { start, end, vertical } = roadExtent(road, bounds);
    const roadSpots: CarSpot[] = [];
    for (let along = start + CAR_SPACING / 2; along < end; along += CAR_SPACING)
      for (const lane of [-1, 1]) {
        const across = lane * road.width * 0.22;
        const x = vertical ? road.offset + across : along;
        const y = vertical ? along : road.offset + across;
        // Keep parked traffic props out of zebra crossings and their approach space.
        if (
          insideObstacle(x, y, boxes, 28) ||
          insideObstacle(x, y, crossingBoxes, 24)
        ) continue;
        const rotation = vertical
          ? lane === -1
            ? -Math.PI / 2
            : Math.PI / 2
          : lane === -1
            ? 0
            : Math.PI;
        roadSpots.push({ x, y, rotation });
      }
    if (roadSpots.length) byRoad.push(roadSpots);
  }

  // Interleave roads so the visual vehicle cap does not hide every road after the first.
  const spots: CarSpot[] = [];
  for (let index = 0; spots.length < MAX_CARS; index += 1) {
    let added = false;
    for (const roadSpots of byRoad) {
      const spot = roadSpots[index];
      if (!spot) continue;
      spots.push(spot);
      added = true;
      if (spots.length === MAX_CARS) break;
    }
    if (!added) break;
  }
  return spots;
}

/** Pedestrians on the sidewalks, alternating sides, spaced along each street. */
export function pedestrianSpots(area: NeighborhoodArea, bounds: DressingBounds): WorldPoint[] {
  const byRoad: WorldPoint[][] = [];
  const boxes = occupiedBoxes(area);
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const across = road.width / 2 + SIDEWALK_WIDTH / 2;
    const roadSpots: WorldPoint[] = [];
    let side = 1;
    for (let along = start + PEOPLE_SPACING / 2; along < end; along += PEOPLE_SPACING) {
      side = -side;
      const x = vertical ? road.offset + side * across : along;
      const y = vertical ? along : road.offset + side * across;
      if (insideObstacle(x, y, boxes, 12)) continue;
      roadSpots.push({ x, y });
    }
    if (roadSpots.length) byRoad.push(roadSpots);
  }

  // Give each street a chance to contribute before the scene's pedestrian cap is reached.
  const spots: WorldPoint[] = [];
  for (let index = 0; spots.length < MAX_PEOPLE; index += 1) {
    let added = false;
    for (const roadSpots of byRoad) {
      const spot = roadSpots[index];
      if (!spot) continue;
      spots.push(spot);
      added = true;
      if (spots.length === MAX_PEOPLE) break;
    }
    if (!added) break;
  }
  return spots;
}

/** Derive a stable tree silhouette from the footprint supplied by neighborhood data. */
export function treeVisualProfile(obstacle: Pick<NeighborhoodObstacle, "width" | "height">) {
  return {
    height: Math.min(1.25, Math.max(0.75, obstacle.height / 48)),
    canopyScale: Math.min(1.3, Math.max(0.75, obstacle.width / 48)),
  };
}

/** Vendors stand at the market stalls the area declares. */
export function vendorSpots(area: NeighborhoodArea): WorldPoint[] {
  return [...(area.marketStalls ?? [])];
}

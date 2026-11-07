import type {
  NeighborhoodArea,
  NeighborhoodObstacle,
  NeighborhoodRoad,
  WorldPoint,
} from "./neighborhood-model.ts";

/** A flat rectangle in neighbourhood units. Centre is (x, y); depth runs along y. */
export type DressingRect = { x: number; y: number; width: number; depth: number };
export type DressingBounds = { left: number; top: number; width: number; height: number };

const SIDEWALK_WIDTH = 16;
const CURB_WIDTH = 4;
const SEGMENT_LENGTH = 60;
const LIGHT_SPACING = 150;
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

function insideObstacle(
  x: number,
  y: number,
  obstacles: readonly NeighborhoodObstacle[],
  pad: number,
) {
  return obstacles.some(
    (o) => Math.abs(x - o.x) < o.width / 2 + pad && Math.abs(y - o.y) < o.height / 2 + pad,
  );
}

/** Centre-line dashes along every street and arterial. */
export function roadMarkings(area: NeighborhoodArea, bounds: DressingBounds): DressingRect[] {
  const rects: DressingRect[] = [];
  for (const road of area.roads ?? []) {
    if (road.type === "lane") continue;
    const { start, end, vertical } = roadExtent(road, bounds);
    for (let along = start + MARKING_SPACING / 2; along < end; along += MARKING_SPACING) {
      const x = vertical ? road.offset : along;
      const y = vertical ? along : road.offset;
      rects.push({
        x,
        y,
        width: vertical ? 4 : MARKING_LENGTH,
        depth: vertical ? MARKING_LENGTH : 4,
      });
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
  const obstacles = (area.obstacles ?? []).filter((o) => o.kind !== "tree");
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const offsetAcross = road.width / 2 + SIDEWALK_WIDTH / 2;
    for (const side of [-1, 1]) {
      for (let along = start; along < end; along += SEGMENT_LENGTH) {
        const mid = Math.min(end, along + SEGMENT_LENGTH) - SEGMENT_LENGTH / 2;
        const x = vertical ? road.offset + side * offsetAcross : mid;
        const y = vertical ? mid : road.offset + side * offsetAcross;
        if (insideObstacle(x, y, obstacles, 10)) continue;
        const span = Math.min(end, along + SEGMENT_LENGTH) - along;
        sidewalks.push({
          x,
          y,
          width: vertical ? SIDEWALK_WIDTH : span,
          depth: vertical ? span : SIDEWALK_WIDTH,
        });
        const kerb = side * (road.width / 2 + CURB_WIDTH / 2);
        curbs.push({
          x: vertical ? road.offset + kerb : x,
          y: vertical ? y : road.offset + kerb,
          width: vertical ? CURB_WIDTH : span,
          depth: vertical ? span : CURB_WIDTH,
        });
      }
    }
  }
  return { sidewalks, curbs };
}

/** Zebra-style crossing blocks on the approach to every street junction. */
export function pedestrianCrossings(area: NeighborhoodArea): DressingRect[] {
  const roads = area.roads ?? [];
  const verticals = roads.filter((r) => r.axis === "vertical");
  const horizontals = roads.filter((r) => r.axis === "horizontal");
  const rects: DressingRect[] = [];
  for (const v of verticals)
    for (const h of horizontals) {
      const approach = h.width / 2 + 14;
      rects.push({ x: v.offset, y: h.offset - approach, width: v.width * 0.9, depth: 14 });
      rects.push({ x: v.offset, y: h.offset + approach, width: v.width * 0.9, depth: 14 });
    }
  return rects;
}

/** Street lights set back from the kerb along every street, away from existing lamp posts. */
export function streetLightSpots(area: NeighborhoodArea, bounds: DressingBounds): WorldPoint[] {
  const lamps = (area.obstacles ?? []).filter((o) => o.kind === "streetlight");
  const spots: WorldPoint[] = [];
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const across = road.width / 2 + LIGHT_SETBACK;
    for (const side of [-1, 1])
      for (let along = start + LIGHT_SPACING / 2; along < end; along += LIGHT_SPACING) {
        const x = vertical ? road.offset + side * across : along;
        const y = vertical ? along : road.offset + side * across;
        if (lamps.some((lamp) => Math.hypot(lamp.x - x, lamp.y - y) < 40)) continue;
        spots.push({ x, y });
      }
  }
  return spots;
}

/** Cars in the lanes of arterials and streets, alternating direction by lane. */
export function carSpots(area: NeighborhoodArea, bounds: DressingBounds): WorldPoint[] {
  const spots: WorldPoint[] = [];
  for (const road of area.roads ?? []) {
    if (road.type === "lane") continue;
    const { start, end, vertical } = roadExtent(road, bounds);
    for (const lane of [-1, 1])
      for (let along = start + CAR_SPACING / 2; along < end; along += CAR_SPACING) {
        const across = lane * road.width * 0.22;
        spots.push({
          x: vertical ? road.offset + across : along,
          y: vertical ? along : road.offset + across,
        });
      }
  }
  return spots.slice(0, MAX_CARS);
}

/** Pedestrians on the sidewalks, alternating sides, spaced along each street. */
export function pedestrianSpots(area: NeighborhoodArea, bounds: DressingBounds): WorldPoint[] {
  const spots: WorldPoint[] = [];
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const across = road.width / 2 + SIDEWALK_WIDTH / 2;
    let side = 1;
    for (let along = start + PEOPLE_SPACING / 2; along < end; along += PEOPLE_SPACING) {
      side = -side;
      spots.push({
        x: vertical ? road.offset + side * across : along,
        y: vertical ? along : road.offset + side * across,
      });
    }
  }
  return spots.slice(0, MAX_PEOPLE);
}

/** Vendors stand at the market stalls the area declares. */
export function vendorSpots(area: NeighborhoodArea): WorldPoint[] {
  return [...(area.marketStalls ?? [])];
}

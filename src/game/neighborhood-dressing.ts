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

/** Centre-line dashes along every street and arterial. */
export function roadMarkings(area: NeighborhoodArea, bounds: DressingBounds): DressingRect[] {
  const rects: DressingRect[] = [];
  const boxes = occupiedBoxes(area);
  for (const road of area.roads ?? []) {
    if (road.type === "lane") continue;
    const { start, end, vertical } = roadExtent(road, bounds);
    for (let along = start + MARKING_SPACING / 2; along < end; along += MARKING_SPACING) {
      const x = vertical ? road.offset : along;
      const y = vertical ? along : road.offset;
      const width = vertical ? 4 : MARKING_LENGTH;
      const depth = vertical ? MARKING_LENGTH : 4;
      if (insideObstacle(x, y, boxes, Math.max(width, depth) / 2 + 2)) continue;
      rects.push({ x, y, width, depth });
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
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const offsetAcross = road.width / 2 + SIDEWALK_WIDTH / 2;
    for (const side of [-1, 1]) {
      for (let along = start; along < end; along += SEGMENT_LENGTH) {
        const segmentEnd = Math.min(end, along + SEGMENT_LENGTH);
        const span = segmentEnd - along;
        const mid = (along + segmentEnd) / 2;
        const across = road.offset + side * offsetAcross;
        // Check both ends and the middle, so a segment cannot run into a building.
        const blocked = [along, mid, segmentEnd].some((at) =>
          insideObstacle(vertical ? across : at, vertical ? at : across, boxes, 10),
        );
        if (blocked) continue;
        const x = vertical ? across : mid;
        const y = vertical ? mid : across;
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
  const boxes = occupiedBoxes(area);
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
        if (insideObstacle(x, y, boxes, 6)) continue;
        spots.push({ x, y });
      }
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
        const x = vertical ? road.offset + across : along;
        const y = vertical ? along : road.offset + across;
        if (insideObstacle(x, y, occupiedBoxes(area), 28)) continue;
        spots.push({ x, y });
      }
  }
  return spots.slice(0, MAX_CARS);
}

/** Pedestrians on the sidewalks, alternating sides, spaced along each street. */
export function pedestrianSpots(area: NeighborhoodArea, bounds: DressingBounds): WorldPoint[] {
  const spots: WorldPoint[] = [];
  const boxes = occupiedBoxes(area);
  for (const road of area.roads ?? []) {
    const { start, end, vertical } = roadExtent(road, bounds);
    const across = road.width / 2 + SIDEWALK_WIDTH / 2;
    let side = 1;
    for (let along = start + PEOPLE_SPACING / 2; along < end; along += PEOPLE_SPACING) {
      side = -side;
      const x = vertical ? road.offset + side * across : along;
      const y = vertical ? along : road.offset + side * across;
      if (insideObstacle(x, y, boxes, 12)) continue;
      spots.push({ x, y });
    }
  }
  return spots.slice(0, MAX_PEOPLE);
}

/** Vendors stand at the market stalls the area declares. */
export function vendorSpots(area: NeighborhoodArea): WorldPoint[] {
  return [...(area.marketStalls ?? [])];
}

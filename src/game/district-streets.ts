import type { NeighborhoodArea, NeighborhoodObstacle } from "./neighborhood-model";
import { featureLabel } from "./district-features";

/** The street's frame, the same as the generated districts' area size. */
export const STREET_SIZE = { width: 640, height: 560 } as const;

/** Size of one feature block on the street, in street units. */
export const FEATURE_BLOCK = { width: 60, height: 40 } as const;
/** Clear ground kept between a feature block and roads, paths, objects and other blocks. */
const CLEARANCE = 10;
/** How close a visitor may stand to a shop, home or NPC point and still be clear of a block. */
const OBJECT_CLEARANCE = 36;
/** Smallest gap kept between two feature blocks' centres. */
const BLOCK_SPACING = 80;
const MARGIN = 50;
const STEP = 10;

type Box = { left: number; top: number; right: number; bottom: number };

function boxAround(x: number, y: number, width: number, height: number): Box {
  return { left: x - width / 2, top: y - height / 2, right: x + width / 2, bottom: y + height / 2 };
}

function overlaps(a: Box, b: Box) {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

function expand(box: Box, amount: number): Box {
  return {
    left: box.left - amount,
    top: box.top - amount,
    right: box.right + amount,
    bottom: box.bottom + amount,
  };
}

/** Everything a new block must keep clear of: roads, paths, objects and existing blocks. */
function blockedBoxes(area: NeighborhoodArea): Box[] {
  const boxes: Box[] = [];
  for (const road of area.roads ?? []) {
    const half = road.width / 2 + CLEARANCE;
    boxes.push(
      road.axis === "vertical"
        ? {
            left: road.offset - half,
            top: 0,
            right: road.offset + half,
            bottom: STREET_SIZE.height,
          }
        : {
            left: 0,
            top: road.offset - half,
            right: STREET_SIZE.width,
            bottom: road.offset + half,
          },
    );
  }
  for (const path of area.paths ?? []) {
    const half = path.width / 2 + CLEARANCE;
    boxes.push({
      left: Math.min(path.from.x, path.to.x) - half,
      top: Math.min(path.from.y, path.to.y) - half,
      right: Math.max(path.from.x, path.to.x) + half,
      bottom: Math.max(path.from.y, path.to.y) + half,
    });
  }
  for (const object of area.objects) {
    boxes.push(expand(boxAround(object.x, object.y, 0, 0), OBJECT_CLEARANCE));
  }
  for (const obstacle of area.obstacles ?? []) {
    boxes.push(
      expand(boxAround(obstacle.x, obstacle.y, obstacle.width, obstacle.height), CLEARANCE),
    );
  }
  return boxes;
}

function distanceToNearest(x: number, y: number, points: readonly { x: number; y: number }[]) {
  let nearest = Number.POSITIVE_INFINITY;
  for (const point of points) nearest = Math.min(nearest, Math.hypot(point.x - x, point.y - y));
  return nearest;
}

/**
 * Places one labelled block per feature on the street. Each block goes where it is clear of
 * everything else and as far as possible from the other blocks and the district's points of
 * interest. The placement is deterministic, so the client and the server build the same street.
 */
export function addFeatureBlocks(
  area: NeighborhoodArea,
  features: readonly string[],
): NeighborhoodArea {
  if (features.length === 0) return area;
  const blocked = blockedBoxes(area);
  const placed: NeighborhoodObstacle[] = [];
  const anchors = area.objects.map((object) => ({ x: object.x, y: object.y }));

  features.forEach((feature, index) => {
    // Blocks prefer some space between them; if the street is too full, they may sit closer.
    const find = (spacing: number) => {
      let best: { x: number; y: number; score: number } | null = null;
      for (let x = MARGIN; x <= STREET_SIZE.width - MARGIN; x += STEP) {
        for (let y = MARGIN; y <= STREET_SIZE.height - MARGIN; y += STEP) {
          const box = boxAround(x, y, FEATURE_BLOCK.width, FEATURE_BLOCK.height);
          if (blocked.some((other) => overlaps(box, other))) continue;
          if (placed.some((block) => Math.hypot(block.x - x, block.y - y) < spacing)) continue;
          const score = distanceToNearest(x, y, [...placed, ...anchors]);
          if (!best || score > best.score) best = { x, y, score };
        }
      }
      return best;
    };
    const best = find(BLOCK_SPACING) ?? find(0);
    if (!best) return;
    const block: NeighborhoodObstacle = {
      id: `district-feature-${index}`,
      kind: "landmark",
      label: featureLabel(feature),
      x: best.x,
      y: best.y,
      width: FEATURE_BLOCK.width,
      height: FEATURE_BLOCK.height,
    };
    placed.push(block);
    blocked.push(
      expand(boxAround(best.x, best.y, FEATURE_BLOCK.width, FEATURE_BLOCK.height), CLEARANCE),
    );
  });

  return { ...area, obstacles: [...(area.obstacles ?? []), ...placed] };
}

/** Size of one house on the street, in street units. */
export const HOUSE_BLOCK = { width: 48, height: 38 } as const;
/** Houses stand this close to a road: near enough to read as a street, clear of the kerb. */
const HOUSE_ROAD_REACH = 72;
const HOUSE_SPACING = 80;
const MAX_HOUSES = 6;

/**
 * Places residential compounds beside the roads, clear of everything else. Houses prefer the
 * spacing between each other, so a street shows several homes rather than one cluster.
 */
export function addHouseBlocks(area: NeighborhoodArea): NeighborhoodArea {
  const blocked = blockedBoxes(area);
  const roadStrips: Box[] = (area.roads ?? []).map((road) =>
    road.axis === "vertical"
      ? {
          left: road.offset - road.width / 2,
          top: 0,
          right: road.offset + road.width / 2,
          bottom: STREET_SIZE.height,
        }
      : {
          left: 0,
          top: road.offset - road.width / 2,
          right: STREET_SIZE.width,
          bottom: road.offset + road.width / 2,
        },
  );
  const beside = (box: Box, reach: number) =>
    roadStrips.some((strip) => overlaps(box, expand(strip, reach)));
  const placed: NeighborhoodObstacle[] = [];

  for (let index = 0; index < MAX_HOUSES; index += 1) {
    const find = (spacing: number, reach: number) => {
      let best: { x: number; y: number; score: number } | null = null;
      for (let x = MARGIN; x <= STREET_SIZE.width - MARGIN; x += STEP) {
        for (let y = MARGIN; y <= STREET_SIZE.height - MARGIN; y += STEP) {
          const box = boxAround(x, y, HOUSE_BLOCK.width, HOUSE_BLOCK.height);
          if (blocked.some((other) => overlaps(box, other))) continue;
          if (!beside(box, reach)) continue;
          if (placed.some((house) => Math.hypot(house.x - x, house.y - y) < spacing)) continue;
          const score = distanceToNearest(x, y, placed);
          if (!best || score > best.score) best = { x, y, score };
        }
      }
      return best;
    };
    // Preferred: spaced houses right beside a road. Crowded streets fall back to closer or wider spots.
    const best =
      find(HOUSE_SPACING, HOUSE_ROAD_REACH) ??
      find(0, HOUSE_ROAD_REACH) ??
      find(0, HOUSE_ROAD_REACH * 2);
    if (!best) break;
    placed.push({
      id: `district-house-${index}`,
      kind: "compound",
      x: best.x,
      y: best.y,
      width: HOUSE_BLOCK.width,
      height: HOUSE_BLOCK.height,
    });
    blocked.push(
      expand(boxAround(best.x, best.y, HOUSE_BLOCK.width, HOUSE_BLOCK.height), CLEARANCE),
    );
  }

  return { ...area, obstacles: [...(area.obstacles ?? []), ...placed] };
}

// Compact playable districts (300-600 m square). Every value is in metres from the district
// centre, so a scene, its colliders and its tests share one coordinate system.

export const DISTRICT_SLUGS = [
  "olaiya-junction",
  "oke-fia",
  "old-garage",
  "oja-oba",
  "ogo-oluwa",
  "abere-ring-road",
  "ota-efun-testing-ground",
  "riverside",
] as const;

export type DistrictSlug = (typeof DISTRICT_SLUGS)[number];

export const DISTRICT_MIN_SIZE_M = 300;
export const DISTRICT_MAX_SIZE_M = 600;

export interface DistrictRect {
  x: number;
  z: number;
  w: number;
  d: number;
}

export interface DistrictRoad {
  id: string;
  axis: "horizontal" | "vertical";
  /** Centre line: z for horizontal roads, x for vertical roads. */
  offsetM: number;
  widthM: number;
  kind: "arterial" | "street";
}

export interface DistrictPlace extends DistrictRect {
  id: string;
  label: string;
  kind: "landmark" | "shop" | "kiosk";
  /** Road point in front of the place, where a player stands to use it. */
  access: { x: number; z: number };
}

export interface DistrictDoor extends DistrictRect {
  id: string;
  label: string;
  /** Scene transition target: a building interior or another district. */
  to: string;
}

export interface DistrictExit {
  id: string;
  edge: "north" | "south" | "east" | "west";
  toDistrict: DistrictSlug;
  /** Position along the edge: x for north/south exits, z for east/west exits. */
  offsetM: number;
}

/** Building archetypes: a 2-3 storey corner commercial block, or a single-storey compound. */
export type LotArchetype = "corner-block" | "compound";

export interface DistrictLot extends DistrictRect {
  archetype: LotArchetype;
}

/**
 * Fenced compound yard (tree cluster inside), a row of open-front kiosks by the road, or a spare
 * patch: a market stall pitch, a parking bay strip, or a shrub bed.
 */
export interface DistrictYard extends DistrictRect {
  kind: "yard" | "kiosk-row" | "market" | "parking" | "shrub" | "grass";
}

export interface DistrictLayout {
  slug: DistrictSlug;
  name: string;
  sizeM: number;
  roads: readonly DistrictRoad[];
  places: readonly DistrictPlace[];
  doors: readonly DistrictDoor[];
  exits: readonly DistrictExit[];
  lots: readonly DistrictLot[];
  yards: readonly DistrictYard[];
  trees: readonly { x: number; z: number }[];
}

export function overlaps(a: DistrictRect, b: DistrictRect, pad = 0): boolean {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 + pad && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + pad;
}

/** A road as a rectangle covering the whole district along its axis. */
export function roadRect(road: DistrictRoad, sizeM: number): DistrictRect {
  return road.axis === "horizontal"
    ? { x: 0, z: road.offsetM, w: sizeM, d: road.widthM }
    : { x: road.offsetM, z: 0, w: road.widthM, d: sizeM };
}

export function insideDistrict(rect: DistrictRect, sizeM: number, margin = 0): boolean {
  const half = sizeM / 2 - margin;
  return Math.abs(rect.x) + rect.w / 2 <= half && Math.abs(rect.z) + rect.d / 2 <= half;
}

interface Blocker {
  rect: DistrictRect;
  pad: number;
}

function blockersFor(
  sizeM: number,
  roads: readonly DistrictRoad[],
  places: readonly DistrictPlace[],
  doors: readonly DistrictDoor[],
): Blocker[] {
  return [
    ...roads.map((road) => ({ rect: roadRect(road, sizeM), pad: 4 })),
    ...places.map((place) => ({ rect: place, pad: 4 })),
    ...doors.map((door) => ({ rect: door, pad: 4 })),
  ];
}

function yardSlot(x: number, z: number, span: number, stride: number): boolean {
  const i = Math.round((x + span) / stride);
  const j = Math.round((z + span) / stride);
  return (i + j) % 3 === 0;
}

/** Residential and corner-block lots on a grid, kept clear of roads, places and doors. */
export function fillLots(
  sizeM: number,
  roads: readonly DistrictRoad[],
  places: readonly DistrictPlace[],
  doors: readonly DistrictDoor[],
  stride = 34,
  lotW = 22,
  lotD = 16,
): DistrictLot[] {
  const lots: DistrictLot[] = [];
  const blockers = blockersFor(sizeM, roads, places, doors);
  const span = sizeM / 2 - 12;
  for (let z = -span; z <= span; z += stride) {
    for (let x = -span; x <= span; x += stride) {
      // Every third cell is left open for a fenced yard (see fillYards).
      if (yardSlot(x, z, span, stride)) continue;
      const lot = { x, z, w: lotW, d: lotD };
      if (!insideDistrict(lot, sizeM, 8)) continue;
      if (blockers.some((b) => overlaps(lot, b.rect, b.pad))) continue;
      if (lots.some((other) => overlaps(lot, other, 4))) continue;
      // Corner blocks sit within 90 m of the junction and off the road axes.
      const nearJunction = Math.abs(x) <= 90 && Math.abs(z) <= 90;
      lots.push({
        ...lot,
        archetype:
          nearJunction && Math.abs(x) >= 20 && Math.abs(z) >= 20 ? "corner-block" : "compound",
      });
    }
  }
  return lots;
}

/** Deterministic pseudo-random value in [0, 1) from a position, so layouts never change between runs. */
function positionHash(x: number, z: number): number {
  const v = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

const SPARE_KINDS = [
  { kind: "market", w: 14, d: 10 },
  { kind: "parking", w: 14, d: 7 },
  { kind: "shrub", w: 9, d: 9 },
] as const;

/**
 * Spare ground: market stall pitches, parking bays, shrub beds and planter beds placed wherever
 * no lot, yard, road or place already uses the ground. Passes run from coarse to fine, so large
 * features claim open cells first and small planters fill the narrow strips left over.
 */
export function fillSpares(
  sizeM: number,
  roads: readonly DistrictRoad[],
  places: readonly DistrictPlace[],
  doors: readonly DistrictDoor[],
  lots: readonly DistrictLot[],
  yards: readonly DistrictYard[],
  stride = 34,
): DistrictYard[] {
  const spares: DistrictYard[] = [];
  const fixed: Blocker[] = blockersFor(sizeM, roads, places, doors);
  const buildings: DistrictRect[] = [...lots, ...yards];
  // `tight` scales the clearance kept from lots and yards; roads, places and doors keep full pads.
  const fits = (rect: DistrictRect, tight: number) =>
    insideDistrict(rect, sizeM, 1) &&
    fixed.every((b) => !overlaps(rect, b.rect, b.pad)) &&
    buildings.every((b) => !overlaps(rect, b, 1 * tight)) &&
    spares.every((other) => !overlaps(rect, other, 0.5 * tight));
  const span = sizeM / 2 - 4;
  // `density` keeps only that share of candidate cells, chosen by a position hash, so beds never
  // form a perfectly regular grid and some strips stay open as pedestrian paths.
  type Pass = [
    number,
    number,
    number,
    readonly { kind: DistrictYard["kind"]; w: number; d: number }[],
  ];
  const passes: Pass[] = [
    [stride, 1, 1, SPARE_KINDS],
    // Second pass: small shrub beds on a finer grid to use the gaps the first pass leaves.
    [stride / 2, 1, 1, [{ kind: "shrub", w: 7, d: 7 }]],
    // Third pass: irregular grass patches for the narrow strips beside yards and walls. About
    // half the candidate cells take one, so sandy yards stay open as intended.
    [4, 0.5, 0.75, [{ kind: "grass", w: 4, d: 4 }]],
  ];
  for (const [step, tight, density, kinds] of passes) {
    for (let z = -span; z <= span; z += step) {
      for (let x = -span; x <= span; x += step) {
        const i = Math.round((x + span) / step);
        const j = Math.round((z + span) / step);
        if (positionHash(x, z) >= density) continue;
        // Start from a different kind in each cell so neighbouring spares vary.
        for (let k = 0; k < kinds.length; k += 1) {
          const spec = kinds[(i + j + k) % kinds.length]!;
          const rect = { x, z, w: spec.w, d: spec.d };
          if (fits(rect, tight)) {
            spares.push({ ...rect, kind: spec.kind });
            break;
          }
        }
      }
    }
  }
  return spares;
}

/** Fenced yards (room for a tree cluster) and kiosk rows, filling the gaps between lots. */
export function fillYards(
  sizeM: number,
  roads: readonly DistrictRoad[],
  places: readonly DistrictPlace[],
  doors: readonly DistrictDoor[],
  lots: readonly DistrictLot[],
): DistrictYard[] {
  const yards: DistrictYard[] = [];
  const blockers: Blocker[] = [
    ...blockersFor(sizeM, roads, places, doors),
    ...lots.map((lot) => ({ rect: lot, pad: 3 })),
  ];
  // Kiosk rows sit in the strip between a road and its lots, so they use tighter clearances.
  const free = (rect: DistrictRect, tight: boolean) =>
    insideDistrict(rect, sizeM, 8) &&
    blockers.every((b) => !overlaps(rect, b.rect, tight ? Math.min(b.pad, 0.5) : b.pad)) &&
    roads.every((road) => !overlaps(rect, roadRect(road, sizeM), tight ? 0.5 : 3)) &&
    yards.every((other) => !overlaps(rect, other, 3));
  const span = sizeM / 2 - 12;
  const stride = 34;
  for (let z = -span; z <= span; z += stride) {
    for (let x = -span; x <= span; x += stride) {
      if (!yardSlot(x, z, span, stride)) continue;
      const yard = { x, z, w: 20, d: 14 };
      if (free(yard, false)) yards.push({ ...yard, kind: "yard" });
    }
  }
  // Kiosk rows: short open-front strips set just off each road edge.
  for (const road of roads) {
    for (const sign of [-1, 1]) {
      const edge = road.offsetM + sign * (road.widthM / 2 + 2.5);
      for (let s = -span; s <= span; s += 30) {
        const row =
          road.axis === "horizontal"
            ? { x: s, z: edge, w: 14, d: 3 }
            : { x: edge, z: s, w: 3, d: 14 };
        if (free(row, true)) yards.push({ ...row, kind: "kiosk-row" });
      }
    }
  }
  return yards;
}

/** Trees: two inside each fenced yard (a cluster), plus a loose grid of free-standing trees. */
export function scatterTrees(
  sizeM: number,
  roads: readonly DistrictRoad[],
  rects: readonly DistrictRect[],
  yards: readonly DistrictYard[] = [],
  stride = 19,
  limit = 40,
): { x: number; z: number }[] {
  const trees: { x: number; z: number }[] = [];
  for (const yard of yards) {
    if (yard.kind !== "yard") continue;
    trees.push(
      { x: yard.x - yard.w / 4, z: yard.z - yard.d / 4 },
      { x: yard.x + yard.w / 4, z: yard.z + yard.d / 4 },
    );
  }
  const span = sizeM / 2 - 6;
  for (let z = -span; z <= span && trees.length < limit + yards.length * 2; z += stride) {
    for (let x0 = -span; x0 <= span && trees.length < limit + yards.length * 2; x0 += stride) {
      // Thin and jitter the grid so trees do not stand in perfect rows.
      if (positionHash(x0, z) < 0.4) continue;
      const x = x0 + (positionHash(z, x0) - 0.5) * stride * 0.6;
      const tree = { x, z: z + (positionHash(x0 + 7, z) - 0.5) * stride * 0.6, w: 2, d: 2 };
      if (roads.some((road) => overlaps(tree, roadRect(road, sizeM), 3))) continue;
      if (rects.some((rect) => overlaps(tree, rect, 2))) continue;
      if (trees.some((t) => Math.abs(t.x - tree.x) < 4 && Math.abs(t.z - tree.z) < 4)) continue;
      trees.push({ x: tree.x, z: tree.z });
    }
  }
  return trees;
}

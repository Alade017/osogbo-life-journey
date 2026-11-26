import type { DistrictLayout, DistrictRect } from "@/game/districts/district-layout";

// Pure builders: turn layout rectangles into lists of coloured primitive parts. The scene renders
// each primitive kind with one InstancedMesh (see district-kit.tsx), so the draw-call count stays
// flat no matter how many houses, buses or umbrellas a district has.

export type GeoKind = "box" | "cylinder" | "cone" | "sphere" | "gable" | "hip";
export type Vec3 = [number, number, number];

export interface Part {
  kind: GeoKind;
  position: Vec3;
  /** Size in metres, applied in the part's own frame before rotation. */
  scale: Vec3;
  color: string;
  /** Rotation about Y, in radians. */
  yaw?: number;
  /** Rotation about X (applied before yaw), used to lay wheels on their side. */
  pitch?: number;
}

export const WALL_TONES = [
  "#efe2c4", // cream
  "#d9a441", // warm ochre
  "#9bb88a", // muted green
  "#c8714a", // terracotta
  "#e6d3a3", // sand
  "#e0b8a0", // blush
  "#f3ead6", // warm white
  "#d8d4c8", // light grey
  "#c9b48a", // soft brown
  "#f2d6c9", // pastel peach
] as const;
export const ROOF_TONES = [
  "#b86b45", // clay
  "#8c949a", // grey tin
  "#6b4a36", // soft brown
  "#a65a3a", // terracotta
  "#7a4a32", // dark brown
  "#5d6b73", // slate
] as const;
/** Business names for shopfronts, in the style of Nigerian street shops. Fictional. */
export const SHOP_NAMES = [
  "MAMA SIKIRA PROVISIONS",
  "DELE CUTZ BARBING SALON",
  "FASTCASH AIRTIME & POS",
  "IYA ADIRE STYLES",
  "OLAIYA PHARMACY",
  "SWEET MAMA BUKA",
  "CHINEDU ELECTRONICS",
  "ADE TAILORING HOUSE",
  "LAWAL TYRE WORKS",
  "OLAIYA STORES & MART",
  "GOD IS GOOD PHONE CENTRE",
  "PRAISE FOOD JOINT",
] as const;
export const AWNING_TONES = ["#c94b36", "#e3b542", "#43845c", "#1f5f9a", "#f7f1df"] as const;
export const UMBRELLA_TONES = ["#c94b36", "#1f5f9a", "#e3b542", "#f7f1df"] as const;
export const CRATE_TONES = ["#b8854a", "#d9a441", "#43845c"] as const;
export const FOLIAGE_TONES = ["#3f7d45", "#5f9a4f", "#2f6b3d", "#7a9a3c", "#4d8a5a"] as const;
export const FLOWER_TONES = ["#d8456a", "#f2c230", "#e07ab0", "#f7f1df"] as const;
const SOIL = "#5c4330";
const TAIL_LIGHT = "#c62828";
export const DANFO_YELLOW = "#f2c230";
const GLASS = "#2e4c5c";
const TRIM = "#f4efe2";
const TIMBER = "#6b4a36";
const CONCRETE = "#b9ad96";
const FLAT_ROOF = "#d9d2c0";
const STORE_FLOOR = "#c6b08a";
const ASPHALT = "#5b5f63";
const LINE = "#f7f1df";
const TYRE = "#202020";

const box = (position: Vec3, scale: Vec3, color: string): Part => ({
  kind: "box",
  position,
  scale,
  color,
});

const PLASTER = "#d8c7a0";
const GRASS_TONES = ["#7fa352", "#6b9a4a", "#8fb05c"] as const;
const PAVING = "#cfc6b4";
const WATER_TANK = "#4a7fa8";
const AC_WHITE = "#f4f4f0";
const WALL_HEIGHT = 1.8;
const WALL_T = 0.3;
const GATE_W = 3;
const STEEL = "#9aa3ad";
const GLASS_LIGHT = "#9fc2cc";
const GUTTER = "#4a4740";
const KEKE_TONES = ["#e3b542", "#43845c"] as const;
const CAR_TONES = ["#c94b36", "#f7f1df", "#276b9a", "#43845c"] as const;

/** Deterministic pseudo-random value in [0, 1) from an integer seed. */
function unitHash(n: number): number {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * A compound's perimeter wall with a gate gap centred on the front (+z) side, and gate posts.
 * The building sits inside, leaving a yard between the wall and its walls.
 */
function compoundWall(x: number, z: number, w: number, d: number): Part[] {
  const hw = w / 2;
  const hd = d / 2;
  const y = WALL_HEIGHT / 2;
  const seg = (w - GATE_W) / 2;
  return [
    box([x, y, z - hd], [w, WALL_HEIGHT, WALL_T], PLASTER),
    box([x - hw, y, z], [WALL_T, WALL_HEIGHT, d], PLASTER),
    box([x + hw, y, z], [WALL_T, WALL_HEIGHT, d], PLASTER),
    box([x - (GATE_W / 2 + seg / 2), y, z + hd], [seg, WALL_HEIGHT, WALL_T], PLASTER),
    box([x + (GATE_W / 2 + seg / 2), y, z + hd], [seg, WALL_HEIGHT, WALL_T], PLASTER),
    box([x - GATE_W / 2 - 0.4, 1.3, z + hd], [0.9, 2.6, 0.9], PLASTER),
    box([x + GATE_W / 2 + 0.4, 1.3, z + hd], [0.9, 2.6, 0.9], PLASTER),
    box([x - GATE_W / 2 - 0.4, 2.7, z + hd], [0.5, 0.2, 0.5], TRIM),
    box([x + GATE_W / 2 + 0.4, 2.7, z + hd], [0.5, 0.2, 0.5], TRIM),
    box([x - GATE_W / 2 - 0.4, 2.45, z + hd + 0.5], [0.2, 0.2, 0.2], "#fff6d5"),
    box([x + GATE_W / 2 + 0.4, 2.45, z + hd + 0.5], [0.2, 0.2, 0.2], "#fff6d5"),
  ];
}

/**
 * Grass and flowers, built as real plant shapes: clumps of blade-like cones rising from the
 * ground, and flowers on thin stems with a pair of leaves. No flat discs or beads.
 */
export function grassParts(rect: DistrictRect, index: number): Part[] {
  const { x, z, w, d } = rect;
  const parts: Part[] = [];
  const tufts = 5 + Math.floor(unitHash(index) * 4);
  for (let k = 0; k < tufts; k += 1) {
    const seed = index * 31 + k * 5;
    const tx = x + (unitHash(seed) - 0.5) * w * 0.8;
    const tz = z + (unitHash(seed + 1) - 0.5) * d * 0.8;
    const tone = GRASS_TONES[(index + k) % GRASS_TONES.length] ?? GRASS_TONES[0];
    const height = 0.6 + unitHash(seed + 2) * 0.6;
    parts.push({
      kind: "cone",
      position: [tx, height / 2, tz],
      scale: [0.3, height, 0.3],
      color: tone,
    });
  }
  if (index % 2 === 0) {
    const stems = 2 + (index % 2);
    for (let k = 0; k < stems; k += 1) {
      const seed = index * 17 + k * 9;
      const fx = x + (unitHash(seed) - 0.5) * w * 0.7;
      const fz = z + (unitHash(seed + 3) - 0.5) * d * 0.7;
      const stemH = 0.55;
      parts.push({
        kind: "cylinder",
        position: [fx, stemH / 2, fz],
        scale: [0.03, stemH, 0.03],
        color: "#3f7d45",
      });
      parts.push({
        kind: "sphere",
        position: [fx + 0.15, stemH * 0.55, fz],
        scale: [0.22, 0.1, 0.12],
        color: "#3f7d45",
      });
      parts.push({
        kind: "cone",
        position: [fx, stemH + 0.08, fz],
        scale: [0.22, 0.14, 0.22],
        color: FLOWER_TONES[(index + k) % FLOWER_TONES.length] ?? FLOWER_TONES[0],
      });
    }
  }
  return parts;
}

/**
 * A residential compound. Four layouts rotate by index so neighbours differ:
 *  0 small: open sandy yard with no wall.
 *  1 medium: perimeter wall, driveway, air-conditioning units.
 *  2 large: perimeter wall, paved courtyard at the front, a lawn at the back.
 *  3 family: perimeter wall, outdoor seating, a water tank and air-conditioning units.
 */
export function compoundParts(rect: DistrictRect, index: number): Part[] {
  const { x, z, w, d } = rect;
  const variant = index % 4;
  const duplex = index % 5 === 4;
  const h = 5.5 + (index % 3) * 1.5;
  const wall = WALL_TONES[(index + 1) % WALL_TONES.length] ?? WALL_TONES[0];
  // The house sits inside the lot, set back from the front wall.
  const bw = w - 5;
  const bd = d - 6;
  const bz = z - 0.5;
  const frontZ = bz + bd / 2;
  const backZ = bz - bd / 2;
  const lotFront = z + d / 2;
  const parts: Part[] = [];

  // Variant 0 is an open sandy yard with no wall.
  if (variant !== 0) {
    parts.push(...compoundWall(x, z, w, d));
    // Gate canopy over the opening.
    parts.push(box([x, 2.9, lotFront - 0.2], [GATE_W + 1.4, 0.14, 1.4], CONCRETE));
  }
  if (variant === 1) {
    parts.push(box([x, 0.05, lotFront - 2.2], [GATE_W, 0.06, 4.4], CONCRETE));
  }
  if (variant === 2) {
    parts.push(box([x, 0.05, lotFront - 2.2], [w - 2, 0.06, 4], PAVING));
    parts.push(...grassParts({ x, z: z - d / 2 + 2.5, w: w - 6, d: 3 }, index));
  }
  if (variant === 3) {
    parts.push(box([x - 4.5, 0.5, lotFront - 2.5], [2.2, 0.5, 0.6], TIMBER));
    parts.push(box([x + 3.5, 0.5, lotFront - 2.5], [0.6, 0.5, 0.6], TIMBER));
    parts.push({
      kind: "cylinder",
      position: [x + 6, 1.2, backZ - 2],
      scale: [1.4, 2.4, 1.4],
      color: WATER_TANK,
    });
  }

  parts.push(box([x, 0.35, bz], [bw + 0.3, 0.7, bd + 0.3], CONCRETE));
  parts.push(box([x, h / 2, bz], [bw, h, bd], wall));
  if (duplex) {
    // A shared party wall splits the house into two units with two doors.
    parts.push(box([x, h / 2, bz], [0.3, h + 0.1, bd + 0.2], CONCRETE));
  }

  // Roof shape rotates by index: pitched gable, flat parapet with a water tank, hip, or gable.
  const roofShape = index % 4;
  const roofColour = ROOF_TONES[index % ROOF_TONES.length] ?? ROOF_TONES[0];
  if (roofShape === 1) {
    parts.push(box([x, h + 0.25, bz], [bw + 0.6, 0.5, bd + 0.6], FLAT_ROOF));
    for (const [px, pz, sx, sz] of [
      [0, bd / 2 + 0.3, bw + 0.6, 0.3],
      [0, -bd / 2 - 0.3, bw + 0.6, 0.3],
      [bw / 2 + 0.3, 0, 0.3, bd + 0.6],
      [-bw / 2 - 0.3, 0, 0.3, bd + 0.6],
    ] as const) {
      parts.push(box([x + px, h + 0.75, bz + pz], [sx, 0.6, sz], FLAT_ROOF));
    }
    parts.push({
      kind: "cylinder",
      position: [x + bw / 3, h + 1.6, bz],
      scale: [0.8, 1.2, 0.8],
      color: WATER_TANK,
    });
  } else if (roofShape === 2) {
    parts.push({
      kind: "hip",
      position: [x, h, bz],
      scale: [bw + 1.0, 2.6, bd + 1.0],
      color: roofColour,
    });
  } else {
    parts.push({
      kind: "gable",
      position: [x, h, bz],
      scale: [bw + 1.2, 2.6, bd + 1.2],
      color: roofColour,
    });
  }

  for (const sx of [-bw / 3, bw / 3]) {
    parts.push(box([x + sx, h * 0.6, frontZ + 0.04], [2.0, 1.6, 0.1], GLASS));
    parts.push(box([x + sx, h * 0.6, backZ - 0.04], [2.0, 1.6, 0.1], GLASS));
  }
  // Doors: one centred, or two for a duplex.
  const doorXs = duplex ? [-bw / 4, bw / 4] : [0];
  for (const dx of doorXs) {
    parts.push(box([x + dx, 1.3, frontZ + 0.05], [1.6, 2.6, 0.12], TIMBER));
  }
  if (variant === 3) {
    // A deep porch canopy over the whole front of the house.
    parts.push(
      box(
        [x, 2.9, frontZ + 1.5],
        [bw * 0.8, 0.14, 3.0],
        AWNING_TONES[index % AWNING_TONES.length] ?? AWNING_TONES[0],
      ),
    );
  } else {
    parts.push(
      box(
        [x, 2.9, frontZ + 0.8],
        [2.6, 0.12, 1.6],
        AWNING_TONES[index % AWNING_TONES.length] ?? AWNING_TONES[0],
      ),
    );
  }
  for (const side of [-1, 1]) {
    parts.push(box([x + side * (bw / 2 + 0.04), h * 0.6, bz], [0.1, 1.6, 2.0], GLASS));
  }
  if (variant === 1 || variant === 3 || duplex) {
    // Air-conditioning units on the back wall.
    for (const sx of [-bw / 3, bw / 3]) {
      parts.push(box([x + sx, 3.2, backZ - 0.35], [1.0, 0.7, 0.6], AC_WHITE));
    }
  }
  return parts;
}

/**
 * A 2-4 storey commercial block: ground-floor shopfronts with striped awnings and a signboard,
 * upper windows, and balconies on alternate blocks. Used for corner blocks and shop places.
 */
export function shopParts(rect: DistrictRect, index: number): Part[] {
  const { x, z, w, d } = rect;
  const storeys = 2 + (index % 3);
  const h = storeys * 3.2 + 0.4;
  const wall = WALL_TONES[(index + 2) % WALL_TONES.length] ?? WALL_TONES[0];
  const frontZ = z + d / 2;
  const backZ = z - d / 2;
  const bayW = w / 3;
  const parts: Part[] = [
    box([x, 0.35, z], [w + 0.3, 0.7, d + 0.3], CONCRETE),
    box([x, h / 2, z], [w, h, d], wall),
    box([x, h + 0.25, z], [w + 0.6, 0.5, d + 0.6], FLAT_ROOF),
    // Signboard band across the front, between the ground and first floors.
    box(
      [x, 3.5, frontZ + 0.06],
      [w - 1.6, 0.7, 0.12],
      AWNING_TONES[(index + 1) % AWNING_TONES.length] ?? AWNING_TONES[0],
    ),
  ];
  for (let b = -1; b <= 1; b += 1) {
    const bx = x + b * bayW;
    const awning = AWNING_TONES[(index + b + 1) % AWNING_TONES.length] ?? AWNING_TONES[0];
    parts.push(box([bx, 2.8, frontZ + 0.7], [bayW - 0.6, 0.12, 1.4], awning));
    parts.push(box([bx, 1.3, frontZ + 0.04], [bayW - 1.2, 2.0, 0.1], GLASS));
  }
  // Street furniture: a waste bin by the door and a bench under the shopfront.
  parts.push(box([x + w / 2 - 1.2, 0.5, frontZ + 1.2], [0.9, 1.0, 0.9], "#2e6b3d"));
  parts.push(box([x - w / 4, 0.4, frontZ + 1.6], [2.0, 0.4, 0.6], TIMBER));
  for (let f = 1; f < storeys; f += 1) {
    const y = f * 3.2 + 1.6;
    for (let b = -1; b <= 1; b += 1) {
      parts.push(box([x + b * bayW, y, frontZ + 0.04], [bayW - 1.4, 1.4, 0.1], GLASS));
      parts.push(box([x + b * bayW, y, backZ - 0.04], [bayW - 1.4, 1.4, 0.1], GLASS));
    }
    if (index % 2 === 0) {
      parts.push(box([x, f * 3.2 + 0.9, frontZ + 0.35], [w - 1.0, 0.08, 0.7], TRIM));
    }
  }
  return parts;
}

/** A grouped market pitch: a raised table, crates, and six umbrellas over the stall. */
export function marketParts(rect: DistrictRect, index: number): Part[] {
  const { x, z, w, d } = rect;
  const parts: Part[] = [
    box([x, 0.06, z], [w, 0.12, d], STORE_FLOOR),
    box([x, 0.4, z], [w - 2.5, 0.8, 2.0], TIMBER),
  ];
  // Vendor seating and a waste bin at the edge of the pitch.
  parts.push(box([x, 0.45, z + d / 2 + 1], [2.2, 0.45, 0.6], TIMBER));
  parts.push(box([x + w / 2 - 0.8, 0.5, z - d / 2 - 0.5], [0.9, 1.0, 0.9], "#2e6b3d"));
  for (let c = -1; c <= 1; c += 1) {
    parts.push(
      box(
        [x + c * 1.3, 1.1, z + 0.2],
        [1.1, 0.6, 1.0],
        CRATE_TONES[(index + c + 1) % CRATE_TONES.length] ?? CRATE_TONES[0],
      ),
    );
  }
  let u = 0;
  for (const bx of [-w / 3, 0, w / 3]) {
    for (const bz of [-d / 3, d / 3]) {
      const ux = x + bx;
      const uz = z + bz;
      parts.push({
        kind: "cylinder",
        position: [ux, 1.5, uz],
        scale: [0.08, 3, 0.08],
        color: TIMBER,
      });
      parts.push({
        kind: "cone",
        position: [ux, 2.9, uz],
        scale: [1.8, 0.9, 1.8],
        color: UMBRELLA_TONES[(index + u) % UMBRELLA_TONES.length] ?? UMBRELLA_TONES[0],
      });
      u += 1;
    }
  }
  return parts;
}

/** A parking strip: asphalt, white bay lines, and a parked minibus on every other strip. */
export function parkingParts(rect: DistrictRect, index: number): Part[] {
  const { x, z, w, d } = rect;
  const parts: Part[] = [box([x, 0.05, z], [w, 0.1, d], ASPHALT)];
  for (const k of [-1, 0, 1]) {
    parts.push(box([x + k * (w / 4), 0.12, z], [0.15, 0.02, d - 1], LINE));
  }
  // Alternate strips hold a parked danfo minibus or a pair of private cars.
  if (index % 2 === 0) {
    parts.push(...busParts(x, z, 0));
  } else {
    parts.push(...carParts(x - 3.2, z, 0, "#c94b36"));
    parts.push(...carParts(x + 3.2, z, 0, "#f7f1df"));
  }
  return parts;
}

/** A small private saloon car in code: body, cabin with glass, four wheels and lights. */
export function carParts(cx: number, cz: number, yaw: number, body: string): Part[] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const at = (lx: number, ly: number, lz: number): Vec3 => [
    cx + lx * cos + lz * sin,
    ly,
    cz - lx * sin + lz * cos,
  ];
  const part = (
    kind: GeoKind,
    lx: number,
    ly: number,
    lz: number,
    scale: Vec3,
    color: string,
    pitch = 0,
  ): Part => ({ kind, position: at(lx, ly, lz), scale, color, yaw, pitch });
  return [
    part("box", 0, 0.75, 0, [3.9, 0.7, 1.7], body),
    part("box", -0.2, 1.3, 0, [2.2, 0.6, 1.5], body),
    part("box", -0.2, 1.3, 0, [2.0, 0.5, 1.56], GLASS),
    part("cylinder", 1.3, 0.36, 0.75, [0.36, 0.2, 0.36], TYRE, Math.PI / 2),
    part("cylinder", 1.3, 0.36, -0.75, [0.36, 0.2, 0.36], TYRE, Math.PI / 2),
    part("cylinder", -1.3, 0.36, 0.75, [0.36, 0.2, 0.36], TYRE, Math.PI / 2),
    part("cylinder", -1.3, 0.36, -0.75, [0.36, 0.2, 0.36], TYRE, Math.PI / 2),
    part("box", 1.96, 0.7, 0.5, [0.05, 0.16, 0.3], "#fff6d5"),
    part("box", 1.96, 0.7, -0.5, [0.05, 0.16, 0.3], "#fff6d5"),
  ];
}

/** A shrub bed: four rounded bushes of mixed greens. */
export function shrubParts(rect: DistrictRect, index: number): Part[] {
  const { x, z } = rect;
  const parts: Part[] = [];
  const offsets: [number, number][] = [
    [-2, -2],
    [2, -2],
    [-2, 2],
    [2, 2],
  ];
  offsets.forEach(([dx, dz], k) => {
    const r = 1.2 + ((index + k) % 3) * 0.3;
    parts.push({
      kind: "sphere",
      position: [x + dx, r * 0.8, z + dz],
      scale: [r * 2, r * 1.6, r * 2],
      color: FOLIAGE_TONES[(index + k) % FOLIAGE_TONES.length] ?? FOLIAGE_TONES[0],
    });
  });
  return parts;
}

/**
 * A Korope/danfo-style yellow minibus built from parts: a rounded-looking body with a roof cap,
 * dark windscreen and side windows, a green stripe, headlights and four wheels. Local +x is the
 * front; `yaw` turns the bus to match its road.
 */
export function busParts(bx: number, bz: number, yaw: number, body = DANFO_YELLOW): Part[] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const at = (lx: number, ly: number, lz: number): Vec3 => [
    bx + lx * cos + lz * sin,
    ly,
    bz - lx * sin + lz * cos,
  ];
  const part = (
    kind: GeoKind,
    lx: number,
    ly: number,
    lz: number,
    scale: Vec3,
    color: string,
    pitch = 0,
  ): Part => ({ kind, position: at(lx, ly, lz), scale, color, yaw, pitch });

  return [
    part("box", 0, 1.2, 0, [4.6, 1.4, 1.9], body),
    part("box", 0, 2.0, 0, [4.3, 0.25, 1.8], TRIM),
    part("box", 2.33, 1.45, 0, [0.08, 0.9, 1.6], GLASS),
    part("box", 2.36, 0.95, 0.6, [0.05, 0.2, 0.35], "#fff6d5"),
    part("box", 2.36, 0.95, -0.6, [0.05, 0.2, 0.35], "#fff6d5"),
    part("box", -2.32, 0.95, 0.6, [0.05, 0.2, 0.35], TAIL_LIGHT),
    part("box", -2.32, 0.95, -0.6, [0.05, 0.2, 0.35], TAIL_LIGHT),
    part("box", -0.2, 1.45, 0.96, [3.2, 0.6, 0.04], GLASS),
    part("box", -0.2, 1.45, -0.96, [3.2, 0.6, 0.04], GLASS),
    part("box", 0, 0.9, 0.97, [4.5, 0.14, 0.03], "#43845c"),
    part("box", 0, 0.9, -0.97, [4.5, 0.14, 0.03], "#43845c"),
    part("cylinder", 1.5, 0.42, 1.0, [0.42, 0.22, 0.42], TYRE, Math.PI / 2),
    part("cylinder", 1.5, 0.42, -1.0, [0.42, 0.22, 0.42], TYRE, Math.PI / 2),
    part("cylinder", -1.5, 0.42, 1.0, [0.42, 0.22, 0.42], TYRE, Math.PI / 2),
    part("cylinder", -1.5, 0.42, -1.0, [0.42, 0.22, 0.42], TYRE, Math.PI / 2),
  ];
}

/**
 * Trees share one low-poly style: a trunk with a rounded canopy. Height, canopy size and the
 * canopy's proportions vary per tree from its position, so no two look identical.
 */
export function treeParts(trees: readonly { x: number; z: number }[]): Part[] {
  const parts: Part[] = [];
  trees.forEach((t, i) => {
    const seed = unitHash(Math.round(t.x * 10) * 1000 + Math.round(t.z * 10));
    const green = FOLIAGE_TONES[Math.floor(seed * FOLIAGE_TONES.length)] ?? FOLIAGE_TONES[0];
    const radius = 1.5 + seed * 0.9;
    const trunk = 1.8 + seed * 1.4;
    parts.push({
      kind: "cylinder",
      position: [t.x, trunk / 2, t.z],
      scale: [0.3, trunk, 0.3],
      color: TIMBER,
    });
    parts.push({
      kind: "sphere",
      position: [t.x, trunk + radius * 0.7, t.z],
      scale: [radius * 2, radius * (i % 3 === 0 ? 2.1 : 1.7), radius * 2],
      color: green,
    });
  });
  return parts;
}

/** A bus-stop shelter on a sidewalk: two posts, a roof, a back panel and a bench. */
export function shelterParts(cx: number, cz: number, alongX: boolean): Part[] {
  const len = 2.6;
  const dep = 1.4;
  const sx = alongX ? len : dep;
  const sz = alongX ? dep : len;
  return [
    box([cx - sx / 2 + 0.1, 1.2, cz - sz / 2 + 0.1], [0.1, 2.4, 0.1], STEEL),
    box([cx + sx / 2 - 0.1, 1.2, cz - sz / 2 + 0.1], [0.1, 2.4, 0.1], STEEL),
    box([cx, 2.5, cz], [sx + 0.2, 0.12, sz + 0.2], "#1f5f9a"),
    box([cx, 1.2, cz - sz / 2 + 0.05], [sx - 0.2, 2.2, 0.05], GLASS_LIGHT),
    box([cx, 0.45, cz], [sx - 0.6, 0.45, 0.5], TIMBER),
  ];
}

/** Local-frame helper: positions parts relative to a centre, rotated by yaw about Y. */
function localFrame(cx: number, cz: number, yaw: number) {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return (lx: number, ly: number, lz: number): Vec3 => [
    cx + lx * cos + lz * sin,
    ly,
    cz - lx * sin + lz * cos,
  ];
}

/** A Keke Napep three-wheeler: a body, a canopy and three wheels, built in code. */
export function kekeParts(cx: number, cz: number, yaw: number, body: string): Part[] {
  const at = localFrame(cx, cz, yaw);
  const part = (
    kind: GeoKind,
    lx: number,
    ly: number,
    lz: number,
    scale: Vec3,
    color: string,
    pitch = 0,
  ): Part => ({
    kind,
    position: at(lx, ly, lz),
    scale,
    color,
    yaw,
    pitch,
  });
  return [
    part("box", 0, 0.7, 0, [1.9, 0.6, 1.3], body),
    part("box", -0.3, 1.5, 0, [1.4, 0.1, 1.5], TRIM),
    part("box", -0.3, 1.1, 0.7, [1.4, 0.8, 0.05], TRIM),
    part("cylinder", 0.9, 0.3, 0, [0.3, 0.14, 0.3], TYRE, Math.PI / 2),
    part("cylinder", -0.7, 0.3, 0.6, [0.3, 0.14, 0.3], TYRE, Math.PI / 2),
    part("cylinder", -0.7, 0.3, -0.6, [0.3, 0.14, 0.3], TYRE, Math.PI / 2),
  ];
}

/** A waste bin on a sidewalk. */
export function binParts(x: number, z: number): Part[] {
  return [box([x, 0.5, z], [0.9, 1.0, 0.9], "#2e6b3d")];
}

/**
 * Road furniture for the whole district: gutters, parked cars on the kerb, keke tricycles, bus
 * shelters, kerbside bins and zebra crossings at every junction.
 */
export function streetParts(layout: DistrictLayout): Part[] {
  const parts: Part[] = [];
  const size = layout.sizeM;
  layout.roads.forEach((road, roadIndex) => {
    const along = road.axis === "horizontal";
    const half = road.widthM / 2;
    for (const sign of [-1, 1]) {
      const edge = road.offsetM + sign * half;
      const inside = edge - sign * 0.25; // gutter sits inside the carriageway edge
      parts.push(
        along
          ? box([0, 0.065, inside], [size, 0.04, 0.5], GUTTER)
          : box([inside, 0.065, 0], [0.5, 0.04, size], GUTTER),
      );
      const kerbOffset = edge - sign * 1.2; // kerb lane, inside the road edge
      if (road.kind === "street") {
        // Two parked private cars and a keke tricycle along each side of a residential street.
        [-90, 40].forEach((s, k) => {
          const colour =
            CAR_TONES[(roadIndex * 2 + k + (sign > 0 ? 1 : 0)) % CAR_TONES.length] ?? CAR_TONES[0];
          const cx = along ? s : kerbOffset;
          const cz = along ? kerbOffset : s;
          parts.push(...carParts(cx, cz, along ? 0 : Math.PI / 2, colour));
        });
        const kekeS = -20 + roadIndex * 13;
        const kcx = along ? kekeS : kerbOffset;
        const kcz = along ? kerbOffset : kekeS;
        parts.push(
          ...kekeParts(
            kcx,
            kcz,
            along ? 0 : Math.PI / 2,
            KEKE_TONES[(roadIndex + (sign > 0 ? 1 : 0)) % KEKE_TONES.length] ?? KEKE_TONES[0],
          ),
        );
        // Kerbside bins on the sidewalk.
        const binS = 60 - roadIndex * 17;
        const bx = along ? binS : edge + sign * 2.0;
        const bz = along ? edge + sign * 2.0 : binS;
        parts.push(...binParts(bx, bz));
      } else {
        // Arterials: a bus shelter on the sidewalk, on the north or east side.
        if (sign > 0) {
          for (const s of [-60, 90]) {
            const cx = along ? s : edge + sign * 1.5;
            const cz = along ? edge + sign * 1.5 : s;
            parts.push(...shelterParts(cx, cz, along));
          }
        }
      }
    }
  });

  // Zebra crossings across each arm of every junction, where a vertical and a horizontal road meet.
  const verticals = layout.roads.filter((r) => r.axis === "vertical");
  const horizontals = layout.roads.filter((r) => r.axis === "horizontal");
  for (const v of verticals) {
    for (const h of horizontals) {
      for (const sign of [-1, 1]) {
        // Across the vertical road, on its north/south arm, outside the horizontal road.
        const zArm = h.offsetM + sign * (h.widthM / 2 + 2.5);
        const stripes = Math.floor(v.widthM / 1.8);
        for (let k = 0; k < stripes; k += 1) {
          const x = v.offsetM - v.widthM / 2 + 0.9 + k * 1.8;
          parts.push(box([x, 0.08, zArm], [0.9, 0.05, 2.4], LINE));
        }
        // Across the horizontal road, on its east/west arm, outside the vertical road.
        const xArm = v.offsetM + sign * (v.widthM / 2 + 2.5);
        const bars = Math.floor(h.widthM / 1.8);
        for (let k = 0; k < bars; k += 1) {
          const z = h.offsetM - h.widthM / 2 + 0.9 + k * 1.8;
          parts.push(box([xArm, 0.08, z], [2.4, 0.05, 0.9], LINE));
        }
      }
    }
  }
  return parts;
}

/** Shop signs: one text sign per shopfront, sitting on the signboard band of each shop. */
export interface ShopSign {
  name: string;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
}

export function shopSigns(layout: DistrictLayout): ShopSign[] {
  const signs: ShopSign[] = [];
  const corners = layout.lots.filter((lot) => lot.archetype === "corner-block");
  const shops = [...corners, ...layout.places.filter((place) => place.kind !== "kiosk")];
  shops.forEach((rect, i) => {
    signs.push({
      name: SHOP_NAMES[i % SHOP_NAMES.length] ?? SHOP_NAMES[0],
      x: rect.x,
      y: 3.5,
      z: rect.z + rect.d / 2 + 0.13,
      w: rect.w - 1.6,
      h: 0.7,
    });
  });
  return signs;
}

export interface DistrictParts {
  buildings: Part[];
  vehicles: Part[];
  spares: Part[];
  trees: Part[];
  street: Part[];
  signs: ShopSign[];
}

/** Every built part of one district, grouped by how it is rendered. */
export function districtParts(layout: DistrictLayout): DistrictParts {
  const buildings: Part[] = [];
  const corners = layout.lots.filter((lot) => lot.archetype === "corner-block");
  const compounds = layout.lots.filter((lot) => lot.archetype === "compound");
  compounds.forEach((lot, i) => buildings.push(...compoundParts(lot, i)));
  corners.forEach((lot, i) => buildings.push(...shopParts(lot, i)));
  layout.places
    .filter((place) => place.kind !== "kiosk")
    .forEach((place, i) => buildings.push(...shopParts(place, i + corners.length)));

  const vehicles: Part[] = [];
  for (const road of layout.roads) {
    if (road.kind !== "arterial") continue;
    const lane = road.offsetM + 3.4;
    [-100, -20, 60].forEach((s, k) => {
      // Mostly yellow danfo, with some green-bodied buses for colour variety.
      const body = k === 1 ? "#43845c" : DANFO_YELLOW;
      vehicles.push(
        ...(road.axis === "horizontal"
          ? busParts(s, lane, 0, body)
          : busParts(lane, s, Math.PI / 2, body)),
      );
    });
  }

  const spares: Part[] = [];
  layout.yards.forEach((yard, i) => {
    if (yard.kind === "market") spares.push(...marketParts(yard, i));
    else if (yard.kind === "parking") spares.push(...parkingParts(yard, i));
    else if (yard.kind === "shrub") spares.push(...shrubParts(yard, i));
    else if (yard.kind === "grass") spares.push(...grassParts(yard, i));
  });

  return {
    buildings,
    vehicles,
    spares,
    trees: treeParts(layout.trees),
    street: streetParts(layout),
    signs: shopSigns(layout),
  };
}

import type { BankSlug } from "@/lib/bank-branch-data";
import type { WalkPoint } from "./grid-walk-path";
import type { BankObstaclePolygon } from "./bank-lobby-navigation";

export type BankArea = "grounds" | "hall" | "upstairs";
export type BankSurface =
  | "wall"
  | "brand"
  | "wood"
  | "floor"
  | "paving"
  | "metal"
  | "dark"
  | "glass"
  | "screen"
  | "led"
  | "marking"
  | "foliage"
  | "stone"
  | "brick"
  | "officeFloor"
  | "leather"
  | "soil"
  | "cladding"
  | "roof";
export type BankShape = "box" | "cylinder" | "sphere";
export type BankPoint = [number, number, number];
export interface BankPart {
  position: BankPoint;
  size: BankPoint;
  surface: BankSurface;
  blocking: boolean;
  fixture?: string;
  yaw?: number;
  pitch?: number;
  shape?: BankShape;
  color?: string;
}
export interface BankFixture {
  id: string;
  label: string;
  point: WalkPoint;
  action: "atm" | "teller" | "seat" | BankArea;
}
export interface BankSign {
  text: string;
  position: BankPoint;
  width: number;
}
export interface BankWorldLayout {
  area: BankArea;
  width: number;
  depth: number;
  spawn: WalkPoint;
  parts: BankPart[];
  fixtures: BankFixture[];
  signs: BankSign[];
}
/** Branch identities are presentation data; balances, limits, eligibility and banking time remain server-owned. */
export const BANK_BRANCH_DESIGNS = {
  "cedar-bank": {
    name: "Cedar Bank",
    brand: "#145544",
    wall: "#e8e2d4",
    wood: "#926448",
    entranceX: 0,
    stairSide: -1,
    tellers: 5,
    parkingBays: 8,
    galleryStart: 3.5,
    profile: "colonnade",
  },
  "meridian-bank": {
    name: "Meridian Bank",
    brand: "#142f64",
    wall: "#e0e8ed",
    wood: "#b79b79",
    entranceX: -4,
    stairSide: 1,
    tellers: 6,
    parkingBays: 10,
    galleryStart: 0,
    profile: "glass-wing",
  },
} as const;
export const BANK_WORLD = {
  lotWidth: 50,
  lotDepth: 40,
  hallWidth: 30,
  hallDepth: 27,
  buildingOffsetZ: -5,
  stairX: 12,
  innerDoorZ: 9.7,
  outerDoorZ: 12.7,
  scannerZ: 11.2,
  tellerZ: -9,
  floorHeight: 4.5,
  storeys: 2,
  scanMilliseconds: 1500,
} as const;

/** All solid furniture and walls use these same parts for rendering and navigation. */
export function buildBankWorld(
  branch: BankSlug,
  area: BankArea,
  arrivalFrom?: BankArea,
): BankWorldLayout {
  const d = BANK_BRANCH_DESIGNS[branch];
  const exterior = area === "grounds";
  const halfWidth = BANK_WORLD.hallWidth / 2,
    halfDepth = BANK_WORLD.hallDepth / 2;
  const front = BANK_WORLD.buildingOffsetZ + halfDepth,
    back = BANK_WORLD.buildingOffsetZ - halfDepth;
  const layout: BankWorldLayout = {
    area,
    width: exterior ? BANK_WORLD.lotWidth : BANK_WORLD.hallWidth,
    depth: exterior ? BANK_WORLD.lotDepth : BANK_WORLD.hallDepth,
    spawn: exterior
      ? [d.entranceX, front + (arrivalFrom === "hall" ? 2 : 4)]
      : area === "hall" && arrivalFrom !== "upstairs"
        ? [d.entranceX, BANK_WORLD.outerDoorZ - 1]
        : [d.stairSide * BANK_WORLD.stairX, 5],
    parts: [],
    fixtures: [],
    signs: [],
  };
  const add = (
    surface: BankSurface,
    position: BankPoint,
    size: BankPoint,
    blocking = false,
    fixture?: string,
    yaw = 0,
  ) => {
    const part: BankPart = {
      surface,
      position,
      size,
      blocking,
      yaw,
      ...(fixture ? { fixture } : {}),
    };
    layout.parts.push(part);
    return part;
  };
  const sign = (text: string, position: BankPoint, width = 3) =>
    layout.signs.push({ text, position, width });
  const fixture = (id: string, label: string, point: WalkPoint, action: BankFixture["action"]) => {
    layout.fixtures.push({ id, label, point, action });
    return id;
  };
  const chair = (x: number, z: number, id?: string, office = false) => {
    add("leather", [x, 0.48, z], [0.62, 0.16, 0.65], true, id);
    add("leather", [x, 0.85, z - 0.29], [0.62, 0.65, 0.1], false, id);
    for (const side of [-1, 1]) {
      add("metal", [x + side * 0.32, 0.67, z], [0.045, 0.4, 0.06]);
      add("leather", [x + side * 0.32, 0.87, z], [0.07, 0.06, 0.47]);
    }
    if (office) {
      add("metal", [x, 0.24, z], [0.075, 0.42, 0.075]).shape = "cylinder";
      for (const side of [-1, 1]) {
        add("metal", [x, 0.09, z], [0.72, 0.04, 0.06]);
        add("metal", [x, 0.09, z], [0.06, 0.04, 0.72]);
        for (const [dx, dz] of [
          [side * 0.32, 0],
          [0, side * 0.32],
        ] as const)
          add("dark", [x + dx, 0.07, z + dz], [0.1, 0.12, 0.1]).shape = "cylinder";
      }
    } else for (const dx of [-0.24, 0.24]) add("metal", [x + dx, 0.23, z], [0.05, 0.46, 0.55]);
  };
  const computer = (x: number, z: number, y = 0.91) => {
    add("dark", [x, y + 0.34, z], [0.65, 0.45, 0.07]);
    add("screen", [x, y + 0.34, z + 0.04], [0.58, 0.37, 0.015]);
    add("metal", [x, y + 0.09, z], [0.06, 0.18, 0.06]);
    add("dark", [x, y + 0.025, z + 0.24], [0.55, 0.035, 0.2]);
    add("dark", [x + 0.5, y - 0.32, z], [0.18, 0.64, 0.4]);
  };
  const desk = (x: number, z: number, id: string, width = 2.3) => {
    add("wood", [x, 0.85, z], [width, 0.12, 1], true, id);
    for (const dx of [-width / 2 + 0.12, width / 2 - 0.12])
      add("metal", [x + dx, 0.4, z], [0.08, 0.8, 0.8]);
    computer(x, z - 0.2);
    chair(x, z - 1.15, undefined, true);
    add("marking", [x - 0.65, 0.925, z + 0.18], [0.45, 0.035, 0.42]);
    add("dark", [x + 0.88, 0.98, z + 0.2], [0.18, 0.12, 0.25]);
    add("dark", [x + 0.6, 0.98, z + 0.25], [0.16, 0.12, 0.22]);
  };
  const atm = (x: number, z: number, i: number) => {
    const id = fixture(`atm-${i}`, `ATM ${i + 1}`, [x, z + 1.25], "atm");
    add("brand", [x, 1.15, z], [1.15, 2.3, 0.65], true, id);
    add("dark", [x, 1.5, z + 0.34], [0.85, 0.85, 0.06], false, id);
    add("screen", [x, 1.62, z + 0.38], [0.62, 0.42, 0.02], false, id);
    add("metal", [x, 1.05, z + 0.48], [0.8, 0.08, 0.35], false, id);
    add("dark", [x, 0.77, z + 0.35], [0.5, 0.1, 0.04], false, id);
    add("metal", [x + 0.47, 1.45, z + 0.5], [0.05, 0.9, 0.4]);
    add("metal", [x - 0.47, 1.45, z + 0.5], [0.05, 0.9, 0.4]);
    add("dark", [x, 2.55, z + 0.2], [0.18, 0.12, 0.18]);
  };
  const plant = (x: number, z: number) => {
    add("stone", [x, 0.3, z], [0.65, 0.6, 0.65], true).shape = "cylinder";
    add("soil", [x, 0.61, z], [0.6, 0.035, 0.6]).shape = "cylinder";
    for (const [dx, dz, h] of [
      [-0.22, 0, 1.1],
      [0.2, 0.15, 1.4],
      [0, -0.17, 1.65],
    ] as const) {
      add("wood", [x + dx, h * 0.5 + 0.6, z + dz], [0.035, h, 0.035]).shape = "cylinder";
      add("foliage", [x + dx, h + 0.4, z + dz], [0.65, 0.8, 0.5]).shape = "sphere";
    }
  };

  if (exterior) {
    const lotX = BANK_WORLD.lotWidth / 2,
      lotZ = BANK_WORLD.lotDepth / 2;
    add("paving", [0, -0.12, 0], [layout.width, 0.24, layout.depth]);
    // This footprint matches the enlarged playable interior exactly.
    add(
      d.profile === "colonnade" ? "cladding" : "wall",
      [0, 4.25, BANK_WORLD.buildingOffsetZ],
      [BANK_WORLD.hallWidth, 8.5, BANK_WORLD.hallDepth],
      true,
    );
    add("brand", [0, 0.45, front + 0.08], [BANK_WORLD.hallWidth, 0.75, 0.16]);
    add("brand", [0, 4.5, front + 0.12], [BANK_WORLD.hallWidth + 0.25, 0.4, 0.25]);
    add(
      "wall",
      [0, 8.65, BANK_WORLD.buildingOffsetZ],
      [BANK_WORLD.hallWidth + 0.6, 0.3, BANK_WORLD.hallDepth + 0.6],
    );
    // The reference uses a clean concrete roof framed by the branch-colored parapet.
    add(
      "roof",
      [0, 8.84, BANK_WORLD.buildingOffsetZ],
      [BANK_WORLD.hallWidth - 1.2, 0.08, BANK_WORLD.hallDepth - 1.2],
    );
    for (const side of [-1, 1]) {
      add(
        "brand",
        [side * (halfWidth + 0.15), 9.1, BANK_WORLD.buildingOffsetZ],
        [0.25, 0.8, BANK_WORLD.hallDepth + 0.5],
      );
      add(
        "metal",
        [side * (halfWidth + 0.15), 9.53, BANK_WORLD.buildingOffsetZ],
        [0.3, 0.06, BANK_WORLD.hallDepth + 0.6],
      );
    }
    for (const z of [front + 0.15, back - 0.15]) {
      add("brand", [0, 9.1, z], [BANK_WORLD.hallWidth + 0.5, 0.8, 0.25]);
      add("metal", [0, 9.53, z], [BANK_WORLD.hallWidth + 0.6, 0.06, 0.3]);
    }
    add("wall", [-10, 9.5, front - 5], [3.2, 1.3, 3.6]);
    for (const x of [-10.7, -9.3]) add("metal", [x, 10.2, front - 5], [0.7, 0.12, 1.6]);
    // Windows, sill bands, sun-shade fins and downpipes continue onto both side elevations.
    for (const side of [-1, 1]) {
      for (const y of [2, 6.3])
        for (let z = back + 3; z < front - 2; z += 4.4) {
          add("glass", [side * (halfWidth + 0.08), y, z], [0.08, 2.3, 3.1]);
          add("wall", [side * (halfWidth + 0.2), y - 1.2, z], [0.3, 0.12, 3.3]);
          for (const dz of [-1.55, 0, 1.55])
            add("metal", [side * (halfWidth + 0.15), y, z + dz], [0.07, 2.4, 0.055]);
        }
      for (const z of [back + 1, back + 9, front - 1])
        add(
          d.profile === "colonnade" ? "wood" : "brand",
          [side * (halfWidth + 0.2), 4.3, z],
          [0.25, 7.5, 0.2],
        );
      add(
        "brand",
        [side * (halfWidth + 0.12), 4.5, BANK_WORLD.buildingOffsetZ],
        [0.22, 0.3, BANK_WORLD.hallDepth],
      );
      add("metal", [side * (halfWidth + 0.3), 4, back + 0.6], [0.1, 8, 0.1]).shape = "cylinder";
    }
    for (let x = -13; x <= 13; x += 3.25) {
      if (d.profile === "glass-wing") {
        add("dark", [x, 4.2, front + 0.11], [2.9, 7.4, 0.04]);
        add("glass", [x, 4.2, front + 0.2], [2.9, 7.4, 0.08]);
        for (const dx of [-1.45, 1.45])
          add("metal", [x + dx, 4.2, front + 0.29], [0.07, 7.5, 0.07]);
        add("metal", [x, 4.5, front + 0.3], [3.1, 0.14, 0.08]);
      } else
        for (const y of [2, 6.4]) {
          if (y === 2 && Math.abs(x - d.entranceX) < 2.5) continue;
          add("glass", [x, y, front + 0.15], [2.6, 2.6, 0.08]);
          add("wood", [x, y - 1.4, front + 0.25], [2.85, 0.15, 0.3]);
          for (const dx of [-1.3, 0, 1.3])
            add("wood", [x + dx, y, front + 0.22], [0.055, 2.7, 0.06]);
        }
    }
    if (d.profile === "colonnade") {
      for (const x of [-2.4, 2.4])
        for (const z of [front + 0.4, front + 2.3]) {
          add("wood", [x, 1.65, z], [0.4, 3.3, 0.4], true);
          add("wall", [x, 0.2, z], [0.65, 0.4, 0.65], true);
        }
      add("brand", [0, 3.45, front + 1.4], [5.7, 0.3, 3.4]);
      add("wall", [0, 3.67, front + 1.4], [5.9, 0.15, 3.5]);
      for (const x of [-6.5, 6.5]) add("wood", [x, 6.4, front + 0.35], [0.35, 3.4, 0.45]);
      add("brand", [0, 9.45, front + 0.25], [10.5, 0.6, 0.35]);
    } else {
      for (const x of [d.entranceX - 2.4, d.entranceX + 2.4])
        add("brand", [x, 4.4, front + 0.4], [0.65, 8.8, 0.7]);
      add("brand", [d.entranceX, 3.5, front + 1.3], [6.1, 0.24, 3.3]);
      add("metal", [d.entranceX, 3.7, front + 1.4], [6.5, 0.12, 3.4]);
      add("glass", [10.6, 6.4, front + 0.55], [6.8, 3.2, 0.5]);
      add("brand", [10.6, 8.15, front + 0.65], [7.2, 0.25, 0.7]);
      for (const x of [8, 9.8, 11.6, 13.4]) add("metal", [x, 6.4, front + 0.84], [0.06, 3.3, 0.06]);
    }
    const entrance = fixture("entrance", "Enter banking hall", [d.entranceX, front + 1.4], "hall");
    add("dark", [d.entranceX, 1.5, front + 0.22], [3.4, 3, 0.16], false, entrance);
    add("glass", [d.entranceX, 1.5, front + 0.33], [3.1, 2.85, 0.1], false, entrance);
    for (const dx of [-1.6, 0, 1.6])
      add("metal", [d.entranceX + dx, 1.5, front + 0.43], [0.06, 2.95, 0.05], false, entrance);
    for (const dx of [-0.18, 0.18])
      add("metal", [d.entranceX + dx, 1.35, front + 0.5], [0.05, 0.7, 0.08], false, entrance);
    sign(d.name.toUpperCase(), [0, 5.05, front + 0.6], 13);
    // The separate ATM gallery has its own canopy, lighting and unobstructed approach lane.
    for (let i = 0; i < 5; i++) atm(d.galleryStart + i * 2, front + 0.55, i);
    const galleryX = d.galleryStart + 4;
    add("brand", [galleryX, 2.95, front + 1.35], [10.6, 0.18, 2.4]);
    add("metal", [galleryX, 3.09, front + 1.35], [10.8, 0.1, 2.5]);
    sign("ATM • 24 HOURS", [galleryX, 2.76, front + 2.58], 8);
    for (const x of [d.galleryStart - 1, d.galleryStart + 9])
      add("metal", [x, 1.45, front + 2.3], [0.12, 2.9, 0.12], true);
    for (let i = 0; i < 5; i++)
      add("led", [d.galleryStart + i * 2, 2.82, front + 1.25], [0.7, 0.04, 0.6]);
    const plazaSurface = d.profile === "colonnade" ? "brick" : "stone";
    add(plazaSurface, [0, 0.012, front + 5.1], [BANK_WORLD.hallWidth + 3, 0.024, 10]);
    add(plazaSurface, [d.entranceX, 0.025, front + 5.3], [2.2, 0.05, 9]);
    const bed = (x: number, z: number, width: number, depth: number) => {
      add("stone", [x, 0.24, z], [width, 0.48, depth], true);
      add("soil", [x, 0.49, z], [width - 0.15, 0.04, depth - 0.15]);
      const count = Math.max(2, Math.floor(Math.max(width, depth) / 0.65));
      for (let i = 0; i < count; i++) {
        const offset = (i / (count - 1) - 0.5) * (Math.max(width, depth) - 0.5),
          px = x + (width > depth ? offset : 0),
          pz = z + (depth >= width ? offset : 0);
        add("foliage", [px, 0.76, pz], [0.72, 0.65, 0.72]).shape = "sphere";
        if (width > depth) {
          const flower = add("foliage", [px, 0.95, pz + 0.28], [0.35, 0.18, 0.35]);
          flower.shape = "sphere";
          flower.color = i % 2 ? "#cbb6bf" : "#e4decf";
        }
      }
    };
    for (const x of [-9, 9]) bed(x, front + 5.3, 8, 1.1);
    for (const x of [-lotX + 1.1, lotX - 1.1]) bed(x, 0, 0.85, 12);
    // Parked scenery has no ownership/vehicle controls; its real footprint blocks walking.
    const parkedCar = (x: number, z: number, paint: string) => {
      add("dark", [x, 0.35, z], [4, 0.2, 1.8]);
      const body = add("metal", [x, 0.65, z], [4.2, 0.5, 1.85], true);
      body.color = paint;
      add("dark", [x - 0.2, 1.12, z], [2.15, 0.65, 1.6]);
      const roof = add("metal", [x - 0.2, 1.49, z], [2.2, 0.1, 1.65]);
      roof.color = paint;
      for (const side of [-1, 1]) {
        add("glass", [x - 0.2, 1.14, z + side * 0.82], [1.9, 0.47, 0.04]);
        add("glass", [x - 0.2 + side * 1.09, 1.14, z], [0.04, 0.47, 1.5]);
        for (const dx of [-1.3, 1.3]) {
          const wheel = add("dark", [x + dx, 0.35, z + side * 0.92], [0.64, 0.2, 0.64]);
          wheel.shape = "cylinder";
          wheel.pitch = Math.PI / 2;
        }
        add("led", [x + 2.12, 0.69, z + side * 0.56], [0.035, 0.16, 0.4]);
        add("metal", [x - 2.12, 0.69, z + side * 0.56], [0.035, 0.16, 0.35]).color = "#994b45";
      }
    };
    for (const side of [-1, 1])
      for (let i = 0; i < d.parkingBays / 2; i++)
        if ((i + (side < 0 ? 0 : 1)) % 2 === 0)
          parkedCar(
            side * (halfWidth + 5),
            back + 9.6 + i * 3.2,
            ["#d4d8db", "#667580", "#34404a"][i % 3]!,
          );
    // Parking bays stay outside the building, with a clear side pedestrian path and low kerbs.
    for (const side of [-1, 1]) {
      const px = side * (halfWidth + 5);
      for (let i = 0; i <= d.parkingBays / 2; i++)
        add("marking", [px, 0.015, back + 8 + i * 3.2], [5, 0.025, 0.08]);
      add(
        "marking",
        [px + side * 2.5, 0.015, back + 8 + d.parkingBays * 0.8],
        [0.08, 0.025, d.parkingBays * 1.6],
      );
      add("wall", [side * (halfWidth + 1.7), 0.025, -1], [1.25, 0.05, layout.depth - 9]);
      for (const z of [-10, -3, 4])
        add("metal", [side * (halfWidth + 2.35), 0.45, z], [0.2, 0.9, 0.2], true).shape =
          "cylinder";
      for (const z of [-8, 8]) {
        add("metal", [side * (lotX - 1.3), 2, z], [0.12, 4, 0.12], true).shape = "cylinder";
        add("metal", [side * (lotX - 1.3), 4, z], [0.45, 0.2, 0.7]);
        add("led", [side * (lotX - 1.3), 3.87, z], [0.4, 0.04, 0.6]);
      }
    }
    // Low masonry and spaced rails make the compound readable without hiding the frontage.
    for (const side of [-1, 1]) {
      add("wall", [side * (lotX - 0.25), 0.3, 0], [0.3, 0.6, layout.depth], true);
      for (let z = -lotZ + 0.6; z < lotZ; z += 1.3)
        add("metal", [side * (lotX - 0.25), 1.1, z], [0.06, 1.1, 0.06]);
      add("metal", [side * (lotX - 0.25), 1.7, 0], [0.08, 0.07, layout.depth]);
    }
    const gateZ = lotZ - 0.4,
      leftEnd = d.entranceX - 3.7,
      rightStart = d.entranceX + 3.7;
    for (const [left, right] of [
      [-lotX, leftEnd],
      [rightStart, lotX],
    ] as const) {
      const center = (left + right) / 2,
        width = right - left;
      add("wall", [center, 0.3, gateZ], [width, 0.6, 0.3], true);
      add("metal", [center, 1.65, gateZ], [width, 0.08, 0.1]);
      for (let x = left + 0.3; x < right; x += 1.3)
        add("metal", [x, 1.05, gateZ], [0.06, 1.2, 0.06]);
    }
    // The sliding gate is parked alongside the fence, leaving the entrance visibly open.
    add("metal", [leftEnd - 3, 1, gateZ - 0.18], [6, 1.7, 0.12]);
    const boothX = -lotX + 4,
      boothZ = lotZ - 4.3;
    add("wall", [boothX, 1.4, boothZ], [3.5, 2.8, 3], true);
    add("brand", [boothX, 2.9, boothZ], [3.9, 0.2, 3.4]);
    add("glass", [boothX, 1.8, boothZ + 1.55], [2.7, 1.15, 0.06]);
    sign("SECURITY", [boothX, 2.65, boothZ + 1.62], 3);
    const utilityX = lotX - 4.3;
    add("wall", [utilityX, 1.4, back + 3.5], [6, 2.8, 6], true);
    add("brand", [utilityX, 3, back + 3.5], [6.3, 0.2, 6.3]);
    for (const x of [utilityX - 1.4, utilityX + 1.4]) {
      add("dark", [x, 1, back + 3.5], [2, 1.5, 3]);
      add("metal", [x, 2.1, back + 3.5], [0.3, 1.2, 0.3]);
    }
    sign("POWER / INVERTER", [utilityX, 2.3, back + 6.6], 5);
    for (const x of [-lotX + 2, lotX - 2]) for (const z of [back + 1, 6, 12]) plant(x, z);
    for (const x of [-lotX + 2, lotX - 2]) {
      add("wood", [x, 1.25, 15], [0.22, 2.5, 0.22], true).shape = "cylinder";
      add("foliage", [x, 3, 15], [2.4, 3, 2.4]).shape = "sphere";
    }
    return layout;
  }

  add(
    area === "upstairs" ? "officeFloor" : "floor",
    [0, -0.1, 0],
    [layout.width, 0.2, layout.depth],
  );
  if (area === "hall")
    for (let x = -halfWidth + 1; x < halfWidth; x += 2)
      add("metal", [x, 0.003, 0], [0.012, 0.004, layout.depth]);
  if (area === "hall")
    for (let z = -halfDepth + 1; z < halfDepth; z += 2)
      add("metal", [0, 0.003, z], [layout.width, 0.004, 0.012]);
  add("wall", [0, 2.25, -halfDepth + 0.2], [layout.width, 4.5, 0.25], true);
  add("wall", [-halfWidth + 0.2, 2.25, 0], [0.25, 4.5, layout.depth], true);
  add("wall", [halfWidth - 0.2, 0.35, 0], [0.25, 0.7, layout.depth], true);
  // Ceiling lights sit along the rear/side soffits, leaving the playable cutaway unobscured.
  for (const x of [-12, -6, 0, 6, 12]) {
    add("wall", [x, 4.2, -halfDepth + 0.85], [2, 0.3, 1.5]);
    add("led", [x, 4, -halfDepth + 0.85], [1.6, 0.03, 1.2]);
  }
  for (const z of [-9, -3.5, 2, 7.5]) add("glass", [-halfWidth + 0.36, 2.6, z], [0.05, 2.4, 3]);
  for (const side of [-1, 1]) {
    add("stone", [side * (halfWidth - 0.55), 0.015, 0], [0.65, 0.025, layout.depth]);
    add("stone", [0, 0.015, side * (halfDepth - 0.55)], [layout.width, 0.025, 0.65]);
  }
  const sx = d.stairSide * BANK_WORLD.stairX;
  const stair = fixture(
    "stairs",
    area === "hall" ? "Upstairs customer care" : "Downstairs banking hall",
    [sx, 5],
    area === "hall" ? "upstairs" : "hall",
  );
  const stepCount = 18,
    stepRise = BANK_WORLD.floorHeight / stepCount,
    stepRun = 0.35,
    startZ = 3;
  const flightRun = (stepCount - 1) * stepRun,
    flightRise = (stepCount - 1) * stepRise;
  if (area === "hall") {
    for (let i = 0; i < stepCount; i++)
      add(
        d.profile === "colonnade" ? "wood" : "stone",
        [sx, ((i + 1) * stepRise) / 2, startZ - i * stepRun],
        [2.3, (i + 1) * stepRise, stepRun],
        true,
        stair,
      );
  } else {
    add("dark", [sx, 0.015, 0], [2.3, 0.03, 6.4], true, stair);
    for (const x of [sx - 1.2, sx + 1.2])
      for (const z of [-3, 0, 3]) add("metal", [x, 0.55, z], [0.06, 1.1, 0.06]);
  }
  for (const x of [sx - 1.2, sx + 1.2]) {
    if (area === "hall") {
      const rail = add(
        "metal",
        [x, (stepRise + BANK_WORLD.floorHeight) / 2 + 0.9, startZ - flightRun / 2],
        [0.065, 0.065, Math.hypot(flightRun, flightRise)],
        false,
        stair,
      );
      rail.pitch = Math.atan2(flightRise, flightRun);
      for (let i = 0; i < stepCount; i += 3)
        add(
          "metal",
          [x, (i + 1) * stepRise + 0.45, startZ - i * stepRun],
          [0.05, 0.9, 0.05],
          false,
          stair,
        );
    } else add("metal", [x, 1.1, 0], [0.065, 0.065, 6.4], false, stair);
  }
  sign(area === "hall" ? "CUSTOMER CARE ↑" : "BANKING HALL ↓", [sx, 3.3, 3.6], 3.4);

  if (d.profile === "colonnade")
    for (let x = -8.8; x <= 8.8; x += 0.3)
      add("wood", [x, 2.1, -halfDepth + 0.57], [0.07, 3.8, 0.12]);
  for (const z of [-9, -3.5, 2, 7.5]) {
    for (const y of [1.35, 3.85]) add("metal", [-halfWidth + 0.39, y, z], [0.08, 0.055, 3.1]);
    for (const dz of [-1.5, 0, 1.5])
      add("metal", [-halfWidth + 0.39, 2.6, z + dz], [0.08, 2.55, 0.06]);
  }
  for (const x of [-10, -5, 0, 5, 10]) {
    add("metal", [x, 2.4, -halfDepth + 0.4], [0.2, 0.32, 0.12]);
    add("led", [x, 2.4, -halfDepth + 0.49], [0.12, 0.2, 0.035]);
  }
  if (area === "hall") {
    const entry = d.entranceX,
      scanZ = BANK_WORLD.scannerZ,
      tellerZ = BANK_WORLD.tellerZ;
    for (const x of [entry - 2.05, entry + 2.05])
      add("glass", [x, 1.8, scanZ], [0.12, 3.6, 3.2], true);
    add("metal", [entry, 2.8, scanZ], [4.2, 0.22, 0.3]);
    add("metal", [entry - 1.5, 1.35, scanZ], [0.16, 2.7, 0.3], true);
    add("metal", [entry + 1.5, 1.35, scanZ], [0.16, 2.7, 0.3], true);
    const out = fixture(
      "exit",
      "Leave hall for ATM gallery",
      [entry, BANK_WORLD.outerDoorZ - 0.4],
      "grounds",
    );
    add("brand", [entry + 2.8, 0.7, scanZ - 0.2], [1.2, 1.4, 1], true, out);
    computer(entry + 2.8, scanZ - 0.2, 1.4);
    sign("SECURITY SCAN", [entry, 3.1, scanZ + 0.1], 3.5);
    // Five or six screened teller positions across a sixteen metre service line.
    add("brand", [0, 2.1, -halfDepth + 0.45], [18, 3.8, 0.15]);
    sign(d.name.toUpperCase(), [0, 3, -halfDepth + 0.65], 10);
    const count = d.tellers,
      spacing = 16 / count;
    for (let i = 0; i < count; i++) {
      const x = -8 + spacing * (i + 0.5),
        id = fixture(
          `teller-${i}`,
          i === count - 1 ? "Corporate teller" : `Cash teller ${i + 1}`,
          [x, tellerZ + 1.9],
          "teller",
        );
      add(
        d.profile === "colonnade" ? "wood" : "brand",
        [x, 0.6, tellerZ],
        [spacing - 0.05, 1.2, 1.15],
        true,
        id,
      );
      add("stone", [x, 1.23, tellerZ], [spacing, 0.1, 1.3], false, id);
      add("glass", [x, 1.95, tellerZ - 0.1], [spacing - 0.12, 1.35, 0.06], false, id);
      add("metal", [x - spacing / 2, 1.95, tellerZ - 0.1], [0.07, 1.5, 0.07]);
      add("metal", [x, 1.32, tellerZ + 0.35], [0.55, 0.04, 0.4]);
      computer(x, tellerZ - 0.5, 1.28);
      add("dark", [x + 0.7, 1.42, tellerZ - 0.2], [0.45, 0.25, 0.35]);
      add("dark", [x - 0.6, 1.4, tellerZ + 0.2], [0.18, 0.2, 0.25]);
    }
    if (d.profile === "colonnade")
      for (let x = -7.9; x <= 7.9; x += 0.28)
        add("wood", [x, 0.65, tellerZ + 0.6], [0.05, 1.05, 0.07]);
    const seatX = -d.stairSide * 6;
    for (const z of [-0.5, 2, 4.5])
      for (const dx of [-1, 0, 1]) {
        const x = seatX + dx * 0.9,
          id = fixture(`seat-${x}-${z}`, "Waiting chair", [x, z + 1], "seat");
        chair(x, z, id);
      }
    const loungeX = d.stairSide * 9;
    for (const [i, z] of [7, 9.4].entries()) {
      const id = fixture(`lounge-${i}`, "Window lounge chair", [loungeX, z + 1.1], "seat");
      add("leather", [loungeX, 0.45, z], [0.95, 0.3, 0.85], true, id).shape = "cylinder";
      add("leather", [loungeX, 0.85, z - 0.34], [1, 0.75, 0.22], false, id).shape = "sphere";
      for (const dx of [-0.45, 0.45])
        add("leather", [loungeX + dx, 0.64, z], [0.14, 0.42, 0.8], false, id);
    }
    add("wood", [loungeX - d.stairSide * 1.4, 0.48, 8.2], [0.85, 0.1, 0.85], true).shape =
      "cylinder";
    add("metal", [loungeX - d.stairSide * 1.4, 0.24, 8.2], [0.08, 0.48, 0.08]).shape = "cylinder";
    const kiosk = fixture("ticket", "Queue and teller services", [entry, 8.2], "teller");
    add("brand", [entry + 0.9, 0.65, 7.5], [0.6, 1.3, 0.55], true, kiosk);
    add("screen", [entry + 0.9, 1.35, 7.8], [0.5, 0.4, 0.04], false, kiosk);
    sign("ACCOUNT & CASH SERVICES", [0, 3.1, tellerZ + 0.05], 7);
    for (const x of [-1.6, 1.6])
      for (const z of [-3, -1, 1]) {
        add("metal", [x, 0.5, z], [0.08, 1, 0.08], true);
        add("dark", [x, 0.9, z + 0.8], [0.04, 0.06, 1.6]);
      }
    const formsX = d.stairSide * 6;
    add("wood", [formsX, 1.1, 3], [2.8, 0.15, 1.2], true);
    add("metal", [formsX, 0.55, 3], [0.12, 1.1, 0.9]);
    for (const dx of [-0.7, 0, 0.7]) add("marking", [formsX + dx, 1.19, 3.15], [0.4, 0.01, 0.55]);
    for (const x of [-13, 13]) plant(x, -11);
    return layout;
  }

  // Four account-opening cubicles, with a different orientation and glazing rhythm per branch.
  for (let i = 0; i < 4; i++) {
    const x = d.profile === "colonnade" ? -8 + i * 5.5 : -8 + i * 6,
      z = d.profile === "colonnade" ? 3 : i % 2 ? 4 : 1.5;
    const id = fixture(`care-${i}`, `Customer care desk ${i + 1}`, [x, z + 1.5], "teller");
    desk(x, z, id);
    add("glass", [x - 1.7, 1.25, z], [0.07, 2.5, 2.5], true);
    add("brand", [x - 1.7, 1.3, z], [0.09, 0.25, 2.5]);
    add("wood", [x, 0.4, z - 0.1], [1.8, 0.8, 0.65], false, id);
    add("wood", [x - 1.7, 0.5, z], [0.09, 1, 2.5]);
    add("dark", [x + 1.25, 0.26, z + 0.2], [0.28, 0.52, 0.28]).shape = "cylinder";
  }
  // Loan/advisory room is architectural only until real server-backed products are available.
  for (const x of [-10.5, -5.5]) add("glass", [x, 1.5, -3.5], [3, 3, 0.08], true);
  add("glass", [-3.9, 1.5, -8.4], [0.08, 3, 9.8], true);
  add("wood", [-8, 0.8, -8], [4, 0.15, 1.8], true);
  for (const x of [-9.2, -6.8]) for (const z of [-9.4, -6.6]) chair(x, z);
  sign("CREDIT & WEALTH ADVISORY", [-8, 3, -3.35], 7);
  const manager = fixture("manager-desk", "Account relationship desk", [3, -5.5], "teller");
  desk(3, -7, manager, 3.5);
  add("brand", [3, 2.3, -halfDepth + 0.3], [6, 3, 0.15]);
  sign("BRANCH MANAGER", [3, 3, -halfDepth + 0.55], 5);
  add("wall", [12, 1.8, -9], [4.4, 3.6, 7.4], true);
  add("metal", [12, 1.6, -5.2], [2.3, 3.2, 0.16], true);
  sign("RESTRICTED • VAULT / SERVER", [12, 3.5, -5.08], 4);
  plant(-13, 10);
  plant(13, 10);
  return layout;
}

export function bankObstaclePolygons(layout: BankWorldLayout): BankObstaclePolygon[] {
  return layout.parts
    .filter((part) => part.blocking)
    .map((part) => {
      const [x, , z] = part.position,
        [w, , d] = part.size,
        yaw = part.yaw ?? 0;
      return [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ].map(
        ([dx, dz]) =>
          [
            x + dx! * Math.cos(yaw) + dz! * Math.sin(yaw),
            z - dx! * Math.sin(yaw) + dz! * Math.cos(yaw),
          ] as const,
      );
    });
}

/** Low floor finishes and painted markings must pass clicks to walking, regardless of material. */
export function isBankWalkSurface(part: BankPart): boolean {
  return !part.blocking && part.position[1] + part.size[1] / 2 <= 0.12;
}

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
  | "foliage";
export type BankPoint = [number, number, number];
export interface BankPart {
  position: BankPoint;
  size: BankPoint;
  surface: BankSurface;
  blocking: boolean;
  fixture?: string;
  yaw?: number;
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
  lotWidth: 45,
  lotDepth: 35,
  hallWidth: 26,
  hallDepth: 24,
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
  const layout: BankWorldLayout = {
    area,
    width: exterior ? 45 : 26,
    depth: exterior ? 35 : 24,
    spawn: exterior
      ? [d.entranceX, arrivalFrom === "hall" ? 9.5 : 11]
      : area === "hall" && arrivalFrom !== "upstairs"
        ? [d.entranceX, 10]
        : [d.stairSide * 10, 5],
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
    layout.parts.push({ surface, position, size, blocking, yaw, ...(fixture ? { fixture } : {}) });
  };
  const sign = (text: string, position: BankPoint, width = 3) =>
    layout.signs.push({ text, position, width });
  const fixture = (id: string, label: string, point: WalkPoint, action: BankFixture["action"]) => {
    layout.fixtures.push({ id, label, point, action });
    return id;
  };
  const chair = (x: number, z: number, id?: string) => {
    add("dark", [x, 0.48, z], [0.62, 0.16, 0.65], true, id);
    add("dark", [x, 0.85, z - 0.29], [0.62, 0.65, 0.1], false, id);
    for (const dx of [-0.24, 0.24]) add("metal", [x + dx, 0.23, z], [0.05, 0.46, 0.55]);
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
    chair(x, z - 1.15);
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
    add("wood", [x, 0.3, z], [0.7, 0.6, 0.7], true);
    add("foliage", [x, 1.1, z], [0.8, 1.2, 0.8]);
  };

  if (exterior) {
    add("paving", [0, -0.12, 0], [45, 0.24, 35]);
    // The solid footprint is also the route obstacle; the front door is an explicit transition.
    add("wall", [0, 4.25, -5], [26, 8.5, 24], true);
    add("brand", [0, 4.5, 7.08], [26.25, 0.45, 0.25]);
    add("wall", [0, 8.7, -5], [26.6, 0.4, 24.6]);
    for (const y of [2, 6.4])
      for (let x = -11; x <= 11; x += 3.1) {
        if (y === 2 && Math.abs(x - d.entranceX) < 2.5) continue;
        add("glass", [x, y, 7.15], [2.45, 2.6, 0.08]);
        for (const dx of [-1.22, 0, 1.22]) add("metal", [x + dx, y, 7.22], [0.055, 2.7, 0.06]);
      }
    if (d.profile === "colonnade")
      for (const x of [-10, -5, 5, 10]) add("wood", [x, 2, 7.9], [0.55, 4, 0.55], true);
    else {
      add("brand", [-11.8, 4.15, 7.35], [1.2, 8.3, 0.45]);
      add("glass", [10.8, 6.3, 7.35], [4, 3.5, 0.12]);
    }
    const entrance = fixture("entrance", "Enter banking hall", [d.entranceX, 8.4], "hall");
    add("dark", [d.entranceX, 1.5, 7.22], [3.5, 3, 0.16], false, entrance);
    add("glass", [d.entranceX, 1.5, 7.33], [3.1, 2.85, 0.1], false, entrance);
    add("metal", [d.entranceX, 1.5, 7.43], [0.06, 2.9, 0.05]);
    add("brand", [d.entranceX, 3.2, 8.1], [5.5, 0.2, 2.8]);
    sign(d.name.toUpperCase(), [0, 5.05, 7.42], 13);
    sign("ATM • 24 HOURS", [d.galleryStart + 4, 3.15, 8.05], 8);
    for (let i = 0; i < 5; i++) atm(d.galleryStart + i * 2, 7.5, i);
    add("brand", [d.galleryStart + 4, 2.95, 8.3], [10.6, 0.18, 2.4]);
    for (const x of [d.galleryStart - 1, d.galleryStart + 9])
      add("metal", [x, 1.45, 9.2], [0.12, 2.9, 0.12], true);
    // Eight or ten parking bays flank the pedestrian spine; no fake parked vehicles.
    for (const side of [-1, 1])
      for (let i = 0; i < d.parkingBays / 2; i++) {
        const z = -6 + i * 3.4,
          x = side * 17.5;
        add("marking", [x, 0.015, z], [5, 0.025, 0.08]);
        add("marking", [x + side * 2.5, 0.015, z + 1.6], [0.08, 0.025, 3.3]);
        add("metal", [side * 13.9, 0.4, z], [0.18, 0.8, 0.18], true);
      }
    add("marking", [d.entranceX, 0.02, 12], [2.2, 0.025, 6]);
    for (const side of [-1, 1]) add("metal", [side * 22.25, 1.1, 0], [0.16, 2.2, 35], true);
    for (const [x, w] of [
      [-12.5, 19],
      [12.5, 19],
    ] as const)
      add("metal", [x, 1.1, 17.2], [w, 2.2, 0.15], true);
    add("metal", [0, 0.7, 17.1], [5.8, 0.08, 0.08]);
    add("wall", [-17.5, 1.4, 13.4], [3.5, 2.8, 3], true);
    add("glass", [-17.5, 1.8, 15], [2.5, 1.1, 0.05]);
    sign("SECURITY", [-17.5, 2.65, 15], 3);
    add("wall", [18, 1.4, -13], [6, 2.8, 6], true);
    add("brand", [18, 3, -13], [6.3, 0.2, 6.3]);
    for (const x of [16.5, 19.5]) {
      add("dark", [x, 1, -13], [2, 1.5, 3]);
      add("metal", [x, 2.1, -13], [0.3, 1.2, 0.3]);
    }
    sign("POWER / INVERTER", [18, 2.3, -9.92], 5);
    for (const x of [-20, 20]) for (const z of [-8, 4]) plant(x, z);
    return layout;
  }

  add("floor", [0, -0.1, 0], [26, 0.2, 24]);
  for (let x = -12; x <= 12; x += 2) add("metal", [x, 0.003, 0], [0.012, 0.004, 24]);
  for (let z = -11; z <= 11; z += 2) add("metal", [0, 0.003, z], [26, 0.004, 0.012]);
  add("wall", [0, 2.25, -11.8], [26, 4.5, 0.25], true);
  add("wall", [-12.8, 2.25, 0], [0.25, 4.5, 24], true);
  add("wall", [12.8, 0.35, 0], [0.25, 0.7, 24], true);
  // Ceiling lights sit along the rear/side soffits, leaving the playable cutaway unobscured.
  for (const x of [-10, -5, 0, 5, 10]) {
    add("wall", [x, 4.2, -10.8], [2, 0.3, 1.5]);
    add("led", [x, 4, -10.8], [1.6, 0.03, 1.2]);
  }
  for (const z of [-8, -3, 2, 7]) add("glass", [-12.64, 2.6, z], [0.05, 2.4, 3]);
  const sx = d.stairSide * 10;
  const stair = fixture(
    "stairs",
    area === "hall" ? "Upstairs customer care" : "Downstairs banking hall",
    [sx, 5],
    area === "hall" ? "upstairs" : "hall",
  );
  if (area === "hall") {
    for (let i = 0; i < 18; i++)
      add("paving", [sx, (i + 1) * 0.125, 3 - i * 0.35], [2.3, (i + 1) * 0.25, 0.35], true, stair);
  } else {
    add("dark", [sx, 0.015, 0], [2.3, 0.03, 6.4], true, stair);
    for (const x of [sx - 1.2, sx + 1.2])
      for (const z of [-3, 0, 3]) add("metal", [x, 0.55, z], [0.06, 1.1, 0.06]);
  }
  for (const x of [sx - 1.2, sx + 1.2]) add("metal", [x, 2.6, 0], [0.06, 0.06, 6.4]);
  sign(area === "hall" ? "CUSTOMER CARE ↑" : "BANKING HALL ↓", [sx, 3.3, 3.6], 3.4);

  if (area === "hall") {
    const entry = d.entranceX;
    for (const x of [entry - 2.05, entry + 2.05])
      add("glass", [x, 1.8, 9.4], [0.12, 3.6, 3.2], true);
    add("metal", [entry, 2.8, 9.4], [4.2, 0.22, 0.3]);
    add("metal", [entry - 1.5, 1.35, 9.4], [0.16, 2.7, 0.3], true);
    add("metal", [entry + 1.5, 1.35, 9.4], [0.16, 2.7, 0.3], true);
    const out = fixture("exit", "Leave hall for ATM gallery", [entry, 10.7], "grounds");
    add("brand", [entry + 2.8, 0.7, 9.2], [1.2, 1.4, 1], true, out);
    computer(entry + 2.8, 9.2, 1.4);
    sign("SECURITY SCAN", [entry, 3.1, 9.5], 3.5);
    // Five or six screened teller positions across a sixteen metre service line.
    add("brand", [0, 2.1, -11.55], [18, 3.8, 0.15]);
    sign(d.name.toUpperCase(), [0, 3, -11.35], 10);
    const count = d.tellers,
      spacing = 16 / count;
    for (let i = 0; i < count; i++) {
      const x = -8 + spacing * (i + 0.5),
        id = fixture(
          `teller-${i}`,
          i === count - 1 ? "Corporate teller" : `Cash teller ${i + 1}`,
          [x, -5.1],
          "teller",
        );
      add("wood", [x, 0.6, -7], [spacing - 0.05, 1.2, 1.15], true, id);
      add("metal", [x, 1.23, -7], [spacing, 0.1, 1.3], false, id);
      add("glass", [x, 1.95, -7.1], [spacing - 0.12, 1.35, 0.06], false, id);
      add("metal", [x - spacing / 2, 1.95, -7.1], [0.07, 1.5, 0.07]);
      add("metal", [x, 1.32, -6.65], [0.55, 0.04, 0.4]);
      computer(x, -7.5, 1.28);
      add("dark", [x + 0.7, 1.42, -7.2], [0.45, 0.25, 0.35]);
      add("dark", [x - 0.6, 1.4, -6.8], [0.18, 0.2, 0.25]);
    }
    const seatX = -d.stairSide * 5;
    for (const z of [0, 2, 4])
      for (const dx of [-1, 0, 1]) {
        const x = seatX + dx * 0.9,
          id = fixture(`seat-${x}-${z}`, "Waiting chair", [x, z + 1], "seat");
        chair(x, z, id);
      }
    const kiosk = fixture("ticket", "Queue and teller services", [entry, 6.2], "teller");
    add("brand", [entry + 0.9, 0.65, 5.5], [0.6, 1.3, 0.55], true, kiosk);
    add("screen", [entry + 0.9, 1.35, 5.8], [0.5, 0.4, 0.04], false, kiosk);
    sign("ACCOUNT & CASH SERVICES", [0, 3.1, -6.95], 7);
    for (const x of [-1.6, 1.6])
      for (const z of [-3, -1, 1]) {
        add("metal", [x, 0.5, z], [0.08, 1, 0.08], true);
        add("dark", [x, 0.9, z + 0.8], [0.04, 0.06, 1.6]);
      }
    const formsX = d.stairSide * 5;
    add("wood", [formsX, 1.1, 2], [2.8, 0.15, 1.2], true);
    add("metal", [formsX, 0.55, 2], [0.12, 1.1, 0.9]);
    for (const dx of [-0.7, 0, 0.7]) add("marking", [formsX + dx, 1.19, 2.15], [0.4, 0.01, 0.55]);
    for (const x of [-11, 11]) plant(x, -9.8);
    return layout;
  }

  // Four account-opening cubicles, with a different orientation and glazing rhythm per branch.
  for (let i = 0; i < 4; i++) {
    const x = d.profile === "colonnade" ? -7 + i * 4.5 : -6 + i * 4,
      z = d.profile === "colonnade" ? 3 : i % 2 ? 4 : 1.5;
    const id = fixture(`care-${i}`, `Customer care desk ${i + 1}`, [x, z + 1.5], "teller");
    desk(x, z, id);
    add("glass", [x - 1.7, 1.25, z], [0.07, 2.5, 2.5], true);
    add("brand", [x - 1.7, 1.3, z], [0.09, 0.25, 2.5]);
  }
  // Loan/advisory room is architectural only until real server-backed products are available.
  for (const x of [-9.5, -4.5]) add("glass", [x, 1.5, -3.5], [3, 3, 0.08], true);
  add("glass", [-2.9, 1.5, -7.4], [0.08, 3, 8], true);
  add("wood", [-7, 0.8, -7], [4, 0.15, 1.8], true);
  for (const x of [-8.2, -5.8]) for (const z of [-8.4, -5.6]) chair(x, z);
  sign("CREDIT & WEALTH ADVISORY", [-7, 3, -3.35], 7);
  const manager = fixture("manager-desk", "Account relationship desk", [3, -4.5], "teller");
  desk(3, -6, manager, 3.5);
  add("brand", [3, 2.3, -11.5], [6, 3, 0.15]);
  sign("BRANCH MANAGER", [3, 3, -11.25], 5);
  add("wall", [10, 1.8, -8], [4, 3.6, 6], true);
  add("metal", [10, 1.6, -4.91], [2.3, 3.2, 0.16], true);
  sign("RESTRICTED • VAULT / SERVER", [10, 3.5, -4.78], 4);
  plant(-11, 9);
  plant(11, 9);
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

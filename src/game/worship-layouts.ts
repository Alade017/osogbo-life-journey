/**
 * The three worship interiors. Each place has its own hall: its own size, columns, prayer rows
 * and focal point. The visitor enters from the south wall (positive z) and faces north.
 */
export type WorshipLayout = {
  slug: string;
  faith: "mosque" | "church";
  hall: { width: number; depth: number };
  palette: { floor: string; wall: string; carpet: string; accent: string; wood: string };
  /** The mihrab (mosque) or altar (church), on the north wall. */
  focal: { kind: "mihrab" | "altar"; x: number; z: number };
  /** Rows of prayer mats (mosque) or pews (church): one entry per row at height z. */
  rows: readonly { z: number; xs: readonly number[] }[];
  columns: readonly (readonly [number, number])[];
  /** Where the visitor kneels to pray. */
  prayerSpot: readonly [number, number];
  /** Where the visitor enters the hall. */
  spawn: readonly [number, number];
  /** Where other worshippers stand or kneel. */
  congregation: readonly (readonly [number, number])[];
};

const MOSQUE_MAT_XS = [-4, -2, 0, 2, 4] as const;

export const WORSHIP_LAYOUTS: readonly WorshipLayout[] = [
  {
    slug: "osogbo-central-mosque",
    faith: "mosque",
    hall: { width: 16, depth: 14 },
    palette: {
      floor: "#d9c9a6",
      wall: "#f3ead4",
      carpet: "#2f6f4f",
      accent: "#1f6f5c",
      wood: "#8a5a32",
    },
    focal: { kind: "mihrab", x: 0, z: -6.4 },
    rows: [
      { z: -3.5, xs: MOSQUE_MAT_XS },
      { z: -1.5, xs: MOSQUE_MAT_XS },
      { z: 0.5, xs: MOSQUE_MAT_XS },
      { z: 2.5, xs: MOSQUE_MAT_XS },
    ],
    columns: [
      [-6.6, -4],
      [-6.6, 0],
      [-6.6, 4],
      [6.6, -4],
      [6.6, 0],
      [6.6, 4],
    ],
    prayerSpot: [0, 2.5],
    spawn: [0, 6],
    congregation: [
      [-2, 2.5],
      [2, 2.5],
      [-4, 0.5],
      [4, 0.5],
    ],
  },
  {
    slug: "osogbo-grand-mosque",
    faith: "mosque",
    hall: { width: 22, depth: 18 },
    palette: {
      floor: "#cfc0a0",
      wall: "#efe5cc",
      carpet: "#27447a",
      accent: "#c9a13b",
      wood: "#6d4a2b",
    },
    focal: { kind: "mihrab", x: 0, z: -8.4 },
    rows: [
      { z: -5, xs: [-8, -6, -4, -2, 0, 2, 4, 6, 8] },
      { z: -3, xs: [-8, -6, -4, -2, 0, 2, 4, 6, 8] },
      { z: -1, xs: [-8, -6, -4, -2, 0, 2, 4, 6, 8] },
      { z: 1, xs: [-8, -6, -4, -2, 0, 2, 4, 6, 8] },
      { z: 3, xs: [-8, -6, -4, -2, 0, 2, 4, 6, 8] },
      { z: 5, xs: [-8, -6, -4, -2, 0, 2, 4, 6, 8] },
    ],
    columns: [
      [-10, -6],
      [-10, -2],
      [-10, 2],
      [-10, 6],
      [10, -6],
      [10, -2],
      [10, 2],
      [10, 6],
    ],
    prayerSpot: [0, 5],
    spawn: [0, 8],
    congregation: [
      [-4, 3],
      [4, 3],
      [-6, -1],
      [6, -1],
      [-2, -3],
    ],
  },
  {
    slug: "oke-fia-community-church",
    faith: "church",
    hall: { width: 14, depth: 20 },
    palette: {
      floor: "#b89a6f",
      wall: "#f7f3ea",
      carpet: "#7a2e2e",
      accent: "#e8dcc0",
      wood: "#7b5a3a",
    },
    focal: { kind: "altar", x: 0, z: -8.4 },
    rows: [-6, -4, -2, 0, 2, 4, 6].map((z) => ({ z, xs: [-3.5, 3.5] })),
    columns: [
      [-6, -3],
      [-6, 3],
      [6, -3],
      [6, 3],
    ],
    prayerSpot: [0, 4],
    spawn: [0, 9],
    congregation: [
      [-3.5, -6],
      [3.5, -4],
      [-3.5, -2],
      [3.5, 2],
    ],
  },
];

export function getWorshipLayout(slug: string): WorshipLayout | null {
  return WORSHIP_LAYOUTS.find((layout) => layout.slug === slug) ?? null;
}

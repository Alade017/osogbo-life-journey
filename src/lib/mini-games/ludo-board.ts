/**
 * Ludo board geometry on a 15 by 15 grid. Everything is derived from one arm of the cross: the loop,
 * the home lanes and the yards are the same shape turned a quarter at a time. Colours map to arms in
 * COLOURS order (RED is arm 0), and the loop index is the engine's absolute tile. Pure: no React.
 *
 * Cells are [row, column]. Piece positions are continuous cell centres as { x, y }.
 */
import {
  FINISH_STEP,
  LAST_TRACK_STEP,
  YARD_STEP,
  absoluteTile,
  armOf,
  type Colour,
} from "./ludo-engine.ts";

export const BOARD_SIZE = 15;
const MID = (BOARD_SIZE - 1) / 2;
const EDGE = (BOARD_SIZE - 3) / 2;
const ARMS = 4;
const LOOP_LENGTH = 52;
/** The centre square: the 3x3 block at the middle of the board. */
export const CENTRE = { low: EDGE, size: BOARD_SIZE - 2 * EDGE };
const HOME_STEPS = 6;
const HOME_FIRST_STEP = LAST_TRACK_STEP + 1;

export type Cell = readonly [row: number, col: number];
export type Point = { x: number; y: number };

/** A quarter turn clockwise, on cell indices. */
function turnCell([row, col]: Cell): Cell {
  return [col, BOARD_SIZE - 1 - row];
}

/** A quarter turn clockwise, on continuous centres. */
function turnPoint({ x, y }: Point): Point {
  return { x: BOARD_SIZE - y, y: x };
}

function turnCellBy(cell: Cell, turns: number): Cell {
  let out = cell;
  for (let step = 0; step < ((turns % ARMS) + ARMS) % ARMS; step += 1) out = turnCell(out);
  return out;
}

function turnPointBy(point: Point, turns: number): Point {
  let out = point;
  for (let step = 0; step < ((turns % ARMS) + ARMS) % ARMS; step += 1) out = turnPoint(out);
  return out;
}

/** The track cells from one arm's start to the next, in order: a run along the arm's edge, then the tip. */
const ARM_TRACK: readonly Cell[] = [
  ...Array.from({ length: EDGE - 1 }, (_, index): Cell => [MID - 1, index + 1]),
  ...Array.from({ length: EDGE }, (_, index): Cell => [EDGE - 1 - index, EDGE]),
  [0, EDGE + 1],
  [0, EDGE + 2],
];

/** All loop squares in play order. Index 0 is the RED start. */
export const LOOP_CELLS: readonly Cell[] = Array.from({ length: ARMS }, (_, turns) =>
  ARM_TRACK.map((cell) => turnCellBy(cell, turns)),
).flat();

/** Home lane cells for an arm, from the outer end inward. */
export function homeLane(arm: number): readonly Cell[] {
  return Array.from({ length: HOME_STEPS }, (_, index) =>
    turnCellBy([MID, 1 + index] as const, arm),
  );
}

/** Yard centre for arm 0 is the bottom-left corner; other arms turn it. */
const YARD_CENTRE: Point = { x: EDGE / 2, y: BOARD_SIZE - EDGE / 2 };
const YARD_OFFSET = 1.25;
export const YARD_SLOTS: readonly Point[] = [
  { x: -YARD_OFFSET, y: -YARD_OFFSET },
  { x: YARD_OFFSET, y: -YARD_OFFSET },
  { x: YARD_OFFSET, y: YARD_OFFSET },
  { x: -YARD_OFFSET, y: YARD_OFFSET },
];

/** Where a token sits: its colour, its progress from the engine, and its index in the yard. */
export function tokenPoint(colour: Colour, step: number, token: number): Point {
  const arm = armOf(colour);
  if (step === YARD_STEP) {
    const slot = YARD_SLOTS[token % 4] ?? YARD_SLOTS[0]!;
    const centre = turnPointBy(YARD_CENTRE, arm);
    return { x: centre.x + slot.x, y: centre.y + slot.y };
  }
  if (step === FINISH_STEP) return { x: MID + 0.5, y: MID + 0.5 };
  if (step <= LAST_TRACK_STEP) {
    const [row, col] = LOOP_CELLS[absoluteTile(colour, step)] ?? LOOP_CELLS[0]!;
    return { x: col + 0.5, y: row + 0.5 };
  }
  const [row, col] = homeLane(arm)[step - HOME_FIRST_STEP] ?? homeLane(arm)[0]!;
  return { x: col + 0.5, y: row + 0.5 };
}

/** Yard rectangles, one per arm: a 6-cell square in the corner beside the arm. */
export function yardRect(arm: number): { x: number; y: number; size: number } {
  const corner = turnPointBy(YARD_CENTRE, arm);
  const size = EDGE;
  return { x: corner.x - size / 2, y: corner.y - size / 2, size };
}

/** The centre square's four triangles, one per arm, as polygon points "x,y x,y x,y". */
export function centreTriangle(arm: number): string {
  const low = EDGE;
  const high = BOARD_SIZE - EDGE;
  const mid = MID + 0.5;
  const edges: readonly (readonly [Point, Point])[] = [
    [
      { x: low, y: low },
      { x: low, y: high },
    ],
    [
      { x: low, y: low },
      { x: high, y: low },
    ],
    [
      { x: high, y: low },
      { x: high, y: high },
    ],
    [
      { x: low, y: high },
      { x: high, y: high },
    ],
  ];
  const [a, b] = edges[((arm % ARMS) + ARMS) % ARMS]!;
  return [a, b, { x: mid, y: mid }].map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * One step of the hop animation. A token moves one tile at a time toward its target, so it visibly
 * walks the path. Leaving the yard or being sent home snaps, because there is no path between.
 */
export function hopStep(shown: number, target: number): number {
  if (shown === target) return shown;
  if (target === YARD_STEP || shown === YARD_STEP) return target;
  return shown < target ? shown + 1 : shown - 1;
}

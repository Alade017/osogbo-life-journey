/**
 * Ludo board geometry. Everything is derived from one arm of the cross: the loop, the home
 * lanes and the yards are the same shape turned a quarter at a time. Pure: no React.
 *
 * Coordinates are board cells as [row, column] on a BOARD_SIZE grid. Piece positions are
 * continuous cell centres as { x, y } in board units, so drawing code can place them directly.
 */
import { BASE, FINISHED, LOOP_LENGTH, absoluteSquare, startOffset } from "./ludo";

export const BOARD_SIZE = 15;
const MID = (BOARD_SIZE - 1) / 2;
const EDGE = (BOARD_SIZE - 3) / 2;
const ARMS = 4;
/** The centre square: the 3x3 block at the middle of the board. */
export const CENTRE = { low: EDGE, size: BOARD_SIZE - 2 * EDGE };
const ARM_STEPS = LOOP_LENGTH / ARMS;
const HOME_STEPS = 6;

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

/** All loop squares in play order. Square 0 is the first arm's start. */
export const LOOP_CELLS: readonly Cell[] = Array.from({ length: ARMS }, (_, turns) =>
  ARM_TRACK.map((cell) => turnCellBy(cell, turns)),
).flat();

/** A player's arm: the start square of player p, as a quarter turn of the board. */
export function armFor(player: number, playerCount: number): number {
  return Math.round(startOffset(player, playerCount) / ARM_STEPS) % ARMS;
}

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

/** Where a player's token sits. `token` picks the yard slot while the token is in base. */
export function tokenPoint(
  player: number,
  playerCount: number,
  progress: number,
  token: number,
): Point {
  const arm = armFor(player, playerCount);
  if (progress === BASE) {
    const slot = YARD_SLOTS[token % 4] ?? YARD_SLOTS[0]!;
    const centre = turnPointBy(YARD_CENTRE, arm);
    return { x: centre.x + slot.x, y: centre.y + slot.y };
  }
  if (progress === FINISHED) return { x: MID + 0.5, y: MID + 0.5 };
  if (progress <= LOOP_LENGTH - 2) {
    const [row, col] = LOOP_CELLS[absoluteSquare(player, progress, playerCount)] ?? LOOP_CELLS[0]!;
    return { x: col + 0.5, y: row + 0.5 };
  }
  const [row, col] = homeLane(arm)[progress - (LOOP_LENGTH - 1)] ?? homeLane(arm)[0]!;
  return { x: col + 0.5, y: row + 0.5 };
}

/** Yard rectangles, one per arm: a 6-cell square in the corner beside the arm. */
export function yardRect(arm: number): { x: number; y: number; size: number } {
  const corner = turnPointBy(YARD_CENTRE, arm);
  const size = EDGE;
  return { x: corner.x - size / 2, y: corner.y - size / 2, size };
}

export function loopCentre(square: number): Point {
  const [row, col] =
    LOOP_CELLS[((square % LOOP_LENGTH) + LOOP_LENGTH) % LOOP_LENGTH] ?? LOOP_CELLS[0]!;
  return { x: col + 0.5, y: row + 0.5 };
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

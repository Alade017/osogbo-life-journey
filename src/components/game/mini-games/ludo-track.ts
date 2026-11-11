import { CLEARED, TRACK_LAST, YARD, loopSquare } from "@/lib/mini-games/ludo";

/** A cell of the 15 by 15 board, rows and columns counted from 1. */
export type Cell = { row: number; col: number };

/** House colours: red (top), green (right), yellow (bottom), blue (left). */
export const HOUSE_COLOURS = ["#e5484d", "#22a06b", "#f5b82e", "#3b82f6"] as const;
/** A darker edge for each house's pawns. */
export const HOUSE_EDGE = ["#8f1d21", "#12613b", "#9a6a00", "#1d4fae"] as const;

function line(r0: number, c0: number, r1: number, c1: number): Cell[] {
  const cells: Cell[] = [];
  const dr = Math.sign(r1 - r0);
  const dc = Math.sign(c1 - c0);
  let row = r0;
  let col = c0;
  for (;;) {
    cells.push({ row, col });
    if (row === r1 && col === c1) break;
    row += dr;
    col += dc;
  }
  return cells;
}

/**
 * The 52 track cells, clockwise from the top arm's tip. Each arm is 13 cells: two 6-cell lanes
 * and the tip. Square 0 is red's start, 13 green's, 26 yellow's and 39 blue's.
 */
export const TRACK_CELLS: readonly Cell[] = [
  ...line(1, 8, 1, 8),
  ...line(1, 9, 6, 9),
  ...line(7, 10, 7, 15),
  ...line(8, 15, 8, 15),
  ...line(9, 15, 9, 10),
  ...line(10, 9, 15, 9),
  ...line(15, 8, 15, 8),
  ...line(15, 7, 10, 7),
  ...line(9, 6, 9, 1),
  ...line(8, 1, 8, 1),
  ...line(7, 1, 7, 6),
  ...line(6, 7, 1, 7),
];

/** Each house's six home-stretch cells, from the entrance to the centre. Progress 52 to 57. */
export const HOME_CELLS: readonly (readonly Cell[])[] = [
  line(2, 8, 7, 8),
  line(8, 14, 8, 9),
  line(14, 8, 9, 8),
  line(8, 2, 8, 7),
];

export const CENTRE_CELL: Cell = { row: 8, col: 8 };

/** The four seats in each yard, in token order. */
export const YARD_SEATS: readonly (readonly Cell[])[] = [
  [
    { row: 2, col: 2 },
    { row: 2, col: 5 },
    { row: 5, col: 2 },
    { row: 5, col: 5 },
  ],
  [
    { row: 2, col: 11 },
    { row: 2, col: 14 },
    { row: 5, col: 11 },
    { row: 5, col: 14 },
  ],
  [
    { row: 11, col: 11 },
    { row: 11, col: 14 },
    { row: 14, col: 11 },
    { row: 14, col: 14 },
  ],
  [
    { row: 11, col: 2 },
    { row: 11, col: 5 },
    { row: 14, col: 2 },
    { row: 14, col: 5 },
  ],
];

/** The top-left cell of each yard's 6 by 6 block. */
export const YARD_BLOCKS: readonly Cell[] = [
  { row: 1, col: 1 },
  { row: 1, col: 10 },
  { row: 10, col: 10 },
  { row: 10, col: 1 },
];

/** Centre of a cell as percentages of the board. */
export function cellCentre(cell: Cell) {
  return { left: ((cell.col - 0.5) / 15) * 100, top: ((cell.row - 0.5) / 15) * 100 };
}

/** The cell a seed stands on, for its progress. */
export function seedCell(house: number, token: number, progress: number): Cell {
  if (progress === YARD) return YARD_SEATS[house]?.[token] ?? CENTRE_CELL;
  if (progress === CLEARED) return CENTRE_CELL;
  if (progress <= TRACK_LAST) return TRACK_CELLS[loopSquare(house, progress)] ?? CENTRE_CELL;
  return HOME_CELLS[house]?.[progress - (TRACK_LAST + 1)] ?? CENTRE_CELL;
}

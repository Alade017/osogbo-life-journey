import {
  CLEARED,
  HOUSE_START,
  LOOP_LENGTH,
  TRACK_LAST,
  YARD,
  loopSquare,
} from "@/lib/mini-games/ludo";

/** House colours: red (top), green (right), yellow (bottom), blue (left). */
export const HOUSE_COLOURS = ["#e5484d", "#22a06b", "#f5b82e", "#3b82f6"] as const;
/** A darker edge for each house's pawns. */
export const HOUSE_EDGE = ["#8f1d21", "#12613b", "#9a6a00", "#1d4fae"] as const;
/** Yard centres on the 0..100 board: one in each corner. */
export const YARD_CENTRES = [
  [27, 27],
  [73, 27],
  [73, 73],
  [27, 73],
] as const;

const INSET = 6;
const SIDE = 88;
const PERIMETER = SIDE * 4;
const TOP_MIDDLE = SIDE / 2;
const CENTRE = 50;
/** Where a cleared seed rests in its house's triangle of the centre. */
const CLEARED_NUDGE = [
  [0, -6],
  [6, 0],
  [0, 6],
  [-6, 0],
] as const;

/**
 * A loop square on the square track. The 52 squares are spaced evenly round the perimeter, square 0
 * on the top middle and running clockwise, so each house's start is a middle of one side.
 */
export function ringPoint(index: number) {
  const along = (TOP_MIDDLE + (index * PERIMETER) / LOOP_LENGTH) % PERIMETER;
  if (along < SIDE) return { x: INSET + along, y: INSET };
  if (along < 2 * SIDE) return { x: INSET + SIDE, y: INSET + (along - SIDE) };
  if (along < 3 * SIDE) return { x: INSET + SIDE - (along - 2 * SIDE), y: INSET + SIDE };
  return { x: INSET, y: INSET + SIDE - (along - 3 * SIDE) };
}

/** Where a yard seat sits, for the seed in that yard token slot. */
export function seatPoint(house: number, token: number) {
  const [cx, cy] = YARD_CENTRES[house] ?? [CENTRE, CENTRE];
  return { x: cx + (token % 2 === 1 ? 6 : -6), y: cy + (token < 2 ? -6 : 6) };
}

/** The centre point of a square, home-column step or cleared place for a seed's progress. */
export function squarePoint(house: number, progress: number) {
  if (progress === CLEARED) {
    const [dx, dy] = CLEARED_NUDGE[house] ?? [0, 0];
    return { x: CENTRE + dx, y: CENTRE + dy };
  }
  if (progress <= TRACK_LAST) return ringPoint(loopSquare(house, progress));
  // The home column runs from the house's start square toward the centre.
  const start = ringPoint(HOUSE_START[house] ?? 0);
  const t = (progress - TRACK_LAST) / (CLEARED - TRACK_LAST);
  return { x: start.x + (CENTRE - start.x) * t, y: start.y + (CENTRE - start.y) * t };
}

/** Where a seed is drawn. Seeds sharing a square are nudged apart by their token. */
export function seedPosition(house: number, token: number, progress: number) {
  if (progress === YARD) return seatPoint(house, token);
  const base = squarePoint(house, progress);
  const spread = progress === CLEARED ? 3.2 : 2.6;
  return {
    x: base.x + ((token % 2) - 0.5) * spread,
    y: base.y + (Math.floor(token / 2) - 0.5) * spread,
  };
}

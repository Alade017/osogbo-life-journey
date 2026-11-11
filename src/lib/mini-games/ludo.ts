/**
 * Ludo rules for one player against the computer, in two setups:
 * - single house: each side has four seeds, one house each (red v yellow);
 * - double house: each side has two opposite houses and eight seeds (red and yellow v green and blue).
 *
 * A seed progresses 0..58 steps: 0 is its starting square, 0..51 run round the 52-square track,
 * 52..57 are its home column and 58 is the centre. A seed that reaches the centre, or that captures
 * an opponent, is cleared. A side wins by clearing all of its seeds.
 *
 * Dice: both dice are always played if any play uses them (mandatory). Each die moves a seed on its
 * own, or both dice together move one seed. A seed leaves the yard only on a six. A roll of 6-6
 * gives a bonus turn. Pure: no React, no network.
 */

export const LOOP_LENGTH = 52;
/** Last track step (0..51, the whole loop) before a seed turns into its home column. */
export const TRACK_LAST = 51;
/** The centre: the progress of a cleared seed. */
export const CLEARED = 58;
/** A seed in its yard, waiting for a six. */
export const YARD = -1;
export const HOUSE_COUNT = 4;
/** Loop square where each house's step 0 lies (houses 0..3 are red, green, yellow, blue). */
export const HOUSE_START = [0, 13, 26, 39] as const;
/** Star squares: each house's start and four mid-track refuges. Seeds here cannot be captured. */
export const SAFE_SQUARES = [0, 13, 16, 23, 26, 39, 42, 49] as const;
export function isSafeSquare(square: number) {
  return (SAFE_SQUARES as readonly number[]).includes(square);
}
export const HOUSE_NAMES = ["Red", "Green", "Yellow", "Blue"] as const;
const SEEDS_PER_HOUSE = 4;

export type LudoMode = 1 | 2;

export type LudoState = {
  mode: LudoMode;
  /** Progress of every seed: [house][token], YARD, 0..55 on the path, or CLEARED. */
  seeds: number[][];
  /** Side to move: 0 is the player, 1 is the computer. */
  turn: number;
  /** Dice still to be played this turn; null while the side is waiting to roll. */
  pending: number[] | null;
  lastRoll: [number, number] | null;
  winner: number | null;
};

export type LudoMove = {
  house: number;
  token: number;
  from: number;
  to: number;
  /** Indices into the pending dice this move uses: one for a single die, both for a combined move. */
  uses: number[];
};

/** The houses a side controls in the chosen setup. */
export function housesFor(mode: LudoMode, side: number): readonly number[] {
  if (mode === 1) return side === 0 ? [0] : [2];
  return side === 0 ? [0, 2] : [1, 3];
}

export function seedsPerSide(mode: LudoMode) {
  return housesFor(mode, 0).length * SEEDS_PER_HOUSE;
}

export function newLudo(mode: LudoMode = 1): LudoState {
  return {
    mode,
    seeds: Array.from({ length: HOUSE_COUNT }, () => Array(SEEDS_PER_HOUSE).fill(YARD) as number[]),
    turn: 0,
    pending: null,
    lastRoll: null,
    winner: null,
  };
}

/** The loop square a seed stands on, for progress 0..50. */
export function loopSquare(house: number, progress: number) {
  return (HOUSE_START[house]! + progress) % LOOP_LENGTH;
}

function winnerOf(state: LudoState): number | null {
  for (let side = 0; side < 2; side += 1) {
    const cleared = housesFor(state.mode, side).every((house) =>
      (state.seeds[house] ?? []).every((progress) => progress === CLEARED),
    );
    if (cleared) return side;
  }
  return null;
}

/**
 * The seeds after a move: the mover's seed lands, and any opponent seed on that loop square goes
 * back to its yard. The mover's seed is then cleared, so a capture scores the seed that made it.
 */
function applySeeds(state: LudoState, move: LudoMove): number[][] {
  const seeds = state.seeds.map((row) => [...row]);
  seeds[move.house]![move.token] = move.to;
  if (move.to < 0 || move.to > TRACK_LAST) return seeds;
  const square = loopSquare(move.house, move.to);
  // Star squares are safe: opponents can share them, and nothing is captured there.
  if (isSafeSquare(square)) return seeds;
  let captured = false;
  for (const house of housesFor(state.mode, 1 - state.turn)) {
    const row = seeds[house];
    if (!row) continue;
    row.forEach((progress, token) => {
      if (progress >= 0 && progress <= TRACK_LAST && loopSquare(house, progress) === square) {
        row[token] = YARD;
        captured = true;
      }
    });
  }
  // The capturing seed is removed from the board and scored.
  if (captured) seeds[move.house]![move.token] = CLEARED;
  return seeds;
}

/** Every move the dice allow for the side to move, before the mandatory-play filter. */
function candidateMoves(state: LudoState, pending: readonly number[]): LudoMove[] {
  const moves: LudoMove[] = [];
  for (const house of housesFor(state.mode, state.turn)) {
    (state.seeds[house] ?? []).forEach((from, token) => {
      if (from === CLEARED) return;
      pending.forEach((die, index) => {
        if (from === YARD) {
          if (die === 6) moves.push({ house, token, from, to: 0, uses: [index] });
          return;
        }
        if (from + die <= CLEARED) {
          moves.push({ house, token, from, to: from + die, uses: [index] });
        }
      });
      // Both dice on one seed: it moves their sum and lands once, at the end.
      if (from !== YARD && pending.length === 2) {
        const sum = (pending[0] ?? 0) + (pending[1] ?? 0);
        if (from + sum <= CLEARED) {
          moves.push({ house, token, from, to: from + sum, uses: [0, 1] });
        }
      }
    });
  }
  return moves;
}

/** The most dice that can still be played from this position. */
function playable(state: LudoState, pending: readonly number[]): number {
  if (pending.length === 0) return 0;
  let best = 0;
  for (const move of candidateMoves(state, pending)) {
    const rest = pending.filter((_, index) => !move.uses.includes(index));
    const next = { ...state, seeds: applySeeds(state, move) };
    best = Math.max(best, move.uses.length + playable(next, rest));
  }
  return best;
}

export function sameMove(a: LudoMove, b: LudoMove) {
  return (
    a.house === b.house && a.token === b.token && a.to === b.to && a.uses.join() === b.uses.join()
  );
}

/**
 * The moves the side to move may make now. Mandatory play: only moves that use the most dice are
 * offered, so a die is never skipped when it could be played.
 */
export function legalMoves(state: LudoState): LudoMove[] {
  if (state.winner !== null || state.pending === null || state.pending.length === 0) return [];
  const pending = state.pending;
  const scored = candidateMoves(state, pending).map((move) => {
    const rest = pending.filter((_, index) => !move.uses.includes(index));
    const next = { ...state, seeds: applySeeds(state, move) };
    return { move, score: move.uses.length + playable(next, rest) };
  });
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  if (best === 0) return [];
  const seen = new Set<string>();
  const moves: LudoMove[] = [];
  for (const { move, score } of scored) {
    if (score !== best) continue;
    // Two sixes bring out two seeds the same way, so keep one of each.
    const key = `${move.house}-${move.token}-${move.to}-${move.uses.map((i) => pending[i]).join()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    moves.push(move);
  }
  return moves;
}

/** Ends the turn once no dice are left or none can be played; a 6-6 keeps the same side on. */
function settle(state: LudoState): LudoState {
  const winner = winnerOf(state);
  if (winner !== null) return { ...state, winner, pending: null };
  if (state.pending !== null && state.pending.length > 0 && legalMoves(state).length > 0) {
    return state;
  }
  const bonus = state.lastRoll !== null && state.lastRoll[0] === 6 && state.lastRoll[1] === 6;
  return { ...state, pending: null, turn: bonus ? state.turn : 1 - state.turn };
}

/** Rolls the two dice for the side to move. A roll with no legal play passes the turn. */
export function rollLudo(state: LudoState, first: number, second: number): LudoState {
  if (state.winner !== null || state.pending !== null) return state;
  const a = Math.min(6, Math.max(1, Math.floor(first)));
  const b = Math.min(6, Math.max(1, Math.floor(second)));
  return settle({ ...state, pending: [a, b], lastRoll: [a, b] });
}

/** Plays one legal move. Returns the same state if the move is not one the dice allow. */
export function moveLudoSeed(state: LudoState, move: LudoMove): LudoState {
  if (!legalMoves(state).some((legal) => sameMove(legal, move))) return state;
  const pending = (state.pending ?? []).filter((_, index) => !move.uses.includes(index));
  return settle({ ...state, seeds: applySeeds(state, move), pending });
}

/** Computer choice: clear a seed, capture, bring one out, reach the home column, and avoid danger. */
export function bestLudoMove(state: LudoState): LudoMove | null {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  const rivals: number[] = [];
  for (const house of housesFor(state.mode, 1 - state.turn)) {
    (state.seeds[house] ?? []).forEach((progress) => {
      if (progress >= 0 && progress <= TRACK_LAST) rivals.push(loopSquare(house, progress));
    });
  }
  const score = (move: LudoMove) => {
    let value = move.to / 100;
    if (move.to === CLEARED) value += 10;
    if (move.to >= 0 && move.to <= TRACK_LAST) {
      const square = loopSquare(move.house, move.to);
      if (rivals.includes(square) && !isSafeSquare(square)) value += 8;
      // A rival square 1..6 steps behind can land on this seed next turn.
      const exposed = rivals.some((rival) => {
        const gap = (square - rival + LOOP_LENGTH) % LOOP_LENGTH;
        return gap >= 1 && gap <= 6;
      });
      if (exposed && !isSafeSquare(square)) value -= 3;
    }
    if (move.from === YARD) value += 4;
    if (move.to > TRACK_LAST && move.to < CLEARED) value += 3;
    return value;
  };
  return moves.reduce((best, move) => (score(move) > score(best) ? move : best));
}

/** Ends the side's turn now, for the rare case the computer has nothing it can play. */
export function passLudoTurn(state: LudoState): LudoState {
  return { ...state, pending: null, turn: 1 - state.turn };
}

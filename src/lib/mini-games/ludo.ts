/**
 * Ludo on the four-arm board. Each seat has four tokens and takes a turn in seat order. A turn rolls
 * two dice. Each die is played on one token, in either order. A six brings a token out and, when the
 * turn is over, gives the same seat another roll. Landing on an opponent on a shared square sends it
 * back, except on safe squares. A token finishes by reaching the centre exactly.
 *
 * A two-player game uses all four seats: the human takes seats 0 and 2 and the computer takes 1 and 3,
 * so each side plays two colours. Pure: no React, no network.
 */
export const LOOP_LENGTH = 52;
/** Progress: -1 in base, 0..50 on the shared loop, 51..56 home lane, 57 finished. */
export const BASE = -1;
export const FINISHED = 57;
const LOOP_MAX = 50;
const SEAT_LIMIT = 4;
const ROLL_SIX = 6;
/** Fixed safe squares on the loop: the start squares and the star squares. */
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export type LudoState = {
  /** Seats on the board, 2 to 4. */
  playerCount: number;
  /** Seats the human controls. */
  humans: number[];
  tokens: number[][];
  turn: number;
  /** The two dice of the current roll, or null before the seat rolls. */
  dice: [number, number] | null;
  /** Which of the two dice have been played this turn. */
  used: [boolean, boolean];
  /** Whether a six has been played this turn, which gives the seat another roll. */
  sixPlayed: boolean;
  winner: number | null;
};

export type LudoMove = { token: number; die: 0 | 1 };

function tokenAt(tokens: readonly (readonly number[])[], player: number, token: number): number {
  return tokens[player]?.[token] ?? BASE;
}

/** Creates a game. Pass `humans` to choose which seats the human plays; the rest are computer seats. */
export function newLudo(seats: number, humans: readonly number[] = [0]): LudoState {
  const count = Math.min(SEAT_LIMIT, Math.max(2, Math.floor(seats)));
  return {
    playerCount: count,
    humans: humans.filter((seat) => seat >= 0 && seat < count),
    tokens: Array.from({ length: count }, () => [BASE, BASE, BASE, BASE]),
    turn: 0,
    dice: null,
    used: [false, false],
    sixPlayed: false,
    winner: null,
  };
}

/** Seats for the usual modes: two players split the four colours, three and four take one each. */
export function seatsForPlayers(players: number): { seats: number; humans: number[] } {
  if (players === 2) return { seats: 4, humans: [0, 2] };
  return { seats: Math.min(SEAT_LIMIT, Math.max(2, players)), humans: [0] };
}

export function isHumanSeat(state: Pick<LudoState, "humans">, seat: number): boolean {
  return state.humans.includes(seat);
}

/** Absolute loop square for a player's token progress (0..50). */
export function startOffset(player: number, playerCount: number) {
  return Math.round((player * LOOP_LENGTH) / playerCount);
}

export function absoluteSquare(player: number, progress: number, playerCount: number) {
  return (startOffset(player, playerCount) + progress) % LOOP_LENGTH;
}

export function isSafeSquare(square: number) {
  return SAFE_SQUARES.has(square);
}

function canMove(progress: number, value: number): boolean {
  if (progress === FINISHED) return false;
  if (progress === BASE) return value === ROLL_SIX;
  return progress + value <= FINISHED;
}

/** Token indices the current seat may move with a die of this value. */
export function legalTokenMoves(state: LudoState, value: number): number[] {
  if (state.winner !== null) return [];
  return (state.tokens[state.turn] ?? [])
    .map((progress, token) => ({ progress, token }))
    .filter(({ progress }) => canMove(progress, value))
    .map(({ token }) => token);
}

/** Every legal move for the unused dice of the current roll. */
export function legalMoves(state: LudoState): LudoMove[] {
  if (state.winner !== null || state.dice === null) return [];
  const moves: LudoMove[] = [];
  for (const die of [0, 1] as const) {
    if (state.used[die]) continue;
    const value = state.dice[die];
    for (const token of legalTokenMoves(state, value)) moves.push({ token, die });
  }
  return moves;
}

function nextSeat(state: LudoState): number {
  return (state.turn + 1) % state.playerCount;
}

/** Ends the turn when nothing more can be played. A six gives the same seat another roll. */
function settle(state: LudoState): LudoState {
  if (state.winner !== null || state.dice === null) return state;
  const playedOut = state.used[0] && state.used[1];
  const stuck = legalMoves(state).length === 0;
  if (!playedOut && !stuck) return state;
  if (state.sixPlayed) return { ...state, dice: null, used: [false, false], sixPlayed: false };
  return {
    ...state,
    dice: null,
    used: [false, false],
    sixPlayed: false,
    turn: nextSeat(state),
  };
}

/** Rolls the two dice for the current seat. Returns the same state if the seat has already rolled. */
export function rollLudo(state: LudoState, first: number, second: number): LudoState {
  if (state.winner !== null || state.dice !== null) return state;
  const clamp = (value: number) => Math.min(6, Math.max(1, Math.floor(value)));
  const next: LudoState = {
    ...state,
    dice: [clamp(first), clamp(second)],
    used: [false, false],
    sixPlayed: false,
  };
  return settle(next);
}

/**
 * Moves a token with one of the two dice. Without `die`, the first unused die that fits is used.
 * Returns the same state if the move is not legal.
 */
export function moveLudoToken(state: LudoState, token: number, die?: 0 | 1): LudoState {
  const move = legalMoves(state).find(
    (item) => item.token === token && (die === undefined || item.die === die),
  );
  if (!state.dice || !move) return state;
  const value = state.dice[move.die];
  const tokens = state.tokens.map((row) => [...row]);
  const player = state.turn;
  const current = tokenAt(tokens, player, token);
  const progress = current === BASE ? 0 : current + value;
  const playerTokens = tokens[player];
  if (playerTokens) playerTokens[token] = progress;

  if (progress <= LOOP_MAX && !isSafeSquare(absoluteSquare(player, progress, state.playerCount))) {
    const square = absoluteSquare(player, progress, state.playerCount);
    tokens.forEach((others, other) => {
      if (other === player) return;
      others.forEach((otherProgress, otherToken) => {
        if (
          otherProgress >= 0 &&
          otherProgress <= LOOP_MAX &&
          absoluteSquare(other, otherProgress, state.playerCount) === square
        ) {
          others[otherToken] = BASE;
        }
      });
    });
  }

  const used: [boolean, boolean] = [...state.used];
  used[move.die] = true;
  const next: LudoState = {
    ...state,
    tokens,
    used,
    sixPlayed: state.sixPlayed || value === ROLL_SIX,
  };
  if ((tokens[player] ?? []).every((item) => item === FINISHED)) {
    return { ...next, dice: null, used: [false, false], sixPlayed: false, winner: player };
  }
  return settle(next);
}

/** Computer choice: finish, capture, leave base, then the furthest token. */
export function bestLudoMove(state: LudoState): LudoMove | null {
  const options = legalMoves(state);
  if (!state.dice || !options.length) return null;
  const score = (move: LudoMove) => {
    const value = state.dice?.[move.die] ?? 0;
    const progress = tokenAt(state.tokens, state.turn, move.token);
    const next = progress === BASE ? 0 : progress + value;
    let points = 0;
    if (next === FINISHED) points += 10;
    if (progress === BASE) points += 4;
    if (next <= LOOP_MAX && !isSafeSquare(absoluteSquare(state.turn, next, state.playerCount))) {
      const square = absoluteSquare(state.turn, next, state.playerCount);
      const captures = state.tokens.some(
        (others, other) =>
          other !== state.turn &&
          others.some(
            (item) =>
              item >= 0 &&
              item <= LOOP_MAX &&
              absoluteSquare(other, item, state.playerCount) === square,
          ),
      );
      if (captures) points += 6;
    }
    return points + (progress === BASE ? 0 : progress) / 100;
  };
  return options.reduce((best, move) => (score(move) > score(best) ? move : best));
}

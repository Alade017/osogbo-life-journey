/**
 * Ludo for 2 to 4 players. Each player has four tokens. A six brings a token out and gives another
 * roll. Landing on an opponent on a shared square sends it back, except on safe squares. A token
 * finishes by reaching the centre exactly. Pure: no React, no network.
 */
export const LOOP_LENGTH = 52;
/** Progress: -1 in base, 0..50 on the shared loop, 51..56 home lane, 57 finished. */
export const BASE = -1;
export const FINISHED = 57;
const LOOP_STEPS = 51;
/** Fixed safe squares on the loop: the start squares and the star squares. */
const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export type LudoState = {
  playerCount: number;
  tokens: number[][];
  turn: number;
  dice: number | null;
  winner: number | null;
};

function tokenAt(tokens: readonly (readonly number[])[], player: number, token: number): number {
  return tokens[player]?.[token] ?? BASE;
}

export function newLudo(playerCount: number): LudoState {
  const count = Math.min(4, Math.max(2, playerCount));
  return {
    playerCount: count,
    tokens: Array.from({ length: count }, () => [BASE, BASE, BASE, BASE]),
    turn: 0,
    dice: null,
    winner: null,
  };
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

/** Token indices the player may move with this die value. */
export function legalTokenMoves(state: LudoState, dice: number): number[] {
  if (state.winner !== null) return [];
  return (state.tokens[state.turn] ?? [])
    .map((progress, token) => ({ progress, token }))
    .filter(({ progress }) => {
      if (progress === FINISHED) return false;
      if (progress === BASE) return dice === 6;
      return progress + dice <= FINISHED;
    })
    .map(({ token }) => token);
}

export function rollLudo(state: LudoState, roll: number): LudoState {
  if (state.winner !== null || state.dice !== null) return state;
  const dice = Math.min(6, Math.max(1, Math.floor(roll)));
  const next = { ...state, dice };
  if (legalTokenMoves(next, dice).length === 0) {
    return { ...next, dice: null, turn: (state.turn + 1) % state.playerCount };
  }
  return next;
}

/** Moves a token by the rolled die. Returns the same state if the move is not legal. */
export function moveLudoToken(state: LudoState, token: number): LudoState {
  if (state.dice === null || !legalTokenMoves(state, state.dice).includes(token)) return state;
  const dice = state.dice;
  const tokens = state.tokens.map((row) => [...row]);
  const player = state.turn;
  const current = tokenAt(tokens, player, token);
  const progress = current === BASE ? 0 : current + dice;
  const playerTokens = tokens[player];
  if (playerTokens) playerTokens[token] = progress;

  if (progress <= 50 && !isSafeSquare(absoluteSquare(player, progress, state.playerCount))) {
    const square = absoluteSquare(player, progress, state.playerCount);
    tokens.forEach((others, other) => {
      if (other === player) return;
      others.forEach((otherProgress, otherToken) => {
        if (
          otherProgress >= 0 &&
          otherProgress <= 50 &&
          absoluteSquare(other, otherProgress, state.playerCount) === square
        ) {
          others[otherToken] = BASE;
        }
      });
    });
  }

  const finished = (tokens[player] ?? []).every((value) => value === FINISHED);
  if (finished) return { ...state, tokens, dice: null, winner: player };
  const extraTurn = dice === 6;
  return {
    ...state,
    tokens,
    dice: null,
    turn: extraTurn ? player : (player + 1) % state.playerCount,
  };
}

/** Computer choice: finish, capture, leave base, then the furthest token. */
export function bestLudoToken(state: LudoState): number | null {
  if (state.dice === null) return null;
  const options = legalTokenMoves(state, state.dice);
  if (!options.length) return null;
  const value = (token: number) => {
    const progress = tokenAt(state.tokens, state.turn, token);
    const next = progress === BASE ? 0 : progress + (state.dice ?? 0);
    let score = 0;
    if (next === FINISHED) score += 10;
    if (progress === BASE) score += 4;
    if (next <= 50 && !isSafeSquare(absoluteSquare(state.turn, next, state.playerCount))) {
      const square = absoluteSquare(state.turn, next, state.playerCount);
      const captures = state.tokens.some(
        (others, other) =>
          other !== state.turn &&
          others.some(
            (value) =>
              value >= 0 &&
              value <= 50 &&
              absoluteSquare(other, value, state.playerCount) === square,
          ),
      );
      if (captures) score += 6;
    }
    return score + (progress === BASE ? 0 : progress) / 100;
  };
  return options.reduce((best, token) => (value(token) > value(best) ? token : best));
}

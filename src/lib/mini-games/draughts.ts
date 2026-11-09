/**
 * English draughts on an 8x8 board. Captures are mandatory, a man promotes to king on the far row,
 * and a game with 40 plies and no capture is drawn. Pure: no React, no network.
 */
export type Side = "light" | "dark";
export type Piece = { side: Side; king: boolean };
export type Square = Piece | null;
export type DraughtsMove = {
  from: [number, number];
  to: [number, number];
  captured: [number, number] | null;
};
export type DraughtsState = {
  board: Square[][];
  turn: Side;
  quietPlies: number;
  winner: Side | "draw" | null;
};

const SIZE = 8;
const DRAW_AFTER_QUIET_PLIES = 40;

export function newDraughts(): DraughtsState {
  const board: Square[][] = Array.from({ length: SIZE }, () => Array<Square>(SIZE).fill(null));
  for (let row = 0; row < SIZE; row += 1) {
    for (let col = 0; col < SIZE; col += 1) {
      if ((row + col) % 2 === 0) continue;
      if (row < 3) setSquare(board, row, col, { side: "dark", king: false });
      if (row > 4) setSquare(board, row, col, { side: "light", king: false });
    }
  }
  return { board, turn: "light", quietPlies: 0, winner: null };
}

const inside = (row: number, col: number) => row >= 0 && row < SIZE && col >= 0 && col < SIZE;

function squareAt(board: readonly (readonly Square[])[], row: number, col: number): Square {
  return board[row]?.[col] ?? null;
}

function setSquare(board: Square[][], row: number, col: number, value: Square) {
  const line = board[row];
  if (line) line[col] = value;
}

function directionsFor(piece: Piece): [number, number][] {
  if (piece.king)
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1],
    ];
  return piece.side === "light"
    ? [
        [-1, -1],
        [-1, 1],
      ]
    : [
        [1, -1],
        [1, 1],
      ];
}

/** Legal moves for the side to move. If any capture exists, only captures are legal. */
export function legalDraughtsMoves(state: DraughtsState): DraughtsMove[] {
  if (state.winner) return [];
  const captures: DraughtsMove[] = [];
  const steps: DraughtsMove[] = [];
  state.board.forEach((rowCells, row) =>
    rowCells.forEach((piece, col) => {
      if (!piece || piece.side !== state.turn) return;
      for (const [dr, dc] of directionsFor(piece)) {
        const r1 = row + dr;
        const c1 = col + dc;
        if (!inside(r1, c1)) continue;
        const target = squareAt(state.board, r1, c1);
        if (!target) {
          steps.push({ from: [row, col], to: [r1, c1], captured: null });
          continue;
        }
        const r2 = r1 + dr;
        const c2 = c1 + dc;
        if (target.side !== piece.side && inside(r2, c2) && !squareAt(state.board, r2, c2)) {
          captures.push({ from: [row, col], to: [r2, c2], captured: [r1, c1] });
        }
      }
    }),
  );
  return captures.length ? captures : steps;
}

/** Applies a legal move. Returns the same state if the move is not legal. */
export function playDraughts(state: DraughtsState, move: DraughtsMove): DraughtsState {
  const legal = legalDraughtsMoves(state).find(
    (candidate) =>
      candidate.from[0] === move.from[0] &&
      candidate.from[1] === move.from[1] &&
      candidate.to[0] === move.to[0] &&
      candidate.to[1] === move.to[1],
  );
  if (!legal) return state;
  const board = state.board.map((row) => [...row]);
  const piece = squareAt(board, legal.from[0], legal.from[1]);
  if (!piece) return state;
  setSquare(board, legal.from[0], legal.from[1], null);
  if (legal.captured) setSquare(board, legal.captured[0], legal.captured[1], null);
  const promote =
    !piece.king &&
    ((piece.side === "light" && legal.to[0] === 0) ||
      (piece.side === "dark" && legal.to[0] === SIZE - 1));
  setSquare(board, legal.to[0], legal.to[1], promote ? { ...piece, king: true } : piece);

  const next: Side = state.turn === "light" ? "dark" : "light";
  const quietPlies = legal.captured ? 0 : state.quietPlies + 1;
  const partial: DraughtsState = { board, turn: next, quietPlies, winner: null };
  if (quietPlies >= DRAW_AFTER_QUIET_PLIES) return { ...partial, winner: "draw" };
  if (legalDraughtsMoves(partial).length === 0) return { ...partial, winner: state.turn };
  return partial;
}

/** Computer choice: prefer captures, then promotion, then the centre. */
export function bestDraughtsMove(state: DraughtsState): DraughtsMove | null {
  const moves = legalDraughtsMoves(state);
  if (!moves.length) return null;
  const value = (move: DraughtsMove) => {
    let score = 0;
    if (move.captured) score += 4;
    const piece = squareAt(state.board, move.from[0], move.from[1]);
    if (piece && !piece.king && (move.to[0] === 0 || move.to[0] === SIZE - 1)) score += 3;
    score -= Math.abs(3.5 - move.to[1]) * 0.1;
    return score;
  };
  return moves.reduce((best, move) => (value(move) > value(best) ? move : best));
}

/**
 * English draughts on an 8x8 board. Captures are mandatory and a capture sequence must be completed:
 * a piece keeps jumping while it can. A man that reaches the far row becomes a king and its sequence ends.
 * A game with 40 plies and no capture is drawn. Pure: no React, no network.
 */
export type Side = "light" | "dark";
export type Piece = { side: Side; king: boolean };
export type Square = Piece | null;
export type Cell = [number, number];
/**
 * A complete move. `path` lists every square the piece lands on, starting with where it stood.
 * `captured` lists the squares of the pieces removed along the way, in order.
 */
export type DraughtsMove = { from: Cell; to: Cell; path: Cell[]; captured: Cell[] };
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

function cloneBoard(board: readonly (readonly Square[])[]): Square[][] {
  return board.map((row) => [...row]);
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

function promotes(side: Side, row: number) {
  return (side === "light" && row === 0) || (side === "dark" && row === SIZE - 1);
}

/** Every complete capture sequence for the piece on `from`. */
function captureSequences(board: Square[][], from: Cell, piece: Piece): DraughtsMove[] {
  const results: DraughtsMove[] = [];
  const work = cloneBoard(board);
  setSquare(work, from[0], from[1], null);

  const extend = (at: Cell, current: Square[][], king: boolean, path: Cell[], captured: Cell[]) => {
    let extended = false;
    for (const [dr, dc] of directionsFor({ side: piece.side, king })) {
      const mid: Cell = [at[0] + dr, at[1] + dc];
      const land: Cell = [at[0] + 2 * dr, at[1] + 2 * dc];
      if (!inside(land[0], land[1])) continue;
      const jumped = squareAt(current, mid[0], mid[1]);
      if (!jumped || jumped.side === piece.side) continue;
      if (squareAt(current, land[0], land[1])) continue;
      extended = true;
      const next = cloneBoard(current);
      setSquare(next, mid[0], mid[1], null);
      const nowKing = king || promotes(piece.side, land[0]);
      const nextPath = [...path, land];
      const nextCaptured = [...captured, mid];
      if (nowKing && !king) {
        results.push({ from, to: land, path: nextPath, captured: nextCaptured });
      } else {
        extend(land, next, nowKing, nextPath, nextCaptured);
      }
    }
    if (!extended && captured.length > 0) {
      const end = path[path.length - 1];
      if (end) results.push({ from, to: end, path, captured });
    }
  };

  extend(from, work, piece.king, [from], []);
  return results;
}

/** Legal moves for the side to move. If any capture exists, only captures are legal. */
export function legalDraughtsMoves(state: DraughtsState): DraughtsMove[] {
  if (state.winner) return [];
  const captures: DraughtsMove[] = [];
  const steps: DraughtsMove[] = [];
  state.board.forEach((rowCells, row) =>
    rowCells.forEach((piece, col) => {
      if (!piece || piece.side !== state.turn) return;
      const from: Cell = [row, col];
      captures.push(...captureSequences(state.board, from, piece));
      if (captures.length) return;
      for (const [dr, dc] of directionsFor(piece)) {
        const target: Cell = [row + dr, col + dc];
        if (inside(target[0], target[1]) && !squareAt(state.board, target[0], target[1])) {
          steps.push({ from, to: target, path: [from, target], captured: [] });
        }
      }
    }),
  );
  return captures.length ? captures : steps;
}

const samePath = (a: Cell[], b: Cell[]) =>
  a.length === b.length &&
  a.every((cell, index) => cell[0] === b[index]?.[0] && cell[1] === b[index]?.[1]);

/** Applies a legal move (matched by its full path). Returns the same state if the move is not legal. */
export function playDraughts(state: DraughtsState, move: DraughtsMove): DraughtsState {
  const legal = legalDraughtsMoves(state).find((candidate) => samePath(candidate.path, move.path));
  if (!legal) return state;
  const board = cloneBoard(state.board);
  const origin = legal.path[0];
  const end = legal.path[legal.path.length - 1];
  if (!origin || !end) return state;
  const piece = squareAt(board, origin[0], origin[1]);
  if (!piece) return state;
  setSquare(board, origin[0], origin[1], null);
  for (const [row, col] of legal.captured) setSquare(board, row, col, null);
  const king = piece.king || promotes(piece.side, end[0]);
  setSquare(board, end[0], end[1], { side: piece.side, king });

  const next: Side = state.turn === "light" ? "dark" : "light";
  const quietPlies = legal.captured.length ? 0 : state.quietPlies + 1;
  const partial: DraughtsState = { board, turn: next, quietPlies, winner: null };
  if (quietPlies >= DRAW_AFTER_QUIET_PLIES) return { ...partial, winner: "draw" };
  if (legalDraughtsMoves(partial).length === 0) return { ...partial, winner: state.turn };
  return partial;
}

/** Computer choice: the longest capture, then promotion, then the centre. */
export function bestDraughtsMove(state: DraughtsState): DraughtsMove | null {
  const moves = legalDraughtsMoves(state);
  if (!moves.length) return null;
  const value = (move: DraughtsMove) => {
    let score = move.captured.length * 4;
    const piece = squareAt(state.board, move.from[0], move.from[1]);
    if (piece && !piece.king && promotes(piece.side, move.to[0])) score += 3;
    score -= Math.abs(3.5 - move.to[1]) * 0.1;
    return score;
  };
  return moves.reduce((best, move) => (value(move) > value(best) ? move : best));
}

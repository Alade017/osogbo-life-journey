/** Tic-Tac-Toe rules and a perfect computer opponent (minimax). Pure: no React, no network. */
export type Mark = "X" | "O";
export type Cell = Mark | null;
export type TicTacToeState = {
  board: Cell[];
  turn: Mark;
  winner: Mark | "draw" | null;
};

const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function newTicTacToe(): TicTacToeState {
  return { board: Array<Cell>(9).fill(null), turn: "X", winner: null };
}

export function lineWinner(board: readonly Cell[]): Mark | null {
  for (const [a, b, c] of LINES) {
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return mark;
  }
  return null;
}

/** Plays a cell. Returns the same state if the move is illegal. */
export function playTicTacToe(state: TicTacToeState, index: number): TicTacToeState {
  if (state.winner || index < 0 || index > 8 || state.board[index]) return state;
  const board = [...state.board];
  board[index] = state.turn;
  const won = lineWinner(board);
  const full = board.every((cell) => cell !== null);
  return {
    board,
    turn: state.turn === "X" ? "O" : "X",
    winner: won ?? (full ? "draw" : null),
  };
}

function score(board: readonly Cell[], mark: Mark, turn: Mark, depth: number): number {
  const other: Mark = mark === "X" ? "O" : "X";
  const won = lineWinner(board);
  if (won === mark) return 10 - depth;
  if (won === other) return depth - 10;
  if (board.every((cell) => cell !== null)) return 0;
  const scores: number[] = [];
  board.forEach((cell, index) => {
    if (cell) return;
    const next = [...board];
    next[index] = turn;
    scores.push(score(next, mark, turn === "X" ? "O" : "X", depth + 1));
  });
  return turn === mark ? Math.max(...scores) : Math.min(...scores);
}

/** The computer's best cell for `mark` on this board. */
export function bestTicTacToeMove(state: TicTacToeState): number {
  const mark = state.turn;
  let best = -1;
  let bestScore = -Infinity;
  state.board.forEach((cell, index) => {
    if (cell) return;
    const next = [...state.board];
    next[index] = mark;
    const value = score(next, mark, mark === "X" ? "O" : "X", 1);
    if (value > bestScore) {
      bestScore = value;
      best = index;
    }
  });
  return best;
}

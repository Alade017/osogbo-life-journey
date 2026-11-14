import { useEffect, useState, type ComponentType, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Coins,
  Dices,
  Grid3x3,
  Layers,
  Crown as CrownIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StakeTables } from "@/components/game/mini-games/StakeTables";
import { LudoGame } from "@/components/game/mini-games/LudoGame";
import { WhotGame } from "@/components/game/mini-games/WhotGame";
import { useComputerTurn } from "@/components/game/mini-games/computer-turn";
import { CardFace, Crown, TicMark } from "@/components/game/mini-games/game-art";
import { SHAPE_LABELS } from "@/components/game/mini-games/game-art-data";
import "@/components/game/mini-games/mini-games.css";
import {
  bestTicTacToeMove,
  newTicTacToe,
  playTicTacToe,
  type Cell,
  type TicTacToeState,
} from "@/lib/mini-games/tic-tac-toe";
import {
  bestDraughtsMove,
  legalDraughtsMoves,
  newDraughts,
  playDraughts,
  type DraughtsMove,
  type DraughtsState,
} from "@/lib/mini-games/draughts";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

type GameId = "tictactoe" | "draughts" | "ludo" | "whot" | "stakes";

const GAMES: { id: GameId; name: string; icon: LucideIcon; blurb: string }[] = [
  {
    id: "stakes",
    name: "Stake tables",
    icon: Coins,
    blurb: "Stake cash against another player. The winner takes the pot less 5%.",
  },
  {
    id: "whot",
    name: "Whot",
    icon: Layers,
    blurb: "Match shape or number. Empty your hand first.",
  },
  { id: "ludo", name: "Ludo", icon: Dices, blurb: "Race your tokens home. Six brings one out." },
  {
    id: "draughts",
    name: "Draughts",
    icon: CrownIcon,
    blurb: "Jump the other side's pieces. Crown a king.",
  },
  {
    id: "tictactoe",
    name: "Tic-Tac-Toe",
    icon: Grid3x3,
    blurb: "Get three in a row before the computer does.",
  },
];

function winningCells(board: readonly Cell[]): readonly number[] {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const mark = board[a];
    if (mark && mark === board[b] && mark === board[c]) return line;
  }
  return [];
}

function TicTacToeGame() {
  const [state, setState] = useState<TicTacToeState>(newTicTacToe);
  const humanTurn = state.turn === "X" && !state.winner;
  useComputerTurn(!humanTurn && !state.winner, [state], () =>
    setState((current) => playTicTacToe(current, bestTicTacToeMove(current))),
  );
  const winning = winningCells(state.board);
  const status = state.winner
    ? state.winner === "draw"
      ? "A draw."
      : state.winner === "X"
        ? "You won!"
        : "The computer won."
    : humanTurn
      ? "Your turn. You are X."
      : "The computer is thinking…";
  return (
    <section className="mg-game" aria-label="Tic-Tac-Toe">
      <p className={`mg-status ${state.winner === "X" ? "is-win" : ""}`} role="status">
        {status}
      </p>
      <div className="mg-board mg-ttt" role="group" aria-label="Tic-Tac-Toe board">
        {state.board.map((cell, index) => (
          <button
            key={index}
            type="button"
            className={`mg-ttt-cell ${winning.includes(index) ? "is-win" : ""}`}
            disabled={!humanTurn || !!cell}
            aria-label={cell ? `Square ${index + 1}, ${cell}` : `Square ${index + 1}, empty`}
            onClick={() => setState((current) => playTicTacToe(current, index))}
          >
            {cell && <TicMark mark={cell} />}
          </button>
        ))}
      </div>
      {state.winner && <Button onClick={() => setState(newTicTacToe())}>Play again</Button>}
    </section>
  );
}

function DraughtsGame() {
  const [state, setState] = useState<DraughtsState>(newDraughts);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const humanTurn = state.turn === "light" && !state.winner;
  const legal = humanTurn ? legalDraughtsMoves(state) : [];
  useComputerTurn(!humanTurn && !state.winner, [state], () => {
    const move = bestDraughtsMove(state);
    if (move) setState((current) => playDraughts(current, move));
  });
  const targetsFor = (row: number, col: number) =>
    legal.filter((move) => move.from[0] === row && move.from[1] === col);
  const choose = (move: DraughtsMove) => {
    setState((current) => playDraughts(current, move));
    setSelected(null);
  };
  const status = state.winner
    ? state.winner === "draw"
      ? "A draw."
      : state.winner === "light"
        ? "You won!"
        : "The computer won."
    : humanTurn
      ? selected
        ? "Now tap a highlighted square."
        : "Your turn. Tap a light piece to move it."
      : "The computer is thinking…";
  return (
    <section className="mg-game" aria-label="Draughts">
      <p className={`mg-status ${state.winner === "light" ? "is-win" : ""}`} role="status">
        {status}
      </p>
      <div className="mg-board mg-draughts" role="group" aria-label="Draughts board">
        {state.board.map((rowCells, row) =>
          rowCells.map((piece, col) => {
            const dark = (row + col) % 2 === 1;
            const isSelected = selected?.[0] === row && selected?.[1] === col;
            const isTarget = selected
              ? legal.some(
                  (move) =>
                    move.from[0] === selected[0] &&
                    move.from[1] === selected[1] &&
                    move.to[0] === row &&
                    move.to[1] === col,
                )
              : false;
            const movable = humanTurn && piece?.side === "light" && targetsFor(row, col).length > 0;
            return (
              <button
                key={`${row}-${col}`}
                type="button"
                className={`mg-square ${dark ? "is-dark" : "is-light"} ${isSelected ? "is-selected" : ""} ${isTarget ? "is-target" : ""}`}
                aria-label={`Row ${row + 1}, column ${col + 1}${piece ? `, ${piece.side}${piece.king ? " king" : ""}` : ""}`}
                disabled={!dark || (!movable && !isTarget)}
                onClick={() => {
                  if (isTarget && selected) {
                    // Several capture sequences can end on the same square: take the longest.
                    const move = legal
                      .filter(
                        (item) =>
                          item.from[0] === selected[0] &&
                          item.from[1] === selected[1] &&
                          item.to[0] === row &&
                          item.to[1] === col,
                      )
                      .sort((a, b) => b.captured.length - a.captured.length)[0];
                    if (move) choose(move);
                    return;
                  }
                  setSelected(targetsFor(row, col).length ? [row, col] : null);
                }}
              >
                {piece && (
                  <span
                    className={`mg-piece ${piece.side} ${piece.king ? "is-king" : ""}`}
                    aria-hidden="true"
                  >
                    {piece.king && <Crown />}
                  </span>
                )}
                {isTarget && !piece && <span className="mg-dot" aria-hidden="true" />}
              </button>
            );
          }),
        )}
      </div>
      {state.winner && <Button onClick={() => setState(newDraughts())}>Play again</Button>}
    </section>
  );
}

const BOARDS: Record<GameId, ComponentType> = {
  stakes: StakeTables,
  tictactoe: TicTacToeGame,
  draughts: DraughtsGame,
  ludo: LudoGame,
  whot: WhotGame,
};

/** Games hub: solo games against the computer, plus stake tables against another player. */
export function GamesApp() {
  const [active, setActive] = useState<GameId | null>(null);
  if (active) {
    const Board = BOARDS[active];
    const meta = GAMES.find((game) => game.id === active);
    return (
      <div className={`mg-app mg-theme-${active}`} aria-label={meta?.name ?? "Game"}>
        <header className="mg-head">
          <Button variant="plain" onClick={() => setActive(null)} aria-label="Back to games">
            <ArrowLeft size={18} />
          </Button>
          <strong>{meta?.name}</strong>
        </header>
        <Board key={active} />
      </div>
    );
  }
  return (
    <div className="mg-app" aria-label="Games">
      <header className="mg-hub-head">
        <h2>Games</h2>
        <p>Play the computer for fun, or stake cash against another player.</p>
        <div className="mg-hub-art" aria-hidden="true">
          <CardFace rank={5} shape="circle" size="sm" />
          <CardFace rank={20} shape={null} size="sm" />
          <CardFace rank={8} shape="star" size="sm" />
        </div>
      </header>
      <ul className="mg-list">
        {GAMES.map(({ id, name, icon: Icon, blurb }) => (
          <li key={id}>
            <button type="button" className={`mg-tile mg-tile-${id}`} onClick={() => setActive(id)}>
              <span className="mg-tile-badge">
                <Icon size={22} aria-hidden="true" />
              </span>
              <span>
                <strong>{name}</strong>
                <small>{blurb}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
import {
  CardBack,
  CardFace,
  Crown,
  Die,
  ShapeGlyph,
  TicMark,
} from "@/components/game/mini-games/game-art";
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
import {
  BASE,
  FINISHED,
  bestLudoToken,
  legalTokenMoves,
  moveLudoToken,
  newLudo,
  rollLudo,
  type LudoState,
} from "@/lib/mini-games/ludo";
import {
  SHAPES,
  bestWhotCard,
  drawWhot,
  newWhot,
  playWhot,
  playableCards,
  type WhotState,
} from "@/lib/mini-games/whot";

const COMPUTER_DELAY_MS = 550;
const LUDO_TOKEN_COLORS = ["#f5b82e", "#22a06b", "#3b82f6", "#e5484d"] as const;
const LUDO_TRACK_LENGTH = 58;
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

function useComputerTurn(active: boolean, deps: unknown[], act: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(act, COMPUTER_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}

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

function LudoGame() {
  const [state, setState] = useState<LudoState>(() => newLudo(2));
  const [rolls, setRolls] = useState(0);
  const humanTurn = state.turn === 0 && state.winner === null;
  useComputerTurn(!humanTurn && state.winner === null, [state], () => {
    setRolls((count) => count + 1);
    setState((current) => {
      if (current.dice === null) return rollLudo(current, 1 + Math.floor(Math.random() * 6));
      const token = bestLudoToken(current);
      return token === null ? { ...current, dice: null, turn: 0 } : moveLudoToken(current, token);
    });
  });
  const options = state.dice !== null && humanTurn ? legalTokenMoves(state, state.dice) : [];
  const describe = (progress: number) =>
    progress === BASE
      ? "In base. Needs a six."
      : progress === FINISHED
        ? "Home."
        : `${progress + 1} of ${LUDO_TRACK_LENGTH} steps`;
  const percent = (progress: number) =>
    progress === BASE
      ? 0
      : progress === FINISHED
        ? 100
        : ((progress + 1) / LUDO_TRACK_LENGTH) * 100;
  const rivalHome = (state.tokens[1] ?? []).filter((progress) => progress === FINISHED).length;
  const status =
    state.winner === 0
      ? "You won!"
      : state.winner !== null
        ? "The computer won."
        : humanTurn
          ? state.dice === null
            ? "Your turn. Roll the dice."
            : `You rolled ${state.dice}. Choose a token to move.`
          : "The computer is playing…";
  return (
    <section className="mg-game" aria-label="Ludo">
      <p className={`mg-status ${state.winner === 0 ? "is-win" : ""}`} role="status">
        {status}
      </p>
      <div className="mg-ludo-dice">
        <Die key={rolls} value={state.dice} />
        {humanTurn && state.dice === null && (
          <Button
            onClick={() => {
              setRolls((count) => count + 1);
              setState((current) => rollLudo(current, 1 + Math.floor(Math.random() * 6)));
            }}
          >
            Roll the dice
          </Button>
        )}
      </div>
      <ul className="mg-ludo-tokens">
        {(state.tokens[0] ?? []).map((progress, token) => {
          const playable = options.includes(token);
          return (
            <li key={token}>
              <button
                type="button"
                className={`mg-token ${playable ? "is-playable" : ""}`}
                disabled={!playable}
                style={{ "--token": LUDO_TOKEN_COLORS[token % 4] } as CSSProperties}
                onClick={() => setState((current) => moveLudoToken(current, token))}
              >
                <span className="mg-token-disc" aria-hidden="true" />
                <span className="mg-token-body">
                  <strong>Token {token + 1}</strong>
                  <span className="mg-track" aria-hidden="true">
                    <span style={{ width: `${percent(progress)}%` }} />
                  </span>
                  <small>{describe(progress)}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mg-rival">
        Computer: {rivalHome} of {(state.tokens[1] ?? []).length} tokens home.
      </p>
      {state.winner !== null && <Button onClick={() => setState(newLudo(2))}>Play again</Button>}
    </section>
  );
}

function WhotGame() {
  const [state, setState] = useState<WhotState>(() => newWhot(2));
  const [pendingWhot, setPendingWhot] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingWhot) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPendingWhot(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingWhot]);
  const humanTurn = state.turn === 0 && state.winner === null;
  useComputerTurn(!humanTurn && state.winner === null, [state], () => {
    setState((current) => {
      const choice = bestWhotCard(current);
      if (!choice) return drawWhot(current);
      return playWhot(current, choice.cardId, choice.shape ?? undefined);
    });
  });
  const hand = state.hands[0] ?? [];
  const rival = state.hands[1] ?? [];
  const playable = humanTurn
    ? new Set(playableCards(state).map((card) => card.id))
    : new Set<string>();
  const top = state.discard[state.discard.length - 1];
  const status =
    state.winner === 0
      ? "You won!"
      : state.winner !== null
        ? "The computer won."
        : humanTurn
          ? state.pendingDraw > 0
            ? `Penalty: defend with a ${state.pendingRank} or draw ${state.pendingDraw}.`
            : `Your turn. Play a card in shape ${SHAPE_LABELS[state.shape].toLowerCase()} or matching number.`
          : "The computer is playing…";
  return (
    <section className="mg-game" aria-label="Whot">
      <p className={`mg-status ${state.winner === 0 ? "is-win" : ""}`} role="status">
        {status}
      </p>
      <div className="mg-whot-table">
        <div className="mg-pile">
          <CardBack />
          <small>{state.stock.length} left</small>
        </div>
        <div className="mg-discard">
          {top && (
            <span key={top.id} className="mg-deal">
              <CardFace rank={top.rank} shape={top.shape} size="lg" />
            </span>
          )}
          <small className="mg-shape-now">
            <ShapeGlyph shape={state.shape} size={14} /> {SHAPE_LABELS[state.shape]}
          </small>
        </div>
      </div>
      <div className="mg-opponent" aria-label={`Computer holds ${rival.length} cards`}>
        {rival.slice(0, 8).map((card, index) => (
          <span key={card.id} className="mg-opp-card" style={{ "--i": index } as CSSProperties}>
            <CardBack size="sm" />
          </span>
        ))}
        <small>Computer · {rival.length} cards</small>
      </div>
      {state.pendingDraw > 0 && <p className="mg-penalty">Penalty running: {state.pendingDraw}</p>}
      <div className="mg-hand" role="group" aria-label="Your hand">
        {hand.map((card, index) => {
          const canPlay = playable.has(card.id);
          return (
            <button
              key={card.id}
              type="button"
              className={`mg-hand-card ${canPlay ? "is-playable" : ""}`}
              style={{ "--i": index } as CSSProperties}
              disabled={!canPlay}
              aria-label={
                card.rank === 20
                  ? "Whot card" + (canPlay ? "" : ", not playable")
                  : `${card.rank} ${card.shape}${canPlay ? "" : ", not playable"}`
              }
              onClick={() => {
                if (card.rank === 20) setPendingWhot(card.id);
                else setState((current) => playWhot(current, card.id));
              }}
            >
              <CardFace rank={card.rank} shape={card.shape} size="md" />
            </button>
          );
        })}
      </div>
      {pendingWhot &&
        createPortal(
          <div className="mg-shape-overlay" onClick={() => setPendingWhot(null)}>
            <div
              className="mg-shape-pick"
              role="dialog"
              aria-modal="true"
              aria-label="Choose a shape"
              onClick={(event) => event.stopPropagation()}
            >
              <p>Choose the shape to call:</p>
              <div className="mg-shape-options">
                {SHAPES.map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => {
                      setState((current) => playWhot(current, pendingWhot, shape));
                      setPendingWhot(null);
                    }}
                  >
                    <ShapeGlyph shape={shape} size={26} />
                    <span>{SHAPE_LABELS[shape]}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="mg-shape-cancel"
                onClick={() => setPendingWhot(null)}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body,
        )}
      {humanTurn && playable.size === 0 && (
        <Button onClick={() => setState((current) => drawWhot(current))}>
          {state.pendingDraw > 0 ? `Draw ${state.pendingDraw}` : "Draw a card"}
        </Button>
      )}
      {state.winner !== null && <Button onClick={() => setState(newWhot(2))}>Play again</Button>}
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

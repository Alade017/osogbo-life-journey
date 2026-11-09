import { useEffect, useState, type ComponentType } from "react";
import { ArrowLeft, Dices, Grid3x3, Layers, Crown, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  bestTicTacToeMove,
  newTicTacToe,
  playTicTacToe,
  type Mark,
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
  type Shape,
  type WhotState,
} from "@/lib/mini-games/whot";

const COMPUTER_DELAY_MS = 550;

type GameId = "tictactoe" | "draughts" | "ludo" | "whot";

const GAMES: { id: GameId; name: string; icon: LucideIcon; blurb: string }[] = [
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
    icon: Crown,
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

function TicTacToeGame() {
  const [state, setState] = useState<TicTacToeState>(newTicTacToe);
  const humanTurn = state.turn === "X" && !state.winner;
  useComputerTurn(!humanTurn && !state.winner, [state], () =>
    setState((current) => playTicTacToe(current, bestTicTacToeMove(current))),
  );
  const status = state.winner
    ? state.winner === "draw"
      ? "A draw."
      : state.winner === "X"
        ? "You won!"
        : "The computer won."
    : humanTurn
      ? "Your turn (X)."
      : "The computer is thinking…";
  return (
    <section className="mg-game" aria-label="Tic-Tac-Toe">
      <p className="mg-status" role="status">
        {status}
      </p>
      <div className="mg-ttt" role="grid" aria-label="Tic-Tac-Toe board">
        {state.board.map((cell, index) => (
          <button
            key={index}
            type="button"
            className="mg-ttt-cell"
            disabled={!humanTurn || !!cell}
            aria-label={cell ? `Square ${index + 1}, ${cell}` : `Square ${index + 1}, empty`}
            onClick={() => setState((current) => playTicTacToe(current, index))}
          >
            {cell}
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
      ? "Your turn (light). Tap a piece, then a square."
      : "The computer is thinking…";
  return (
    <section className="mg-game" aria-label="Draughts">
      <p className="mg-status" role="status">
        {status}
      </p>
      <div className="mg-draughts" role="grid" aria-label="Draughts board">
        {state.board.map((rowCells, row) =>
          rowCells.map((piece, col) => {
            const dark = (row + col) % 2 === 1;
            const targets =
              selected && selected[0] === row && selected[1] === col ? targetsFor(row, col) : [];
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
                className={`mg-square ${dark ? "is-dark" : "is-light"} ${
                  selected?.[0] === row && selected?.[1] === col ? "is-selected" : ""
                } ${isTarget ? "is-target" : ""}`}
                aria-label={`Row ${row + 1}, column ${col + 1}${piece ? `, ${piece.side}${piece.king ? " king" : ""}` : ""}`}
                disabled={!dark || (!movable && !isTarget)}
                onClick={() => {
                  if (isTarget && selected) {
                    const move = legal.find(
                      (item) =>
                        item.from[0] === selected[0] &&
                        item.from[1] === selected[1] &&
                        item.to[0] === row &&
                        item.to[1] === col,
                    );
                    if (move) choose(move);
                    return;
                  }
                  setSelected(targets.length ? [row, col] : null);
                }}
              >
                {piece && (
                  <span
                    className={`mg-piece ${piece.side} ${piece.king ? "is-king" : ""}`}
                    aria-hidden="true"
                  >
                    {piece.king ? "♛" : ""}
                  </span>
                )}
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
  const humanTurn = state.turn === 0 && state.winner === null;
  useComputerTurn(!humanTurn && state.winner === null, [state], () => {
    setState((current) => {
      if (current.dice === null) return rollLudo(current, 1 + Math.floor(Math.random() * 6));
      const token = bestLudoToken(current);
      return token === null ? { ...current, dice: null, turn: 0 } : moveLudoToken(current, token);
    });
  });
  const options = state.dice !== null && humanTurn ? legalTokenMoves(state, state.dice) : [];
  const describe = (progress: number) =>
    progress === BASE ? "in base" : progress === FINISHED ? "home" : `${progress + 1} of 58 steps`;
  const status =
    state.winner === 0
      ? "You won!"
      : state.winner !== null
        ? "The computer won."
        : humanTurn
          ? state.dice === null
            ? "Your turn. Roll the dice."
            : `You rolled ${state.dice}. Choose a token.`
          : "The computer is playing…";
  return (
    <section className="mg-game" aria-label="Ludo">
      <p className="mg-status" role="status">
        {status}
      </p>
      <div className="mg-ludo-tokens">
        {(state.tokens[0] ?? []).map((progress, token) => (
          <button
            key={token}
            type="button"
            className="mg-token"
            disabled={!options.includes(token)}
            onClick={() => setState((current) => moveLudoToken(current, token))}
          >
            <strong>Token {token + 1}</strong>
            <small>{describe(progress)}</small>
          </button>
        ))}
      </div>
      {humanTurn && state.dice === null && (
        <Button
          onClick={() =>
            setState((current) => rollLudo(current, 1 + Math.floor(Math.random() * 6)))
          }
        >
          Roll the dice
        </Button>
      )}
      {state.winner !== null && <Button onClick={() => setState(newLudo(2))}>Play again</Button>}
    </section>
  );
}

function WhotGame() {
  const [state, setState] = useState<WhotState>(() => newWhot(2));
  const [pendingWhot, setPendingWhot] = useState<string | null>(null);
  const humanTurn = state.turn === 0 && state.winner === null;
  useComputerTurn(!humanTurn && state.winner === null, [state], () => {
    setState((current) => {
      const choice = bestWhotCard(current);
      if (!choice) return drawWhot(current);
      return playWhot(current, choice.cardId, choice.shape ?? undefined);
    });
  });
  const hand = state.hands[0] ?? [];
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
          ? `Your turn. The shape is ${state.shape}.`
          : "The computer is playing…";
  return (
    <section className="mg-game" aria-label="Whot">
      <p className="mg-status" role="status">
        {status}
      </p>
      <div className="mg-whot-top">
        <span className="mg-card-face">
          {top ? (top.rank === 20 ? "Whot" : `${top.rank} ${top.shape ?? ""}`) : "—"}
        </span>
        <small>Computer holds {state.hands[1]?.length ?? 0} cards</small>
      </div>
      <div className="mg-hand" aria-label="Your hand">
        {hand.map((card) => (
          <button
            key={card.id}
            type="button"
            className="mg-card"
            disabled={!playable.has(card.id)}
            onClick={() => {
              if (card.rank === 20) setPendingWhot(card.id);
              else setState((current) => playWhot(current, card.id));
            }}
          >
            {card.rank === 20 ? "Whot" : `${card.rank}`}
            <small>{card.shape ?? ""}</small>
          </button>
        ))}
      </div>
      {pendingWhot && (
        <div className="mg-shape-pick" role="group" aria-label="Choose a shape">
          {SHAPES.map((shape: Shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => {
                setState((current) => playWhot(current, pendingWhot, shape));
                setPendingWhot(null);
              }}
            >
              {shape}
            </button>
          ))}
        </div>
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
  tictactoe: TicTacToeGame,
  draughts: DraughtsGame,
  ludo: LudoGame,
  whot: WhotGame,
};

/** Games hub: four solo games against the computer. Stake tables come later. */
export function GamesApp() {
  const [active, setActive] = useState<GameId | null>(null);
  if (active) {
    const Board = BOARDS[active];
    const meta = GAMES.find((game) => game.id === active);
    return (
      <div className="mg-app" aria-label={meta?.name ?? "Game"}>
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
        <p>Play the computer for fun. Table stakes are coming next.</p>
      </header>
      <ul className="mg-list">
        {GAMES.map(({ id, name, icon: Icon, blurb }) => (
          <li key={id}>
            <button type="button" className="mg-tile" onClick={() => setActive(id)}>
              <Icon size={22} aria-hidden="true" />
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

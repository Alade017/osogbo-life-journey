import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CLEARED,
  HOUSE_NAMES,
  SAFE_SQUARES,
  TRACK_LAST,
  YARD,
  bestLudoMove,
  housesFor,
  legalMoves,
  loopSquare,
  moveLudoSeed,
  newLudo,
  passLudoTurn,
  rollLudo,
  seedsPerSide,
  type LudoMode,
  type LudoMove,
  type LudoState,
} from "@/lib/mini-games/ludo";
import {
  HOME_CELLS,
  HOUSE_COLOURS,
  HOUSE_EDGE,
  TRACK_CELLS,
  YARD_BLOCKS,
  YARD_SEATS,
  cellCentre,
  seedCell,
  type Cell,
} from "@/components/game/mini-games/ludo-track";
import "@/components/game/mini-games/ludo-board.css";

const COMPUTER_DELAY_MS = 700;
const PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};
const SAFE = new Set<number>(SAFE_SQUARES);
const INTRO_KEY = "osogbo-ludo-intro-seen";
/** Offsets, in board percent, that move a finished seed into its house's centre triangle. */
const TRIANGLE_NUDGE = [
  { x: 0, y: -4 },
  { x: 4, y: 0 },
  { x: 0, y: 4 },
  { x: -4, y: 0 },
] as const;

function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberIntro() {
  try {
    window.localStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Storage can be blocked; the popup then shows again next time, which is harmless.
  }
}

function useComputerTurn(active: boolean, deps: unknown[], act: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(act, COMPUTER_DELAY_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);
}

function die() {
  return 1 + Math.floor(Math.random() * 6);
}

function stepsOf(state: LudoState, move: LudoMove) {
  return move.uses.reduce((total, index) => total + (state.pending?.[index] ?? 0), 0);
}

/** Whether a move lands on an unprotected seed of the other side on the track. */
function capturesOn(state: LudoState, move: LudoMove) {
  if (move.to < 0 || move.to > TRACK_LAST) return false;
  const square = loopSquare(move.house, move.to);
  if (SAFE.has(square)) return false;
  return housesFor(state.mode, 1 - state.turn).some((house) =>
    (state.seeds[house] ?? []).some(
      (progress) =>
        progress >= 0 && progress <= TRACK_LAST && loopSquare(house, progress) === square,
    ),
  );
}

function clearedCount(state: LudoState, side: number) {
  return housesFor(state.mode, side).reduce(
    (total, house) => total + (state.seeds[house] ?? []).filter((p) => p === CLEARED).length,
    0,
  );
}

function cellBox(cell: Cell): CSSProperties {
  return {
    left: `${((cell.col - 1) / 15) * 100}%`,
    top: `${((cell.row - 1) / 15) * 100}%`,
    width: `${100 / 15}%`,
    height: `${100 / 15}%`,
  };
}

type SeedView = {
  key: string;
  house: number;
  token: number;
  progress: number;
  left: number;
  top: number;
};

/** Houses in play for the chosen setup, for either side. */
function housesInPlay(mode: LudoMode) {
  return [0, 1, 2, 3].filter(
    (house) => housesFor(mode, 0).includes(house) || housesFor(mode, 1).includes(house),
  );
}

/** Every seed's place on the board. Seeds sharing a cell are spread side by side. */
function seedViews(state: LudoState): SeedView[] {
  const raw = housesInPlay(state.mode).flatMap((house) =>
    (state.seeds[house] ?? []).map((progress, token) => ({
      house,
      token,
      progress,
      cell: seedCell(house, token, progress),
    })),
  );
  const onCell = (cell: Cell) => `${cell.row},${cell.col}`;
  const counts = new Map<string, number>();
  for (const seed of raw) {
    if (seed.progress === YARD) continue;
    counts.set(onCell(seed.cell), (counts.get(onCell(seed.cell)) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return raw.map((seed) => {
    const centre = cellCentre(seed.cell);
    let offset = 0;
    if (seed.progress !== YARD) {
      const key = onCell(seed.cell);
      const total = counts.get(key) ?? 1;
      const index = seen.get(key) ?? 0;
      seen.set(key, index + 1);
      offset = (index - (total - 1) / 2) * 2.6;
    }
    return {
      key: `${seed.house}-${seed.token}`,
      house: seed.house,
      token: seed.token,
      progress: seed.progress,
      left: centre.left + offset + (seed.progress === CLEARED ? TRIANGLE_NUDGE[seed.house]!.x : 0),
      top: centre.top + (seed.progress === CLEARED ? TRIANGLE_NUDGE[seed.house]!.y : 0),
    };
  });
}

function PawnSvg({ house }: { house: number }) {
  const fill = HOUSE_COLOURS[house] ?? "#ffffff";
  const edge = HOUSE_EDGE[house] ?? "#000000";
  return (
    <svg viewBox="-4 -5.4 8 8.8" aria-hidden="true" className="ludo-pawn-svg">
      <ellipse cx="0" cy="2.8" rx="3.2" ry="0.9" fill="#0b1240" opacity="0.3" />
      <path
        d="M -3.1 2.6 Q -3.3 0.4 -1.6 -0.6 L 1.6 -0.6 Q 3.3 0.4 3.1 2.6 Z"
        fill={fill}
        stroke={edge}
        strokeWidth="0.4"
      />
      <circle cx="0" cy="-2.1" r="2.5" fill={fill} stroke={edge} strokeWidth="0.4" />
      <circle cx="-0.8" cy="-2.9" r="0.8" fill="#ffffff" opacity="0.75" />
    </svg>
  );
}

function LudoBoardView({
  state,
  movesBySeed,
  selected,
  busy,
  onSeed,
  onChoose,
}: {
  state: LudoState;
  movesBySeed: Map<string, LudoMove[]>;
  selected: string | null;
  busy: boolean;
  onSeed: (key: string) => void;
  onChoose: (move: LudoMove) => void;
}) {
  const playing = housesInPlay(state.mode);
  return (
    <div className="ludo-board" role="group" aria-label="Ludo board">
      {TRACK_CELLS.map((cell, index) => (
        <div
          key={`track-${index}`}
          className={`ludo-cell${SAFE.has(index) ? " is-safe" : ""}`}
          style={cellBox(cell)}
        >
          {SAFE.has(index) && <span className="ludo-star">★</span>}
        </div>
      ))}
      {HOME_CELLS.map((cells, house) =>
        cells.map((cell, index) => (
          <div
            key={`home-${house}-${index}`}
            className="ludo-cell ludo-home"
            style={{
              ...cellBox(cell),
              background: HOUSE_COLOURS[house],
              opacity: playing.includes(house) ? 1 : 0.35,
            }}
          />
        )),
      )}
      {YARD_BLOCKS.map((block, house) => (
        <div
          key={`yard-${house}`}
          className="ludo-yard"
          style={{
            left: `${((block.col - 1) / 15) * 100}%`,
            top: `${((block.row - 1) / 15) * 100}%`,
            background: HOUSE_COLOURS[house],
            opacity: playing.includes(house) ? 1 : 0.35,
          }}
        ></div>
      ))}
      {YARD_SEATS.flat().map((seat) => {
        const centre = cellCentre(seat);
        return (
          <span
            key={`seat-${seat.row}-${seat.col}`}
            className="ludo-seat"
            style={{ left: `${centre.left}%`, top: `${centre.top}%` }}
            aria-hidden="true"
          />
        );
      })}
      <div className="ludo-centre" style={{ left: "40%", top: "40%" }}>
        <span className="ludo-tri ludo-tri-top" style={{ background: HOUSE_COLOURS[0] }} />
        <span className="ludo-tri ludo-tri-right" style={{ background: HOUSE_COLOURS[1] }} />
        <span className="ludo-tri ludo-tri-bottom" style={{ background: HOUSE_COLOURS[2] }} />
        <span className="ludo-tri ludo-tri-left" style={{ background: HOUSE_COLOURS[3] }} />
        <span className="ludo-crown" aria-hidden="true">
          <Crown size={16} />
        </span>
      </div>
      <div className="ludo-pawns">
        {seedViews(state).map((view) => {
          const seedMoves = movesBySeed.get(view.key) ?? [];
          const eligible = seedMoves.length > 0 && !busy;
          const isSelected = selected === view.key;
          const steps = [...new Set(seedMoves.map((move) => stepsOf(state, move)))];
          return (
            <div
              key={view.key}
              className="ludo-pawn-slot"
              style={{ left: `${view.left}%`, top: `${view.top}%` }}
            >
              <button
                type="button"
                className={`ludo-pawn${eligible ? " is-eligible" : ""}`}
                disabled={!eligible}
                aria-label={`${HOUSE_NAMES[view.house]} seed ${view.token + 1}${
                  eligible ? `, move ${steps.join(" or ")}` : ""
                }`}
                onClick={() => onSeed(view.key)}
              >
                <PawnSvg house={view.house} />
              </button>
              {isSelected && seedMoves.length > 1 && (
                <div className="ludo-choices">
                  {seedMoves.map((move) => (
                    <button
                      key={`${move.to}-${move.uses.join()}`}
                      type="button"
                      onClick={() => onChoose(move)}
                    >
                      +{stepsOf(state, move)}
                      {capturesOn(state, move) ? " ⚔" : ""}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LudoDie({ value }: { value: number }) {
  const on = PIPS[value] ?? [];
  return (
    <div className="ludo-die" role="img" aria-label={`Die showing ${value}`}>
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} className={`ludo-pip${on.includes(index) ? " is-on" : ""}`} />
      ))}
    </div>
  );
}

function Hud({
  state,
  mySide,
  youLabel,
  opponentLabel,
}: {
  state: LudoState;
  mySide: number;
  youLabel: string;
  opponentLabel: string;
}) {
  const total = seedsPerSide(state.mode);
  const side = (index: number, name: string) => (
    <div className={`ludo-hud${state.turn === index && state.winner === null ? " is-turn" : ""}`}>
      <span className="ludo-hud-name">{name}</span>
      <span className="ludo-hud-houses">
        {housesFor(state.mode, index).map((house) => (
          <i key={house} style={{ background: HOUSE_COLOURS[house] }} />
        ))}
        {housesFor(state.mode, index)
          .map((house) => HOUSE_NAMES[house]?.toUpperCase())
          .join(" / ")}
      </span>
      <span className="ludo-hud-score">
        {clearedCount(state, index)} / {total} finished
      </span>
    </div>
  );
  return (
    <div className="ludo-hud-row">
      {side(mySide, youLabel)}
      {side(1 - mySide, opponentLabel)}
    </div>
  );
}

function statusText(
  state: LudoState,
  mySide: number,
  interactive: boolean,
  waitingText: string,
  opponentName: string,
): string {
  if (state.winner === mySide) return "You won!";
  if (state.winner !== null) return `${opponentName} won.`;
  if (!interactive) return waitingText;
  const pending = state.pending ?? [];
  if (pending.length === 0) return "Your turn. Roll the dice.";
  if (pending.length === 2)
    return `You rolled ${pending[0]} and ${pending[1]}. Tap a glowing seed to move.`;
  return `Play the remaining ${pending[0]}. Tap a glowing seed to move.`;
}

function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="ludo-modal" role="dialog" aria-label="How to play Ludo">
      <div className="ludo-modal-card">
        <h3>How to play</h3>
        <ul className="ludo-rules">
          <li>Roll the dice. A six brings a seed out of its yard.</li>
          <li>Tap a glowing seed to move it.</li>
          <li>Land on an opponent's seed to send it back to its yard.</li>
          <li>Star squares are safe: seeds there can't be captured.</li>
          <li>Get all your seeds to the centre to win.</li>
        </ul>
        <Button
          onClick={() => {
            rememberIntro();
            onClose();
          }}
        >
          OK
        </Button>
      </div>
    </div>
  );
}

export type LudoSceneProps = {
  state: LudoState;
  /** The side this player controls: 0 or 1. */
  mySide: number;
  /** Whether this player may act now: roll, or move a seed. */
  interactive: boolean;
  /** This player's legal moves now; empty unless interactive. */
  moves: LudoMove[];
  youLabel: string;
  opponentLabel: string;
  /** Who won, in words: "The computer" or "Your opponent". */
  opponentName: string;
  /** Shown in the status line while the other side plays. */
  waitingText: string;
  /** Replaces the status line, e.g. "Pick a table to start". */
  statusOverride?: string | undefined;
  note?: string | null;
  busy?: boolean;
  onRoll: () => void;
  onMove: (move: LudoMove) => void;
  /** Shows the how-to-play popup, once per browser, until OK. */
  introAllowed?: boolean;
  /** Drawn over the board, e.g. the table picker. */
  overlay?: ReactNode;
  /** Actions in the game-over popup. */
  finishedFooter?: ReactNode;
};

/** The whole board, status, dice and popups, driven by props. Solo and stake tables both use it. */
export function LudoScene({
  state,
  mySide,
  interactive,
  moves,
  youLabel,
  opponentLabel,
  opponentName,
  waitingText,
  statusOverride,
  note = null,
  busy = false,
  onRoll,
  onMove,
  introAllowed = false,
  overlay,
  finishedFooter,
}: LudoSceneProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [introOpen, setIntroOpen] = useState(() => introAllowed && !hasSeenIntro());
  const movesBySeed = new Map<string, LudoMove[]>();
  for (const move of moves) {
    const key = `${move.house}-${move.token}`;
    movesBySeed.set(key, [...(movesBySeed.get(key) ?? []), move]);
  }
  const prompting = interactive && movesBySeed.size > 0 && !busy;

  const choose = (move: LudoMove) => {
    setSelected(null);
    onMove(move);
  };

  const onSeed = (key: string) => {
    const seedMoves = movesBySeed.get(key) ?? [];
    if (seedMoves.length === 1) choose(seedMoves[0]!);
    else if (seedMoves.length > 1) setSelected((current) => (current === key ? null : key));
  };

  const rolled = state.lastRoll;
  const finished = state.winner !== null;
  const rollKey = `${state.turn}-${state.pending?.length ?? 0}`;
  return (
    <section className="ludo-app" aria-label="Ludo">
      <Hud state={state} mySide={mySide} youLabel={youLabel} opponentLabel={opponentLabel} />
      <p
        className={`ludo-status${state.winner === mySide ? " is-win" : ""}${prompting ? " is-prompt" : ""}`}
        role="status"
      >
        {statusOverride ?? statusText(state, mySide, interactive, waitingText, opponentName)}
      </p>
      <div className="ludo-board-wrap">
        <LudoBoardView
          state={state}
          movesBySeed={movesBySeed}
          selected={selected}
          busy={busy}
          onSeed={onSeed}
          onChoose={choose}
        />
        {overlay}
        {introOpen && introAllowed && !finished && (
          <HowToPlay onClose={() => setIntroOpen(false)} />
        )}
        {finished && (
          <div className="ludo-modal" role="dialog" aria-label="Game over">
            <div className="ludo-modal-card">
              <h3>{state.winner === mySide ? "You won!" : `${opponentName} won.`}</h3>
              <p className="ludo-note">
                You: {clearedCount(state, mySide)} / {seedsPerSide(state.mode)} · {opponentLabel}:{" "}
                {clearedCount(state, 1 - mySide)} / {seedsPerSide(state.mode)}
              </p>
              {finishedFooter}
            </div>
          </div>
        )}
      </div>
      <div className="ludo-tray">
        <div className="ludo-dice">
          {rolled && (
            <>
              <LudoDie key={`a-${rollKey}-${rolled[0]}`} value={rolled[0]} />
              <LudoDie key={`b-${rollKey}-${rolled[1]}`} value={rolled[1]} />
            </>
          )}
        </div>
        {interactive && state.pending === null && !finished && (
          <button type="button" className="ludo-roll" onClick={onRoll} disabled={busy}>
            Roll dice
          </button>
        )}
        {note && <p className="ludo-note">{note}</p>}
      </div>
    </section>
  );
}

type BoardProps = {
  mode: LudoMode;
  /** Locked while the table is being picked: the board shows, the moves don't. */
  locked?: boolean;
  onPick?: (mode: LudoMode) => void;
  onAgain?: () => void;
  /** A position to start from, used for previews. */
  initial?: LudoState;
};

/** The solo game against the computer. */
export function LudoBoard({ mode, locked = false, onPick, onAgain, initial }: BoardProps) {
  const [state, setState] = useState<LudoState>(() => initial ?? newLudo(mode));
  const [note, setNote] = useState<string | null>(null);
  const interactive = !locked && state.turn === 0 && state.winner === null;

  useComputerTurn(!locked && state.turn === 1 && state.winner === null, [state], () => {
    const first = die();
    const second = die();
    setState((current) => {
      if (current.pending === null) return rollLudo(current, first, second);
      const move = bestLudoMove(current);
      return move ? moveLudoSeed(current, move) : passLudoTurn(current);
    });
  });

  const rollYourDice = () => {
    const next = rollLudo(state, die(), die());
    setNote(
      next.turn === 1 && next.winner === null
        ? "No seed can move with that roll. Your turn passes."
        : null,
    );
    setState(next);
  };

  const play = (move: LudoMove) => {
    setNote(null);
    setState((current) => moveLudoSeed(current, move));
  };

  return (
    <LudoScene
      state={state}
      mySide={0}
      interactive={interactive}
      moves={interactive ? legalMoves(state) : []}
      youLabel="YOU"
      opponentLabel="COMPUTER"
      opponentName="The computer"
      waitingText="Computer is playing…"
      statusOverride={locked ? "Pick a table to start" : undefined}
      note={note}
      onRoll={rollYourDice}
      onMove={play}
      introAllowed={!locked}
      overlay={
        locked ? (
          <div className="ludo-modal" role="dialog" aria-label="Choose a table">
            <div className="ludo-modal-card">
              <h3>Choose a table</h3>
              <button type="button" className="ludo-table" onClick={() => onPick?.(1)}>
                <strong>Single House</strong>
                <small>4 seeds each. You red, the computer yellow.</small>
              </button>
              <button type="button" className="ludo-table" onClick={() => onPick?.(2)}>
                <strong>Double House</strong>
                <small>8 seeds each. You red and yellow, the computer green and blue.</small>
              </button>
            </div>
          </div>
        ) : undefined
      }
      finishedFooter={onAgain ? <Button onClick={onAgain}>Play again</Button> : undefined}
    />
  );
}

export function LudoGame() {
  const [table, setTable] = useState<{ mode: LudoMode; round: number } | null>(null);
  if (!table) {
    return (
      <LudoBoard key="locked" mode={2} locked onPick={(mode) => setTable({ mode, round: 0 })} />
    );
  }
  return (
    <LudoBoard
      key={`${table.mode}-${table.round}`}
      mode={table.mode}
      onAgain={() => setTable({ mode: table.mode, round: table.round + 1 })}
    />
  );
}

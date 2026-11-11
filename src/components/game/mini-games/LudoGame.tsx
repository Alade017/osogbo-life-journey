import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CLEARED,
  HOUSE_NAMES,
  HOUSE_START,
  LOOP_LENGTH,
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
  HOUSE_COLOURS,
  HOUSE_EDGE,
  YARD_CENTRES,
  ringPoint,
  seatPoint,
  seedPosition,
  squarePoint,
} from "@/components/game/mini-games/ludo-view";
import "@/components/game/mini-games/ludo.css";

const COMPUTER_DELAY_MS = 700;
const PIPS: Record<number, readonly number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

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

/** Whether a move lands on a seed of the other side on the track. */
function capturesOn(state: LudoState, move: LudoMove) {
  if (move.to < 0 || move.to > TRACK_LAST) return false;
  const square = loopSquare(move.house, move.to);
  return housesFor(state.mode, 1 - state.turn).some((house) =>
    (state.seeds[house] ?? []).some(
      (progress) =>
        progress >= 0 && progress <= TRACK_LAST && loopSquare(house, progress) === square,
    ),
  );
}

function moveCopy(state: LudoState, move: LudoMove) {
  const title = `${HOUSE_NAMES[move.house]} seed ${move.token + 1}`;
  if (move.from === YARD) return { title, detail: "Bring out on a six" };
  const steps = move.uses.reduce((total, index) => total + (state.pending?.[index] ?? 0), 0);
  const parts = [`Move ${steps}`];
  if (capturesOn(state, move)) parts.push("capture");
  if (move.to === CLEARED) parts.push("into the centre");
  else if (move.to > TRACK_LAST) parts.push("home column");
  return { title, detail: parts.join(" · ") };
}

function clearedCount(state: LudoState, side: number) {
  return housesFor(state.mode, side).reduce(
    (total, house) => total + (state.seeds[house] ?? []).filter((p) => p === CLEARED).length,
    0,
  );
}

function Pawn({
  x,
  y,
  house,
  active,
  label,
}: {
  x: number;
  y: number;
  house: number;
  active: boolean;
  label: string;
}) {
  const fill = HOUSE_COLOURS[house] ?? "#ffffff";
  const edge = HOUSE_EDGE[house] ?? "#000000";
  return (
    <g className="ludo-pawn" style={{ transform: `translate(${x}px, ${y}px)` }}>
      <title>{label}</title>
      {active && <circle className="ludo-ring" r="5.4" />}
      <g transform="scale(0.8)">
        <ellipse cx="0" cy="2.7" rx="3.4" ry="0.9" fill="#0b1240" opacity="0.3" />
        <path
          d="M -3.2 2.6 Q -3.4 0.4 -1.6 -0.6 L 1.6 -0.6 Q 3.4 0.4 3.2 2.6 Z"
          fill={fill}
          stroke={edge}
          strokeWidth="0.4"
        />
        <circle cx="0" cy="-2.1" r="2.5" fill={fill} stroke={edge} strokeWidth="0.4" />
        <circle cx="-0.8" cy="-2.9" r="0.8" fill="#ffffff" opacity="0.75" />
      </g>
    </g>
  );
}

function LudoBoardSvg({ state, movable }: { state: LudoState; movable: ReadonlySet<string> }) {
  const playing = [0, 1, 2, 3].filter(
    (house) => housesFor(state.mode, 0).includes(house) || housesFor(state.mode, 1).includes(house),
  );
  const starts = HOUSE_START as readonly number[];
  const seeds = playing.flatMap((house) =>
    (state.seeds[house] ?? []).map((progress, token) => ({ house, token, progress })),
  );
  return (
    <svg className="ludo-board" viewBox="0 0 100 100" role="img" aria-label="Ludo board">
      <rect x="1" y="1" width="98" height="98" rx="8" className="ludo-board-frame" />
      {Array.from({ length: LOOP_LENGTH }, (_, index) => {
        const point = ringPoint(index);
        const house = starts.indexOf(index);
        return house >= 0 ? (
          <circle
            key={`track-${index}`}
            cx={point.x}
            cy={point.y}
            r="3.1"
            fill={HOUSE_COLOURS[house]}
            stroke="#ffffff"
            strokeWidth="0.7"
          />
        ) : (
          <circle key={`track-${index}`} cx={point.x} cy={point.y} r="2" className="ludo-square" />
        );
      })}
      {YARD_CENTRES.map(([cx, cy], house) => (
        <g key={`yard-${house}`} opacity={playing.includes(house) ? 1 : 0.3}>
          <rect x={cx - 14} y={cy - 14} width="28" height="28" rx="7" fill={HOUSE_COLOURS[house]} />
          <rect
            x={cx - 10}
            y={cy - 10}
            width="20"
            height="20"
            rx="5"
            fill="#ffffff"
            opacity="0.22"
          />
          {[0, 1, 2, 3].map((token) => {
            const seat = seatPoint(house, token);
            return <circle key={token} cx={seat.x} cy={seat.y} r="4.2" className="ludo-seat" />;
          })}
        </g>
      ))}
      {playing.flatMap((house) =>
        [51, 52, 53, 54, 55].map((progress) => {
          const point = squarePoint(house, progress);
          return (
            <circle
              key={`lane-${house}-${progress}`}
              cx={point.x}
              cy={point.y}
              r="2.4"
              fill={HOUSE_COLOURS[house]}
              opacity="0.7"
            />
          );
        }),
      )}
      <polygon points="34,34 66,34 50,50" fill={HOUSE_COLOURS[0]} />
      <polygon points="66,34 66,66 50,50" fill={HOUSE_COLOURS[1]} />
      <polygon points="66,66 34,66 50,50" fill={HOUSE_COLOURS[2]} />
      <polygon points="34,66 34,34 50,50" fill={HOUSE_COLOURS[3]} />
      {seeds.map(({ house, token, progress }) => {
        const point = seedPosition(house, token, progress);
        return (
          <Pawn
            key={`pawn-${house}-${token}`}
            x={point.x}
            y={point.y}
            house={house}
            active={movable.has(`${house}-${token}`)}
            label={`${HOUSE_NAMES[house]} seed ${token + 1}`}
          />
        );
      })}
    </svg>
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

function Scoreboard({ state }: { state: LudoState }) {
  const total = seedsPerSide(state.mode);
  const side = (index: number, name: string) => (
    <div className={`ludo-chip${state.turn === index && state.winner === null ? " is-turn" : ""}`}>
      <span className="ludo-chip-dots" aria-hidden="true">
        {housesFor(state.mode, index).map((house) => (
          <i key={house} style={{ background: HOUSE_COLOURS[house] }} />
        ))}
      </span>
      <strong>{name}</strong>
      <span>
        {clearedCount(state, index)}/{total}
      </span>
    </div>
  );
  return (
    <div className="ludo-scores">
      {side(0, "You")}
      {side(1, "Computer")}
    </div>
  );
}

function LudoStatus(state: LudoState, humanTurn: boolean): string {
  if (state.winner === 0) return "You won!";
  if (state.winner !== null) return "The computer won.";
  if (!humanTurn) return "The computer is playing…";
  const pending = state.pending ?? [];
  if (pending.length === 0) return "Your turn. Roll the dice.";
  if (pending.length === 2) return `You rolled ${pending[0]} and ${pending[1]}. Choose a move.`;
  return `Play the remaining ${pending[0]}. Choose a move.`;
}

export function LudoBoard({
  mode,
  onAgain,
  initial,
}: {
  mode: LudoMode;
  onAgain: () => void;
  /** A position to start from, used for previews. Normal play starts from a new game. */
  initial?: LudoState;
}) {
  const [state, setState] = useState<LudoState>(() => initial ?? newLudo(mode));
  const [rolls, setRolls] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const humanTurn = state.turn === 0 && state.winner === null;

  useComputerTurn(state.turn === 1 && state.winner === null, [state], () => {
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
    setRolls((count) => count + 1);
    setNote(
      next.turn === 1 && next.winner === null
        ? "No seed can move with that roll, so your turn passes."
        : null,
    );
    setState(next);
  };
  const play = (move: LudoMove) => {
    setNote(null);
    setState((current) => moveLudoSeed(current, move));
  };

  const moves = humanTurn ? legalMoves(state) : [];
  const movable = new Set(moves.map((move) => `${move.house}-${move.token}`));
  const rolled = state.lastRoll;
  return (
    <section className="ludo-app" aria-label="Ludo">
      <Scoreboard state={state} />
      <p className={`ludo-status${state.winner === 0 ? " is-win" : ""}`} role="status">
        {LudoStatus(state, humanTurn)}
      </p>
      <LudoBoardSvg state={state} movable={movable} />
      <div className="ludo-dock">
        <div className="ludo-dice">
          {rolled && (
            <>
              <LudoDie key={`a-${rolls}`} value={rolled[0]} />
              <LudoDie key={`b-${rolls}`} value={rolled[1]} />
            </>
          )}
        </div>
        {humanTurn && state.pending === null && (
          <button type="button" className="ludo-roll" onClick={rollYourDice}>
            Roll the dice
          </button>
        )}
        {note && <p className="ludo-note">{note}</p>}
        {moves.length > 0 && (
          <div className="ludo-moves" role="group" aria-label="Legal moves">
            {moves.map((move) => {
              const copy = moveCopy(state, move);
              return (
                <button
                  key={`${move.house}-${move.token}-${move.to}-${move.uses.join()}`}
                  type="button"
                  className="ludo-move"
                  onClick={() => play(move)}
                >
                  <span
                    className="ludo-move-dot"
                    aria-hidden="true"
                    style={{ background: HOUSE_COLOURS[move.house] }}
                  />
                  <span className="ludo-move-copy">
                    <strong>{copy.title}</strong>
                    <small>{copy.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {state.winner !== null && (
          <div className="ludo-end">
            <Button onClick={onAgain}>Play again</Button>
          </div>
        )}
      </div>
    </section>
  );
}

function PawnRow({ houses }: { houses: readonly number[] }) {
  return (
    <svg className="ludo-setup-art" viewBox="0 0 84 52" aria-hidden="true">
      {houses.map((house, index) => (
        <Pawn
          key={`${house}-${index}`}
          x={14 + index * 17}
          y={36}
          house={house}
          active={false}
          label=""
        />
      ))}
    </svg>
  );
}

function LudoSetup({ onPick }: { onPick: (mode: LudoMode) => void }) {
  return (
    <section className="ludo-app" aria-label="Ludo setup">
      <h3 className="ludo-title">Ludo</h3>
      <p className="ludo-status">Pick a table</p>
      <div className="ludo-setup-grid">
        <button type="button" className="ludo-setup-card" onClick={() => onPick(1)}>
          <PawnRow houses={[0, 2]} />
          <span>
            <strong>Single house</strong>
            <small>4 seeds each. You red, the computer yellow.</small>
          </span>
        </button>
        <button type="button" className="ludo-setup-card" onClick={() => onPick(2)}>
          <PawnRow houses={[0, 2, 1, 3]} />
          <span>
            <strong>Double house</strong>
            <small>8 seeds each. You red and yellow, the computer green and blue.</small>
          </span>
        </button>
      </div>
    </section>
  );
}

export function LudoGame() {
  const [setup, setSetup] = useState<{ mode: LudoMode; round: number } | null>(null);
  if (!setup) return <LudoSetup onPick={(mode) => setSetup({ mode, round: 0 })} />;
  return (
    <LudoBoard
      key={`${setup.mode}-${setup.round}`}
      mode={setup.mode}
      onAgain={() => setSetup({ mode: setup.mode, round: setup.round + 1 })}
    />
  );
}

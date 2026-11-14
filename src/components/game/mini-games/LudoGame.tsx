import { useEffect, useId, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { useComputerTurn } from "@/components/game/mini-games/computer-turn";
import {
  BASE,
  FINISHED,
  bestLudoMove,
  isHumanSeat,
  isSafeSquare,
  legalMoves,
  moveLudoToken,
  newLudo,
  rollLudo,
  seatsForPlayers,
  startOffset,
  type LudoState,
} from "@/lib/mini-games/ludo";
import {
  BOARD_SIZE,
  CENTRE,
  LOOP_CELLS,
  YARD_SLOTS,
  armFor,
  centreTriangle,
  homeLane,
  tokenPoint,
  yardRect,
} from "@/lib/mini-games/ludo-board";

/** Seat colours in seat order. Seats 0 and 2 are the human's in a two-player game. */
export const LUDO_SEAT_COLOURS = ["#f5c518", "#1f9e4a", "#e53935", "#1e6fd9"] as const;
const UNUSED_ARM = "#c7cbd1";
const BOARD_CENTRE = (BOARD_SIZE - 1) / 2 + 0.5;

const PLAYER_OPTIONS: readonly { players: number; blurb: string }[] = [
  { players: 2, blurb: "You and the computer, two colours each." },
  { players: 3, blurb: "You and two computers, one colour each." },
  { players: 4, blurb: "You and three computers, one colour each." },
];

/** Pip positions on a 3 by 3 grid, [column, row], for each die face. */
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[1, 1]],
  2: [
    [0, 0],
    [2, 2],
  ],
  3: [
    [0, 0],
    [1, 1],
    [2, 2],
  ],
  4: [
    [0, 0],
    [2, 0],
    [0, 2],
    [2, 2],
  ],
  5: [
    [0, 0],
    [2, 0],
    [1, 1],
    [0, 2],
    [2, 2],
  ],
  6: [
    [0, 0],
    [2, 0],
    [0, 1],
    [2, 1],
    [0, 2],
    [2, 2],
  ],
};

function randomFace() {
  return 1 + Math.floor(Math.random() * 6);
}

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  return Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * index - Math.PI / 2;
    return `${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`;
  }).join(" ");
}

/** A chevron on a start square, pointing into the board. */
function chevronPoints(cx: number, cy: number) {
  const dx =
    Math.abs(BOARD_CENTRE - cx) >= Math.abs(BOARD_CENTRE - cy) ? Math.sign(BOARD_CENTRE - cx) : 0;
  const dy = dx === 0 ? Math.sign(BOARD_CENTRE - cy) : 0;
  const px = -dy;
  const py = dx;
  const tip = [cx + dx * 0.3, cy + dy * 0.3];
  const base = [cx - dx * 0.12, cy - dy * 0.12];
  return [
    tip,
    [base[0]! + px * 0.22, base[1]! + py * 0.22],
    [base[0]! - px * 0.22, base[1]! - py * 0.22],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

/** A white die with black pips. Pips use the die's own grid, so each face reads the same way. */
function PipDie({ value, rolling }: { value: number; rolling: boolean }) {
  const gradient = useId();
  return (
    <svg
      className={`mg-ludo-face ${rolling ? "is-rolling" : ""}`}
      viewBox="0 0 64 64"
      width={64}
      height={64}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#e7e2d6" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="60"
        height="60"
        rx="13"
        fill={`url(#${gradient})`}
        stroke="#b9b29f"
        strokeWidth="1.5"
      />
      {(PIPS[value] ?? []).map(([col, row], index) => (
        <circle key={index} cx={14 + col * 18} cy={14 + row * 18} r="6.2" fill="#15171c" />
      ))}
    </svg>
  );
}

export function LudoGame() {
  const [players, setPlayers] = useState<number | null>(null);
  if (players === null) return <LudoSetup onStart={setPlayers} />;
  return <LudoTable key={players} players={players} />;
}

function LudoSetup({ onStart }: { onStart: (players: number) => void }) {
  return (
    <section className="mg-game mg-setup" aria-label="Ludo setup">
      <h3 className="mg-setup-title">How many players?</h3>
      <div className="mg-setup-options">
        {PLAYER_OPTIONS.map(({ players, blurb }) => (
          <button
            key={players}
            type="button"
            className="mg-setup-option"
            onClick={() => onStart(players)}
          >
            <strong>{players} players</strong>
            <span>{blurb}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function LudoTable({ players }: { players: number }) {
  const mode = seatsForPlayers(players);
  const [state, setState] = useState<LudoState>(() => newLudo(mode.seats, mode.humans));
  const [selectedDie, setSelectedDie] = useState<0 | 1 | null>(null);
  const [rolls, setRolls] = useState(0);
  const [idle, setIdle] = useState<[number, number]>(() => [randomFace(), randomFace()]);
  const humanTurn = state.winner === null && isHumanSeat(state, state.turn);
  const playerCount = state.playerCount;

  useEffect(() => {
    if (state.dice) setIdle(state.dice);
    setSelectedDie(null);
  }, [state.dice, state.turn]);

  useComputerTurn(!humanTurn && state.winner === null, [state], () => {
    setRolls((count) => count + 1);
    setState((current) => {
      if (current.dice === null) return rollLudo(current, randomFace(), randomFace());
      const move = bestLudoMove(current);
      return move === null ? current : moveLudoToken(current, move.token, move.die);
    });
  });

  const moves = humanTurn ? legalMoves(state) : [];
  const usableDie = (die: 0 | 1) => moves.some((move) => move.die === die);
  const playableTokens = new Set(
    moves
      .filter((move) => selectedDie === null || move.die === selectedDie)
      .map((move) => move.token),
  );
  const faces: [number, number] = state.dice ?? idle;
  const canRoll = humanTurn && state.dice === null;

  const rollDice = () => {
    setRolls((count) => count + 1);
    setState((current) => rollLudo(current, randomFace(), randomFace()));
  };
  const movePiece = (token: number) => {
    setState((current) => moveLudoToken(current, token, selectedDie ?? undefined));
    setSelectedDie(null);
  };

  const humanWon = state.winner !== null && isHumanSeat(state, state.winner);
  const status =
    state.winner !== null
      ? humanWon
        ? "You won!"
        : "The computer won."
      : humanTurn
        ? state.dice === null
          ? "Your turn. Tap the dice to roll."
          : selectedDie !== null
            ? `Pick a pawn to move ${state.dice[selectedDie]}.`
            : `You rolled ${state.dice[0]} and ${state.dice[1]}. Pick a die, then a pawn.`
        : "The computer is playing…";

  const armColour = (arm: number) => {
    for (let seat = 0; seat < playerCount; seat += 1) {
      if (armFor(seat, playerCount) === arm) return LUDO_SEAT_COLOURS[seat] ?? UNUSED_ARM;
    }
    return UNUSED_ARM;
  };
  const startSquares = new Map<number, string>();
  for (let seat = 0; seat < playerCount; seat += 1) {
    startSquares.set(startOffset(seat, playerCount), LUDO_SEAT_COLOURS[seat] ?? UNUSED_ARM);
  }
  const pieces = state.tokens.flatMap((row, seat) =>
    row.map((progress, token) => {
      const point = tokenPoint(seat, playerCount, progress, token);
      const onTrack = progress !== BASE && progress !== FINISHED;
      const nudge = onTrack
        ? [((token % 2) - 0.5) * 0.36, (Math.floor(token / 2) - 0.5) * 0.36]
        : [0, 0];
      return {
        key: `${seat}-${token}`,
        seat,
        token,
        progress,
        x: point.x + (nudge[0] ?? 0),
        y: point.y + (nudge[1] ?? 0),
        playable: humanTurn && seat === state.turn && playableTokens.has(token),
        human: isHumanSeat(state, seat),
      };
    }),
  );
  const computerHome = state.tokens.reduce(
    (count, row, seat) =>
      isHumanSeat(state, seat) ? count : count + row.filter((value) => value === FINISHED).length,
    0,
  );

  return (
    <section className="mg-game mg-ludo" aria-label="Ludo">
      <p className={`mg-status ${humanWon ? "is-win" : ""}`} role="status">
        {status}
      </p>
      <div className="mg-ludo-board-wrap">
        <svg
          className="mg-ludo-board"
          viewBox={`0 0 ${BOARD_SIZE} ${BOARD_SIZE}`}
          role="img"
          aria-label="Ludo board"
        >
          <rect
            className="mg-ludo-ground"
            x="0"
            y="0"
            width={BOARD_SIZE}
            height={BOARD_SIZE}
            rx="0.3"
          />
          {[0, 1, 2, 3].map((arm) => {
            const rect = yardRect(arm);
            const colour = armColour(arm);
            const cx = rect.x + rect.size / 2;
            const cy = rect.y + rect.size / 2;
            return (
              <g key={`yard-${arm}`}>
                <rect
                  className="mg-ludo-yard"
                  x={rect.x}
                  y={rect.y}
                  width={rect.size}
                  height={rect.size}
                  rx="0.6"
                  style={{ "--yard": colour } as CSSProperties}
                />
                <rect
                  className="mg-ludo-yard-inner"
                  x={rect.x + 0.6}
                  y={rect.y + 0.6}
                  width={rect.size - 1.2}
                  height={rect.size - 1.2}
                  rx="0.5"
                />
                {YARD_SLOTS.map((slot, index) => (
                  <circle
                    key={index}
                    className="mg-ludo-socket"
                    cx={cx + slot.x}
                    cy={cy + slot.y}
                    r="0.5"
                    style={{ "--yard": colour } as CSSProperties}
                  />
                ))}
              </g>
            );
          })}
          {LOOP_CELLS.map(([row, col], square) => {
            const start = startSquares.get(square);
            const safe = isSafeSquare(square);
            const cx = col + 0.5;
            const cy = row + 0.5;
            return (
              <g key={`loop-${square}`}>
                <rect
                  className={`mg-ludo-cell ${start ? "is-start" : ""}`}
                  x={col}
                  y={row}
                  width="1"
                  height="1"
                  style={start ? ({ "--start": start } as CSSProperties) : undefined}
                />
                {start && <polygon className="mg-ludo-chevron" points={chevronPoints(cx, cy)} />}
                {safe && !start && (
                  <polygon className="mg-ludo-star" points={starPoints(cx, cy, 0.36, 0.15)} />
                )}
              </g>
            );
          })}
          {[0, 1, 2, 3].map((arm) =>
            homeLane(arm).map(([row, col], index) => (
              <rect
                key={`home-${arm}-${index}`}
                className="mg-ludo-cell is-home"
                x={col}
                y={row}
                width="1"
                height="1"
                style={{ "--start": armColour(arm) } as CSSProperties}
              />
            )),
          )}
          <rect
            className="mg-ludo-centre"
            x={CENTRE.low}
            y={CENTRE.low}
            width={CENTRE.size}
            height={CENTRE.size}
          />
          {[0, 1, 2, 3].map((arm) => (
            <polygon
              key={`tri-${arm}`}
              points={centreTriangle(arm)}
              style={{ fill: armColour(arm) }}
            />
          ))}
          {pieces.map((piece) => (
            <g
              key={piece.key}
              className={`mg-ludo-piece ${piece.playable ? "is-playable" : ""}`}
              style={
                {
                  transform: `translate(${piece.x}px, ${piece.y}px)`,
                  "--piece": LUDO_SEAT_COLOURS[piece.seat],
                } as CSSProperties
              }
              role={piece.playable ? "button" : undefined}
              tabIndex={piece.playable ? 0 : undefined}
              aria-label={piece.playable ? `Move token ${piece.token + 1}` : undefined}
              onClick={piece.playable ? () => movePiece(piece.token) : undefined}
              onKeyDown={
                piece.playable
                  ? (event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        movePiece(piece.token);
                      }
                    }
                  : undefined
              }
            >
              {piece.playable && <circle className="mg-ludo-ring" r="0.46" />}
              <ellipse className="mg-ludo-shadow" cx="0.04" cy="0.4" rx="0.32" ry="0.09" />
              <path
                className="mg-ludo-pawn"
                d="M -0.1 -0.06 L -0.27 0.3 L 0.27 0.3 L 0.1 -0.06 Z"
              />
              <rect
                className="mg-ludo-pawn-base"
                x="-0.33"
                y="0.28"
                width="0.66"
                height="0.12"
                rx="0.05"
              />
              <circle className="mg-ludo-pawn" cx="0" cy="-0.2" r="0.2" />
              <circle className="mg-ludo-glint" cx="-0.07" cy="-0.27" r="0.06" />
            </g>
          ))}
        </svg>
      </div>
      <div className="mg-ludo-dice" role="group" aria-label="Dice">
        {[0, 1].map((index) => {
          const die = index as 0 | 1;
          const used = state.dice !== null && state.used[die];
          const usable = humanTurn && state.dice !== null && !used && usableDie(die);
          const selected = selectedDie === die;
          const onClick = canRoll
            ? rollDice
            : usable
              ? () => setSelectedDie(selected ? null : die)
              : undefined;
          return (
            <button
              key={index}
              type="button"
              className={`mg-ludo-die ${canRoll ? "is-rollable" : ""} ${usable ? "is-usable" : ""} ${selected ? "is-selected" : ""} ${used ? "is-used" : ""}`}
              disabled={!onClick}
              aria-label={
                canRoll
                  ? "Roll the dice"
                  : `Die ${index + 1}: ${faces[index]}${used ? ", played" : ""}`
              }
              aria-pressed={usable ? selected : undefined}
              onClick={onClick}
            >
              <PipDie
                key={`${rolls}-${index}`}
                value={faces[index]}
                rolling={rolls > 0 && state.dice !== null && !used}
              />
            </button>
          );
        })}
      </div>
      <p className="mg-rival">
        Computer: {computerHome} of{" "}
        {state.tokens.reduce(
          (count, row, seat) => count + (isHumanSeat(state, seat) ? 0 : row.length),
          0,
        )}{" "}
        tokens home.
      </p>
      {state.winner !== null && (
        <Button onClick={() => setState(newLudo(mode.seats, mode.humans))}>Play again</Button>
      )}
    </section>
  );
}

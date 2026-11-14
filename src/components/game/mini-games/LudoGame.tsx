import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { useComputerTurn } from "@/components/game/mini-games/computer-turn";
import { LudoBoard } from "@/components/game/mini-games/LudoBoard";
import { LUDO_COLOURS } from "@/components/game/mini-games/ludo-palette";
import {
  COLOURS,
  FINISH_STEP,
  bestComputerMove,
  completeNoLegalMoves,
  createLudoGame,
  currentPlayerId,
  getLegalMoves,
  moveToken,
  rollDice,
  type Colour,
  type LudoEvent,
  type LudoGame as Game,
  type LudoResult,
  type Seat,
} from "@/lib/mini-games/ludo-engine";

const HUMAN = "you";
const COLOUR_NAMES: Readonly<Record<Colour, string>> = {
  RED: "Red",
  GREEN: "Green",
  YELLOW: "Yellow",
  BLUE: "Blue",
};
const PLAYER_OPTIONS: readonly { players: number; blurb: string }[] = [
  { players: 2, blurb: "You and the computer, two colours each." },
  { players: 3, blurb: "You and two computers, one colour each." },
  { players: 4, blurb: "You and three computers, one colour each." },
];
const NO_MOVES_DELAY_MS = 1200;
const TOAST_MS = 2_400;

function randomFace() {
  return 1 + Math.floor(Math.random() * 6);
}

/** Seats for a local game. Two players split the four colours, alternating turns. */
function seatsFor(players: number): Seat[] {
  if (players === 2) {
    return [
      { colour: "RED", playerId: HUMAN },
      { colour: "GREEN", playerId: "cpu-1" },
      { colour: "YELLOW", playerId: HUMAN },
      { colour: "BLUE", playerId: "cpu-2" },
    ];
  }
  return COLOURS.slice(0, players).map((colour, index) => ({
    colour,
    playerId: index === 0 ? HUMAN : `cpu-${index}`,
  }));
}

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

function Die({
  value,
  rolling,
  className,
  ...props
}: {
  value: number;
  rolling: boolean;
  className: string;
  "aria-label"?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={className} {...props}>
      <svg
        className={`mg-ludo-face ${rolling ? "is-rolling" : ""}`}
        viewBox="0 0 64 64"
        width={56}
        height={56}
        aria-hidden="true"
      >
        <rect
          x="2"
          y="2"
          width="60"
          height="60"
          rx="13"
          fill="#fdfcf8"
          stroke="#b9b29f"
          strokeWidth="1.5"
        />
        {(PIPS[value] ?? []).map(([col, row], index) => (
          <circle key={index} cx={14 + col * 18} cy={14 + row * 18} r="6.2" fill="#15171c" />
        ))}
      </svg>
    </button>
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

type Toast = { id: number; text: string };

function describeEvents(events: LudoEvent[], name: (playerId: string) => string): string[] {
  const out: string[] = [];
  for (const event of events) {
    if (event.type === "CAPTURED")
      out.push(`${name(event.playerId)} captured a ${event.victimColour.toLowerCase()} token`);
    if (event.type === "TRIPLE_SIX_FORFEIT")
      out.push(`${name(event.playerId)} rolled three sixes. Turn lost`);
    if (event.type === "NO_LEGAL_MOVES") out.push(`No legal move for ${name(event.playerId)}`);
  }
  return out;
}

function LudoTable({ players }: { players: number }) {
  const [seats] = useState(() => seatsFor(players));
  const [game, setGame] = useState<Game>(() => createLudoGame(seats));
  const [selectedDie, setSelectedDie] = useState<0 | 1 | null>(null);
  const [idle, setIdle] = useState<readonly [number, number]>(() => [randomFace(), randomFace()]);
  const [rolls, setRolls] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const turnPlayer = game.phase === "GAME_OVER" ? null : currentPlayerId(game);
  const humanTurn = turnPlayer === HUMAN && game.phase !== "GAME_OVER";
  const nameOf = (playerId: string) =>
    playerId === HUMAN ? "You" : `CPU ${playerId.split("-")[1] ?? ""}`.trim();

  const apply = (result: LudoResult) => {
    if (!result.ok) return;
    setGame(result.game);
    const messages = describeEvents(result.events, nameOf);
    if (messages.length) {
      const base = Date.now();
      setToasts((current) => [
        ...current,
        ...messages.map((text, index) => ({ id: base + index, text })),
      ]);
    }
  };

  useEffect(() => {
    if (game.dice) setIdle(game.dice);
    setSelectedDie(null);
  }, [game.dice, game.turnIndex]);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = window.setTimeout(() => setToasts((current) => current.slice(1)), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    if (game.phase !== "NO_LEGAL_MOVES") return;
    const timer = window.setTimeout(() => {
      const turn = currentPlayerId(game);
      setGame((current) => {
        const result = completeNoLegalMoves(current, turn);
        return result.ok ? result.game : current;
      });
    }, NO_MOVES_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [game]);

  useComputerTurn(
    !humanTurn && game.phase !== "GAME_OVER" && game.phase !== "NO_LEGAL_MOVES",
    [game],
    () => {
      setRolls((count) => count + 1);
      setGame((current) => {
        const player = currentPlayerId(current);
        if (current.phase === "WAITING_FOR_ROLL") {
          const result = rollDice(current, player, [randomFace(), randomFace()]);
          return result.ok ? result.game : current;
        }
        const pick = bestComputerMove(current, player);
        if (!pick) return current;
        const result = moveToken(current, player, pick.colour, pick.token, pick.die);
        return result.ok ? result.game : current;
      });
    },
  );

  const moves = humanTurn ? getLegalMoves(game, HUMAN) : [];
  const usableDie = (die: 0 | 1) => moves.some((move) => move.die === die);
  const playable = new Set(
    moves
      .filter((move) => selectedDie === null || move.die === selectedDie)
      .map((move) => `${move.colour}-${move.token}`),
  );
  const faces: readonly [number, number] = game.dice ?? idle;
  const canRoll = humanTurn && game.phase === "WAITING_FOR_ROLL";

  const roll = () => {
    setRolls((count) => count + 1);
    apply(rollDice(game, HUMAN, [randomFace(), randomFace()]));
  };
  const pick = (colour: Colour, token: number) => {
    apply(moveToken(game, HUMAN, colour, token, selectedDie ?? undefined));
  };

  const humanWon = game.winnerId === HUMAN;
  const status =
    game.phase === "GAME_OVER"
      ? humanWon
        ? "You won!"
        : `${nameOf(game.winnerId ?? "")} won.`
      : humanTurn
        ? game.phase === "WAITING_FOR_ROLL"
          ? "Your turn. Tap the dice to roll."
          : game.phase === "NO_LEGAL_MOVES"
            ? "No legal move for either die."
            : selectedDie !== null
              ? `Pick a pawn to move ${game.dice?.[selectedDie]}.`
              : `You rolled ${game.dice?.[0]} and ${game.dice?.[1]}. Pick a die, then a pawn.`
        : `${nameOf(turnPlayer ?? "")} is playing…`;

  const finishedFor = (colour: Colour) =>
    game.pieces[colour].filter((step) => step === FINISH_STEP).length;

  return (
    <section className="mg-game mg-ludo" aria-label="Ludo">
      <p className={`mg-status ${humanWon ? "is-win" : ""}`} role="status">
        {status}
      </p>
      <div className="lb-hud" aria-label="Players">
        {seats.map((seat, index) => {
          const active = turnPlayer === seat.playerId;
          return (
            <div
              key={seat.colour}
              className={`lb-card ${active ? "is-active" : ""}`}
              style={{ "--seat": LUDO_COLOURS[seat.colour] } as CSSProperties}
            >
              <span className="lb-avatar" aria-hidden="true">
                {seat.playerId === HUMAN ? "You" : `C${index}`}
              </span>
              <span className="lb-name">
                {nameOf(seat.playerId)} · {COLOUR_NAMES[seat.colour]}
              </span>
              <span className="lb-done" aria-label={`${finishedFor(seat.colour)} of 4 home`}>
                {Array.from({ length: 4 }, (_, token) => (
                  <i key={token} className={token < finishedFor(seat.colour) ? "is-home" : ""} />
                ))}
              </span>
              <span
                className={`lb-link ${seat.playerId === HUMAN ? "is-online" : ""}`}
                aria-hidden="true"
              />
            </div>
          );
        })}
      </div>
      <div className="lb-stage">
        <LudoBoard
          pieces={game.pieces}
          playable={playable}
          onPick={pick}
          playerCount={seats.length}
        />
        {canRoll && (
          <div className="lb-roll-hint" aria-hidden="true">
            Tap to roll
          </div>
        )}
      </div>
      <div className="mg-ludo-dice" role="group" aria-label="Dice">
        {[0, 1].map((index) => {
          const die = index as 0 | 1;
          const used = game.dice !== null && game.used[die];
          const usable = humanTurn && game.dice !== null && !used && usableDie(die);
          const selected = selectedDie === die;
          const onClick = canRoll
            ? roll
            : usable
              ? () => setSelectedDie(selected ? null : die)
              : undefined;
          return (
            <Die
              key={index}
              className={`mg-ludo-die ${canRoll ? "is-rollable" : ""} ${usable ? "is-usable" : ""} ${selected ? "is-selected" : ""} ${used ? "is-used" : ""}`}
              value={faces[index]}
              rolling={rolls > 0 && game.dice !== null && !used}
              disabled={!onClick}
              aria-label={
                canRoll
                  ? "Roll the dice"
                  : `Die ${index + 1}: ${faces[index]}${used ? ", played" : ""}`
              }
              onClick={onClick}
            />
          );
        })}
      </div>
      {game.phase === "GAME_OVER" && (
        <Button onClick={() => setGame(createLudoGame(seats))}>Play again</Button>
      )}
    </section>
  );
}

import { useEffect, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { Bot, Check, User } from "lucide-react";
import { PawnMark3D } from "@/components/game/mini-games/LudoPawns3D";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
/** Online play is not connected to this screen yet, so these show as unavailable. */
const ONLINE_OPTIONS: readonly { label: string; blurb: string }[] = [
  { label: "Play online", blurb: "Match with other players online." },
  { label: "Join a friend's room", blurb: "Enter a room code from a friend." },
  { label: "Create a private room", blurb: "Start a room and invite friends." },
];
const NO_MOVES_DELAY_MS = 1200;
/** How long the "Tap to roll" hint stays before it disappears. */
const ROLL_HINT_MS = 3500;
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

/** Which face of the cube turns to the viewer for each value (CSS rotations in degrees). */
const CUBE_TURN: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: -90, y: 0 },
  3: { x: 0, y: -90 },
  4: { x: 0, y: 90 },
  5: { x: 90, y: 0 },
  6: { x: 0, y: 180 },
};
/** Which cells of a 3x3 face carry a pip, for each face value. */
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8],
};
const FACES = [1, 2, 3, 4, 5, 6];

/** A real 3D cube: it spins while rolling and lands with the rolled value facing up. */
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
  const turn = CUBE_TURN[value] ?? { x: 0, y: 0 };
  return (
    <button type="button" className={className} {...props}>
      <span className="mg-die-stage" aria-hidden="true">
        <span
          className={`mg-cube ${rolling ? "is-rolling" : ""}`}
          style={
            {
              "--ax": `${turn.x}deg`,
              "--ay": `${turn.y}deg`,
              transform: `rotateX(${turn.x}deg) rotateY(${turn.y}deg)`,
            } as CSSProperties
          }
        >
          {FACES.map((face) => (
            <span key={face} className={`mg-cube-face f${face}`}>
              {Array.from({ length: 9 }, (_, cell) => (
                <i key={cell} className={`mg-pip ${PIPS[face]?.includes(cell) ? "is-on" : ""}`} />
              ))}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}

export function LudoGame() {
  const [players, setPlayers] = useState<number | null>(null);
  if (players === null) return <LudoSetup onStart={setPlayers} />;
  return <LudoTable key={players} players={players} onLobby={() => setPlayers(null)} />;
}

function LudoSetup({ onStart }: { onStart: (players: number) => void }) {
  const [choice, setChoice] = useState(2);
  return (
    <section className="mg-game mg-setup" aria-label="Ludo lobby">
      <div className="mg-setup-block">
        <h3 className="mg-setup-title">Play the computer</h3>
        <p className="mg-setup-lede">Choose how many players sit at the table.</p>
        <div className="mg-setup-options" role="radiogroup" aria-label="Number of players">
          {PLAYER_OPTIONS.map(({ players: count, blurb }) => {
            const selected = choice === count;
            return (
              <button
                key={count}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`mg-setup-option ${selected ? "is-selected" : ""}`}
                onClick={() => setChoice(count)}
              >
                <span className="mg-setup-pawns" aria-hidden="true">
                  {seatsFor(count).map((seat) => (
                    <PawnMark key={seat.colour} colour={seat.colour} size={16} />
                  ))}
                </span>
                <span className="mg-setup-text">
                  <strong>{count} players</strong>
                  <small>{blurb}</small>
                </span>
                <span className="mg-setup-tick" aria-hidden="true">
                  {selected && <Check size={14} />}
                </span>
              </button>
            );
          })}
        </div>
        <Button className="mg-setup-start" onClick={() => onStart(choice)}>
          Start game
        </Button>
      </div>
      <div className="mg-setup-block">
        <h4 className="mg-setup-subtitle">Online</h4>
        <ul className="mg-setup-soon">
          {ONLINE_OPTIONS.map(({ label, blurb }) => (
            <li key={label}>
              <button type="button" className="mg-setup-option is-unavailable" disabled>
                <span className="mg-setup-text">
                  <strong>{label}</strong>
                  <small>{blurb}</small>
                </span>
                <span className="mg-setup-badge">Coming soon</span>
              </button>
            </li>
          ))}
        </ul>
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

/** A pawn in the seat's colour, used for avatars and the results popup. */
function PawnMark({ colour, size = 28 }: { colour: Colour; size?: number }) {
  return <PawnMark3D colour={colour} size={size} />;
}

/** Results popup: shown over the finished board, and can be reopened from the table. */
/** Results popup: a centred card that names only the winner. */
function LudoResults({
  open,
  seats,
  game,
  nameOf,
  onAgain,
  onLobby,
  onClose,
}: {
  open: boolean;
  seats: readonly Seat[];
  game: Game;
  nameOf: (playerId: string) => string;
  onAgain: () => void;
  onLobby: () => void;
  onClose: () => void;
}) {
  const winner = game.winnerId ?? "";
  const youWon = winner === HUMAN;
  const winnerSeat = seats.find((seat) => seat.playerId === winner) ??
    seats[0] ?? { colour: "RED" as Colour };
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="lb-results">
        <DialogHeader className="lb-results-head">
          <PawnMark colour={winnerSeat.colour} size={48} />
          <div>
            <DialogTitle>{youWon ? "You won!" : `${nameOf(winner)} won`}</DialogTitle>
            <DialogDescription>
              {youWon ? "Well played." : "Better luck next game."}
            </DialogDescription>
          </div>
        </DialogHeader>
        <DialogFooter className="lb-results-actions">
          <Button onClick={onAgain}>Play again</Button>
          <Button variant="plain" onClick={onLobby}>
            Back to lobby
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LudoTable({ players, onLobby }: { players: number; onLobby: () => void }) {
  const [seats] = useState(() => seatsFor(players));
  const [game, setGame] = useState<Game>(() => createLudoGame(seats));
  const [selectedDie, setSelectedDie] = useState<0 | 1 | null>(null);
  const [idle, setIdle] = useState<readonly [number, number]>(() => [randomFace(), randomFace()]);
  const [rolls, setRolls] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [resultsDismissed, setResultsDismissed] = useState(false);

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
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    if (!canRoll) {
      setHintVisible(false);
      return;
    }
    setHintVisible(true);
    const timer = window.setTimeout(() => setHintVisible(false), ROLL_HINT_MS);
    return () => window.clearTimeout(timer);
  }, [canRoll]);

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
          ? "Your turn! Tap the dice to roll."
          : game.phase === "NO_LEGAL_MOVES"
            ? "No legal move for either die."
            : selectedDie !== null
              ? "Choose a highlighted pawn to move."
              : `You rolled ${game.dice?.[0]} and ${game.dice?.[1]}. Select a die, then choose a pawn.`
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
          // Two-player games give one player two seats, so the turn follows the colour, not the player.
          const active = turnPlayer !== null && game.seats[game.turnIndex]?.colour === seat.colour;
          const isHuman = seat.playerId === HUMAN;
          const home = finishedFor(seat.colour);
          const turnLabel =
            game.phase === "GAME_OVER"
              ? "Game over"
              : active
                ? isHuman
                  ? "Your turn"
                  : "Playing"
                : "Waiting";
          return (
            <div
              key={seat.colour}
              className={`lb-card ${active ? "is-active" : ""}`}
              style={{ "--seat": LUDO_COLOURS[seat.colour] } as CSSProperties}
            >
              <span className="lb-avatar" aria-hidden="true">
                {isHuman ? (
                  <User size={16} aria-hidden="true" />
                ) : (
                  <Bot size={16} aria-hidden="true" />
                )}
              </span>
              <span className="lb-info">
                <span className="lb-name">{nameOf(seat.playerId)}</span>
                <span className="lb-turn">
                  {COLOUR_NAMES[seat.colour]} · {turnLabel}
                </span>
              </span>
              <span className="lb-done" aria-label={`${home} of 4 home`}>
                {Array.from({ length: 4 }, (_, token) => (
                  <i key={token} className={token < home ? "is-home" : ""} />
                ))}
              </span>
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
        {hintVisible && canRoll && (
          <div className="lb-roll-hint" role="status">
            Tap to roll
            <span
              className="lb-roll-timer"
              aria-hidden="true"
              style={{ animationDuration: `${ROLL_HINT_MS}ms` }}
            />
          </div>
        )}
        {game.phase !== "GAME_OVER" && (
          <div className="lb-dice-centre" role="group" aria-label="Dice">
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
        )}
      </div>
      {game.phase === "GAME_OVER" && (
        <LudoResults
          open={!resultsDismissed}
          seats={seats}
          game={game}
          nameOf={nameOf}
          onAgain={() => {
            setResultsDismissed(false);
            setGame(createLudoGame(seats));
          }}
          onLobby={onLobby}
          onClose={() => setResultsDismissed(true)}
        />
      )}
      {game.phase === "GAME_OVER" && resultsDismissed && (
        <Button variant="plain" onClick={() => setResultsDismissed(false)}>
          See results
        </Button>
      )}
    </section>
  );
}

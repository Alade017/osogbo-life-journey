/**
 * LudoEngine: the complete 2 to 4 seat Ludo rules as a pure, deterministic state machine.
 *
 * Each seat is one colour with four tokens. Progress per token is:
 *   -1        in the yard (leaves only on a six, onto the colour's start tile)
 *   0..50     on the shared 52-tile track, counted from the colour's own start tile
 *   51..56    the colour's home column
 *   57        finished (reached exactly)
 *
 * A turn rolls two dice. Each die is played on one token, in either order. A roll that shows a six,
 * a capture and a finish each earn a bonus roll once the turn's dice are used up. A roll counts toward
 * the three-sixes streak if either die shows a six, and the third such roll in a row forfeits the turn.
 *
 * Every action returns either `{ ok: true, game, events }` or `{ ok: false, error }` and never mutates
 * the input. No randomness, clocks or I/O: the server supplies dice values and timers.
 */

export const COLOURS = ["RED", "GREEN", "YELLOW", "BLUE"] as const;
export type Colour = (typeof COLOURS)[number];

export const TOKENS_PER_COLOUR = 4;
export const DICE_COUNT = 2;
export const TRACK_LENGTH = 52;
export const YARD_STEP = -1;
export const LAST_TRACK_STEP = 50;
export const FINISH_STEP = 57;
/** Absolute track tile where each colour's track starts (step 0). */
export const START_OFFSET: Readonly<Record<Colour, number>> = {
  RED: 0,
  GREEN: 13,
  YELLOW: 26,
  BLUE: 39,
};
/** Safe tiles: the four start tiles and the star tile eight steps after each start. */
export const SAFE_TILES: readonly number[] = [0, 8, 13, 21, 26, 34, 39, 47];
export const NO_LEGAL_MOVES_DELAY_MS = 1200;
export const TURN_TIMEOUT_MS = 20_000;
export const SEAT_HOLD_MS = 60_000;
const MAX_SEATS = 4;
const MIN_SEATS = 2;
const TRIPLE_SIX = 3;
const SIX = 6;

export type Seat = { colour: Colour; playerId: string };
export type Phase = "WAITING_FOR_ROLL" | "WAITING_FOR_MOVE" | "NO_LEGAL_MOVES" | "GAME_OVER";
export type Pieces = Readonly<Record<Colour, readonly number[]>>;
export type DiceValues = readonly [number, number];
export type Bonus = "SIX" | "CAPTURE" | "FINISH";

export type LudoGame = {
  readonly seats: readonly Seat[];
  readonly pieces: Pieces;
  readonly turnIndex: number;
  readonly phase: Phase;
  /** The two dice of the current roll, or null before the seat rolls. */
  readonly dice: DiceValues | null;
  /** Which dice have been played this roll. */
  readonly used: readonly [boolean, boolean];
  /** The bonus earned this roll, if any. It gives the seat another roll once the dice are spent. */
  readonly bonus: Bonus | null;
  /** Consecutive rolls that showed a six, for the three-sixes forfeit. */
  readonly consecutiveSixRolls: number;
  readonly winnerId: string | null;
};

export type LudoEvent =
  | { type: "ROLLED"; playerId: string; values: DiceValues }
  | { type: "NO_LEGAL_MOVES"; playerId: string }
  | { type: "TRIPLE_SIX_FORFEIT"; playerId: string }
  | {
      type: "MOVED";
      playerId: string;
      colour: Colour;
      token: number;
      die: 0 | 1;
      from: number;
      to: number;
    }
  | {
      type: "CAPTURED";
      playerId: string;
      colour: Colour;
      token: number;
      victimColour: Colour;
      victimToken: number;
    }
  | { type: "BONUS_ROLL"; playerId: string; reason: Bonus }
  | { type: "TURN_PASSED"; playerId: string; nextPlayerId: string }
  | { type: "GAME_OVER"; winnerId: string };

export type LudoErrorCode = "INVALID_TURN" | "INVALID_PHASE" | "ILLEGAL_MOVE" | "INVALID_DICE";
export type LudoResult =
  { ok: true; game: LudoGame; events: LudoEvent[] } | { ok: false; error: LudoErrorCode };

export type LegalMove = { colour: Colour; token: number; to: number; die: 0 | 1 };

function fail(error: LudoErrorCode): { ok: false; error: LudoErrorCode } {
  return { ok: false, error };
}

/** Starts a game. Seats are played in the order given; each colour appears at most once. */
export function createLudoGame(seats: readonly Seat[]): LudoGame {
  if (seats.length < MIN_SEATS || seats.length > MAX_SEATS) {
    throw new Error(`Ludo needs ${MIN_SEATS} to ${MAX_SEATS} seats.`);
  }
  const colours = new Set(seats.map((seat) => seat.colour));
  if (colours.size !== seats.length) throw new Error("Each Ludo colour can have one seat.");
  const yard = () => Array.from({ length: TOKENS_PER_COLOUR }, () => YARD_STEP);
  return {
    seats: seats.map((seat) => ({ ...seat })),
    pieces: { RED: yard(), GREEN: yard(), YELLOW: yard(), BLUE: yard() },
    turnIndex: 0,
    phase: "WAITING_FOR_ROLL",
    dice: null,
    used: [false, false],
    bonus: null,
    consecutiveSixRolls: 0,
    winnerId: null,
  };
}

/** Absolute track tile for a colour's relative step (0..50). */
export function absoluteTile(colour: Colour, step: number): number {
  return (START_OFFSET[colour] + step) % TRACK_LENGTH;
}

export function isSafeTile(tile: number): boolean {
  return SAFE_TILES.includes(tile);
}

export function currentPlayerId(game: LudoGame): string {
  const seat = game.seats[game.turnIndex];
  if (!seat) throw new Error("The turn points at a missing seat.");
  return seat.playerId;
}

function coloursOf(game: LudoGame, playerId: string): Colour[] {
  return game.seats.filter((seat) => seat.playerId === playerId).map((seat) => seat.colour);
}

/** Where a token would land with this die, or null if the die does not move it. */
function targetStep(step: number, dice: number): number | null {
  if (step === YARD_STEP) return dice === SIX ? 0 : null;
  const next = step + dice;
  return next <= FINISH_STEP ? next : null;
}

/** A tile holding two or more tokens of one other colour is a safe stack: it cannot be landed on. */
function isBlockedByStack(game: LudoGame, mover: Colour, tile: number): boolean {
  return COLOURS.some((colour) => {
    if (colour === mover) return false;
    const onTile = game.pieces[colour].filter(
      (step) => step >= 0 && step <= LAST_TRACK_STEP && absoluteTile(colour, step) === tile,
    ).length;
    return onTile >= 2;
  });
}

/** Every move the current player could make with the unused dice of this roll. */
export function getLegalMoves(game: LudoGame, playerId: string): LegalMove[] {
  if (game.phase === "GAME_OVER" || game.dice === null || playerId !== currentPlayerId(game))
    return [];
  const moves: LegalMove[] = [];
  for (const die of [0, 1] as const) {
    if (game.used[die]) continue;
    const value = game.dice[die];
    for (const colour of coloursOf(game, playerId)) {
      game.pieces[colour].forEach((step, token) => {
        const to = targetStep(step, value);
        if (to === null) return;
        if (to <= LAST_TRACK_STEP && isBlockedByStack(game, colour, absoluteTile(colour, to)))
          return;
        moves.push({ colour, token, to, die });
      });
    }
  }
  return moves;
}

/** Same as getLegalMoves; kept under the spec's name. */
export const calculateLegalMoves = getLegalMoves;

function nextTurn(game: LudoGame): LudoGame {
  return {
    ...game,
    turnIndex: (game.turnIndex + 1) % game.seats.length,
    phase: "WAITING_FOR_ROLL",
    dice: null,
    used: [false, false],
    bonus: null,
    consecutiveSixRolls: 0,
  };
}

/** The same seat rolls again, after a bonus. */
function bonusRoll(game: LudoGame): LudoGame {
  return { ...game, phase: "WAITING_FOR_ROLL", dice: null, used: [false, false], bonus: null };
}

function withResult(game: LudoGame, events: LudoEvent[]): LudoResult {
  return { ok: true, game, events };
}

/** Ends the roll once no unused die can move: a bonus rolls the seat again, otherwise the turn passes. */
function settleRoll(game: LudoGame, playerId: string, events: LudoEvent[]): LudoResult {
  if (game.bonus !== null) {
    events.push({ type: "BONUS_ROLL", playerId, reason: game.bonus });
    return withResult(bonusRoll(game), events);
  }
  const passed = nextTurn(game);
  events.push({ type: "TURN_PASSED", playerId, nextPlayerId: currentPlayerId(passed) });
  return withResult(passed, events);
}

/** Rolls both dice for the current player. Three rolls in a row with a six forfeit the turn. */
export function rollDice(game: LudoGame, playerId: string, values: DiceValues): LudoResult {
  if (game.phase !== "WAITING_FOR_ROLL") return fail("INVALID_PHASE");
  if (playerId !== currentPlayerId(game)) return fail("INVALID_TURN");
  if (values.some((value) => !Number.isInteger(value) || value < 1 || value > SIX)) {
    return fail("INVALID_DICE");
  }

  const sixRoll = values.includes(SIX);
  const streak = sixRoll ? game.consecutiveSixRolls + 1 : 0;
  const rolled: LudoEvent = { type: "ROLLED", playerId, values };
  if (streak === TRIPLE_SIX) {
    const passed = nextTurn({ ...game, dice: values });
    return withResult(passed, [
      rolled,
      { type: "TRIPLE_SIX_FORFEIT", playerId },
      { type: "TURN_PASSED", playerId, nextPlayerId: currentPlayerId(passed) },
    ]);
  }

  const rolledGame: LudoGame = {
    ...game,
    dice: values,
    used: [false, false],
    bonus: sixRoll ? "SIX" : null,
    consecutiveSixRolls: streak,
  };
  if (getLegalMoves(rolledGame, playerId).length === 0) {
    return withResult({ ...rolledGame, phase: "NO_LEGAL_MOVES" }, [
      rolled,
      { type: "NO_LEGAL_MOVES", playerId },
    ]);
  }
  return withResult({ ...rolledGame, phase: "WAITING_FOR_MOVE" }, [rolled]);
}

/** Called after NO_LEGAL_MOVES_DELAY_MS: a bonus rolls again, otherwise the turn passes. */
export function completeNoLegalMoves(game: LudoGame, playerId: string): LudoResult {
  if (game.phase !== "NO_LEGAL_MOVES") return fail("INVALID_PHASE");
  if (playerId !== currentPlayerId(game)) return fail("INVALID_TURN");
  return settleRoll(game, playerId, []);
}

/**
 * Moves one token with one of the two dice. Without `die`, the first unused die that fits is used.
 */
export function moveToken(
  game: LudoGame,
  playerId: string,
  colour: Colour,
  token: number,
  die?: 0 | 1,
): LudoResult {
  if (game.phase !== "WAITING_FOR_MOVE") return fail("INVALID_PHASE");
  if (playerId !== currentPlayerId(game)) return fail("INVALID_TURN");
  const move = getLegalMoves(game, playerId).find(
    (item) =>
      item.colour === colour && item.token === token && (die === undefined || item.die === die),
  );
  if (!move || !game.dice) return fail("ILLEGAL_MOVE");

  const from = game.pieces[colour][token] ?? YARD_STEP;
  const pieces: Record<Colour, number[]> = {
    RED: [...game.pieces.RED],
    GREEN: [...game.pieces.GREEN],
    YELLOW: [...game.pieces.YELLOW],
    BLUE: [...game.pieces.BLUE],
  };
  pieces[colour][token] = move.to;
  const used: [boolean, boolean] = [...game.used];
  used[move.die] = true;
  const events: LudoEvent[] = [
    { type: "MOVED", playerId, colour, token, die: move.die, from, to: move.to },
  ];

  let bonus = game.bonus;
  if (move.to <= LAST_TRACK_STEP) {
    const tile = absoluteTile(colour, move.to);
    if (!isSafeTile(tile)) {
      for (const victim of COLOURS) {
        if (victim === colour) continue;
        pieces[victim].forEach((step, victimToken) => {
          if (step >= 0 && step <= LAST_TRACK_STEP && absoluteTile(victim, step) === tile) {
            pieces[victim][victimToken] = YARD_STEP;
            bonus = bonus ?? "CAPTURE";
            events.push({
              type: "CAPTURED",
              playerId,
              colour,
              token,
              victimColour: victim,
              victimToken,
            });
          }
        });
      }
    }
  }
  if (move.to === FINISH_STEP) bonus = bonus ?? "FINISH";

  const updated: LudoGame = { ...game, pieces, used, bonus };
  if (
    coloursOf(updated, playerId).every((item) => pieces[item].every((step) => step === FINISH_STEP))
  ) {
    events.push({ type: "GAME_OVER", winnerId: playerId });
    return withResult({ ...updated, phase: "GAME_OVER", winnerId: playerId, dice: null }, events);
  }

  if (getLegalMoves(updated, playerId).length > 0) {
    return withResult({ ...updated, phase: "WAITING_FOR_MOVE" }, events);
  }
  return settleRoll(updated, playerId, events);
}

/**
 * Server timeout (after TURN_TIMEOUT_MS): rolls for the player, or plays a random legal move, or
 * passes after no legal move. `random` returns a number in [0, 1) so the caller decides the seed.
 */
export function timeoutAction(game: LudoGame, playerId: string, random: () => number): LudoResult {
  const die = () => 1 + Math.floor(random() * SIX);
  if (game.phase === "WAITING_FOR_ROLL") return rollDice(game, playerId, [die(), die()]);
  if (game.phase === "WAITING_FOR_MOVE") {
    const options = getLegalMoves(game, playerId);
    const pick = options[Math.min(options.length - 1, Math.floor(random() * options.length))];
    if (!pick) return fail("ILLEGAL_MOVE");
    return moveToken(game, playerId, pick.colour, pick.token, pick.die);
  }
  if (game.phase === "NO_LEGAL_MOVES") return completeNoLegalMoves(game, playerId);
  return fail("INVALID_PHASE");
}

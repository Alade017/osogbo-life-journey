/**
 * LudoTable: the server-side authority for one multiplayer Ludo game. It owns the seats, the turn
 * timer, the 1200 ms no-legal-moves pause, the 60 s seat hold after a disconnect, and the win record.
 * The Colyseus room supplies a clock, a random source, a broadcaster and the persistence hook; this
 * class has no network code, so every rule here can be tested directly.
 */
import {
  COLOURS,
  NO_LEGAL_MOVES_DELAY_MS,
  SEAT_HOLD_MS,
  TURN_TIMEOUT_MS,
  completeNoLegalMoves,
  createLudoGame,
  currentPlayerId,
  moveToken,
  rollDice,
  timeoutAction,
  type Colour,
  type DiceValues,
  type LudoEvent,
  type LudoGame,
  type LudoResult,
} from "./ludo-engine.ts";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;

export type TableStatus = "WAITING" | "IN_PROGRESS" | "FINISHED";
export type TableErrorCode =
  | "INVALID_TURN"
  | "INVALID_PHASE"
  | "ILLEGAL_MOVE"
  | "INVALID_DICE"
  | "ROOM_NOT_ACTIVE"
  | "ROOM_FULL"
  | "NOT_HOST"
  | "NOT_ENOUGH_PLAYERS"
  | "ALREADY_STARTED";

export type TablePlayer = {
  userId: string;
  name: string;
  colour: Colour;
  connected: boolean;
};

export type TableEvent =
  | { type: "STATE"; state: TableView }
  | { type: "GAME_EVENTS"; events: LudoEvent[] }
  | { type: "ERROR"; code: TableErrorCode; requestedBy: string }
  | { type: "TOAST"; text: string };

export type TableView = {
  status: TableStatus;
  players: TablePlayer[];
  hostId: string | null;
  turnPlayerId: string | null;
  phase: LudoGame["phase"] | null;
  pieces: LudoGame["pieces"] | null;
  dice: DiceValues | null;
  used: LudoGame["used"] | null;
  winnerId: string | null;
};

export type TableResult = LudoResult | { ok: false; error: TableErrorCode };

export type Timer = { clear(): void };
export type Clock = { setTimeout(callback: () => void, ms: number): Timer };

export type TableOptions = {
  clock: Clock;
  random: () => number;
  broadcast: (event: TableEvent) => void;
  /** Called once when the game ends. Failures are reported by the caller, not by the table. */
  recordWin: (result: { winnerId: string; playerIds: string[] }) => Promise<void> | void;
};

type Hold = { timer: Timer };

export class LudoTable {
  private status: TableStatus = "WAITING";
  private readonly players: TablePlayer[] = [];
  private game: LudoGame | null = null;
  private turnTimer: Timer | null = null;
  private readonly holds = new Map<string, Hold>();

  private readonly options: TableOptions;

  constructor(options: TableOptions) {
    this.options = options;
  }

  view(): TableView {
    const game = this.game;
    return {
      status: this.status,
      players: this.players.map((player) => ({ ...player })),
      hostId: this.players[0]?.userId ?? null,
      turnPlayerId: game ? currentPlayerId(game) : null,
      phase: game?.phase ?? null,
      pieces: game?.pieces ?? null,
      dice: game?.dice ?? null,
      used: game?.used ?? null,
      winnerId: game?.winnerId ?? null,
    };
  }

  /** Seats a player. The first player to join is the host. Players can only join while waiting. */
  join(userId: string, name: string): { ok: true } | { ok: false; error: TableErrorCode } {
    const existing = this.players.find((player) => player.userId === userId);
    if (existing) return this.reconnect(userId);
    if (this.status !== "WAITING") return { ok: false, error: "ALREADY_STARTED" };
    if (this.players.length >= MAX_PLAYERS) return { ok: false, error: "ROOM_FULL" };
    const colour = COLOURS[this.players.length];
    if (!colour) return { ok: false, error: "ROOM_FULL" };
    this.players.push({ userId, name, colour, connected: true });
    this.publish();
    return { ok: true };
  }

  /** The host starts the game once every seat that will play has joined (two to four). */
  start(userId: string): { ok: true } | { ok: false; error: TableErrorCode } {
    if (this.status !== "WAITING") return { ok: false, error: "ALREADY_STARTED" };
    if (this.players[0]?.userId !== userId) return { ok: false, error: "NOT_HOST" };
    if (this.players.length < MIN_PLAYERS) return { ok: false, error: "NOT_ENOUGH_PLAYERS" };
    this.status = "IN_PROGRESS";
    this.game = createLudoGame(
      this.players.map((player) => ({ colour: player.colour, playerId: player.userId })),
    );
    this.publish();
    this.scheduleTurn();
    return { ok: true };
  }

  roll(userId: string): TableResult {
    const check = this.checkActive(userId);
    if (check) return this.reject(check.error, userId);
    const values = [this.dice(), this.dice()] as const;
    return this.apply(rollDice(this.game!, userId, values), userId);
  }

  move(
    userId: string,
    colour: Colour,
    token: number,
    die?: 0 | 1,
  ): LudoResult | { ok: false; error: TableErrorCode } {
    const check = this.checkActive(userId);
    if (check) return check;
    if (!Number.isInteger(token) || token < 0 || token > 3)
      return { ok: false, error: "ILLEGAL_MOVE" };
    return this.apply(moveToken(this.game!, userId, colour, token, die), userId);
  }

  /** A socket dropped: the seat is held for SEAT_HOLD_MS while the client may reconnect. */
  disconnect(userId: string): void {
    const player = this.players.find((item) => item.userId === userId);
    if (!player) return;
    player.connected = false;
    this.holds.get(userId)?.timer.clear();
    const timer = this.options.clock.setTimeout(() => {
      this.holds.delete(userId);
      this.publish();
    }, SEAT_HOLD_MS);
    this.holds.set(userId, { timer });
    this.publish();
  }

  /** The same player reconnected in time: the seat is theirs again and nothing else changes. */
  reconnect(userId: string): { ok: true } | { ok: false; error: TableErrorCode } {
    const player = this.players.find((item) => item.userId === userId);
    if (!player) return { ok: false, error: "ROOM_NOT_ACTIVE" };
    player.connected = true;
    this.holds.get(userId)?.timer.clear();
    this.holds.delete(userId);
    this.publish();
    return { ok: true };
  }

  /** Tells the requesting client why, and leaves the state as it was. */
  private reject(code: TableErrorCode, requestedBy: string): { ok: false; error: TableErrorCode } {
    this.options.broadcast({ type: "ERROR", code, requestedBy });
    return { ok: false, error: code };
  }

  private checkActive(userId: string): { ok: false; error: TableErrorCode } | null {
    if (this.status !== "IN_PROGRESS" || !this.game) return { ok: false, error: "ROOM_NOT_ACTIVE" };
    if (currentPlayerId(this.game) !== userId) return { ok: false, error: "INVALID_TURN" };
    return null;
  }

  private dice(): number {
    return 1 + Math.floor(this.options.random() * 6);
  }

  private apply(result: LudoResult, requestedBy: string): TableResult {
    if (!result.ok) return this.reject(result.error, requestedBy);
    this.game = result.game;
    this.options.broadcast({ type: "GAME_EVENTS", events: result.events });
    if (result.game.phase === "GAME_OVER" && result.game.winnerId) {
      this.finish(result.game.winnerId);
    } else {
      this.scheduleTurn();
    }
    this.publish();
    return result;
  }

  /** Sets the timer for whatever the current phase is waiting for. */
  private scheduleTurn(): void {
    this.turnTimer?.clear();
    this.turnTimer = null;
    const game = this.game;
    if (!game || game.phase === "GAME_OVER") return;
    const playerId = currentPlayerId(game);

    if (game.phase === "NO_LEGAL_MOVES") {
      this.turnTimer = this.options.clock.setTimeout(() => {
        const next = completeNoLegalMoves(this.game!, playerId);
        this.apply(next, playerId);
      }, NO_LEGAL_MOVES_DELAY_MS);
      return;
    }
    this.turnTimer = this.options.clock.setTimeout(() => {
      const result = timeoutAction(this.game!, playerId, this.options.random);
      this.options.broadcast({ type: "TOAST", text: "Time ran out. A move was made for them." });
      this.apply(result, playerId);
    }, TURN_TIMEOUT_MS);
  }

  private finish(winnerId: string): void {
    this.status = "FINISHED";
    this.turnTimer?.clear();
    this.turnTimer = null;
    for (const hold of this.holds.values()) hold.timer.clear();
    this.holds.clear();
    const playerIds = this.players.map((player) => player.userId);
    void Promise.resolve(this.options.recordWin({ winnerId, playerIds })).catch(() => undefined);
  }

  private publish(): void {
    this.options.broadcast({ type: "STATE", state: this.view() });
  }
}

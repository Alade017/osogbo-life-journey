import { Room, type AuthContext, type Client } from "colyseus";
import { COLOURS, SEAT_HOLD_MS, type Colour } from "../src/lib/mini-games/ludo-engine.ts";
import { LudoTable, type TableEvent } from "../src/lib/mini-games/ludo-table.ts";
import { recordLudoWin } from "./ludo-persistence.ts";

// One Ludo table per room. The table in src/lib/mini-games/ludo-table.ts holds every rule. This room only
// verifies the sign-in, turns socket messages into table actions and sends the table's events back out.

type LudoAuth = { userId: string; name: string };

const SEAT_HOLD_SECONDS = SEAT_HOLD_MS / 1000;
const NAME_MAX = 24;
const TOKEN_MIN_LENGTH = 32;
const TOKEN_MAX_LENGTH = 4_096;

function publicSettings() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("The Ludo server needs Supabase URL and publishable key configuration.");
  return { url: url.replace(/\/$/, ""), key };
}

function allowedOrigins() {
  const configured = process.env["MULTIPLAYER_ALLOWED_ORIGINS"]?.split(",").map((value) => value.trim()).filter(Boolean);
  if (configured?.length) return configured;
  return process.env["NODE_ENV"] === "production" || process.env["RAILWAY_ENVIRONMENT_NAME"]
    ? []
    : ["http://127.0.0.1:3000", "http://localhost:3000", "http://127.0.0.1:3010", "http://localhost:3010"];
}

// Confirms the sign-in with Supabase. The room never trusts a user id sent by the client.
async function readLudoPlayer(accessToken: string): Promise<LudoAuth> {
  const { url, key } = publicSettings();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error("The game session could not be verified.");
  const user = (await response.json()) as { id?: unknown; user_metadata?: { name?: unknown } };
  if (typeof user.id !== "string") throw new Error("The game session could not be verified.");
  const name = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : "Player";
  return { userId: user.id, name: name.slice(0, NAME_MAX) };
}

function userOf(client: Client): string {
  return (client.auth as LudoAuth).userId;
}

function parseMove(payload: unknown): { colour: Colour; tokenIndex: number; die?: 0 | 1 } | null {
  if (typeof payload !== "object" || payload === null) return null;
  const data = payload as Record<string, unknown>;
  const colour = COLOURS.find((item) => item === data["colour"]);
  const tokenIndex = data["tokenIndex"];
  const die = data["die"];
  if (!colour || typeof tokenIndex !== "number" || !Number.isInteger(tokenIndex)) return null;
  if (die !== undefined && die !== 0 && die !== 1) return null;
  return die === undefined ? { colour, tokenIndex } : { colour, tokenIndex, die };
}

export class LudoRoom extends Room {
  override maxClients = 4;
  override maxMessagesPerSecond = 8;

  private table!: LudoTable;

  override onCreate() {
    this.setMetadata({ kind: "ludo" });
    this.table = new LudoTable({
      clock: {
        setTimeout: (callback, ms) => {
          const delayed = this.clock.setTimeout(callback, ms);
          return { clear: () => delayed.clear() };
        },
      },
      random: Math.random,
      broadcast: (event) => this.dispatch(event),
      recordWin: (result) => recordLudoWin(result),
    });
    this.onMessage("START_GAME", (client) => this.table.start(userOf(client)));
    this.onMessage("ROLL_DICE", (client) => this.table.roll(userOf(client)));
    this.onMessage("MOVE_TOKEN", (client, payload: unknown) => {
      const move = parseMove(payload);
      if (!move) {
        client.send("ERROR", { code: "ILLEGAL_MOVE" });
        return;
      }
      this.table.move(userOf(client), move.colour, move.tokenIndex, move.die);
    });
  }

  override async onAuth(_client: Client, options: { accessToken?: unknown }, context: AuthContext) {
    const origin = context.headers.get("origin");
    if (typeof origin !== "string" || !allowedOrigins().includes(origin))
      throw new Error("This website is not allowed to join the game server.");
    if (
      typeof options.accessToken !== "string" ||
      options.accessToken.length < TOKEN_MIN_LENGTH ||
      options.accessToken.length > TOKEN_MAX_LENGTH
    )
      throw new Error("Sign in before joining a Ludo table.");
    return readLudoPlayer(options.accessToken);
  }

  override onJoin(client: Client, _options: unknown, auth: LudoAuth) {
    const result = this.table.join(auth.userId, auth.name);
    if (!result.ok) {
      client.send("ERROR", { code: result.error });
      client.leave();
    }
  }

  override async onDrop(client: Client) {
    const userId = userOf(client);
    this.table.disconnect(userId);
    try {
      await this.allowReconnection(client, SEAT_HOLD_SECONDS);
      this.table.reconnect(userId);
    } catch {
      // The hold ran out. The seat keeps its place and its turns are played by the timer.
    }
  }

  private dispatch(event: TableEvent) {
    if (event.type === "STATE") this.broadcast("STATE", event.state);
    else if (event.type === "GAME_EVENTS") this.broadcast("GAME_EVENTS", { events: event.events });
    else if (event.type === "TOAST") this.broadcast("TOAST", { text: event.text });
    else {
      const target = this.clients.find((client) => (client.auth as LudoAuth | undefined)?.userId === event.requestedBy);
      target?.send("ERROR", { code: event.code });
    }
  }
}

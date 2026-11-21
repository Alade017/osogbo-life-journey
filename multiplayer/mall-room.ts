import { Room, type AuthContext, type Client } from "colyseus";
import type { WalkPoint } from "../src/game/grid-walk-path.ts";
import { MALL_MOVE_BURST, checkMallMove } from "../src/game/mall-movement.ts";
import { MALL_ENTRANCE } from "../src/game/osun-mall-layout.ts";

// One room for the Osun Mall. The room relays presence and positions only. Money, stats and
// progress are changed by database RPCs; this room never writes to them. Every move is checked
// against the mall layout (the whole route, not just its end) and against walking speed, and a
// player whose saved character leaves the mall is removed from the room.

type MallMember = {
  characterId: string;
  name: string;
  gender: string;
  appearance: unknown;
  accessToken: string;
  position: WalkPoint;
  /** Distance this player may still cover, refilled over time up to the burst limit. */
  allowance: number;
  lastMoveAt: number;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NAME_MAX = 24;
const PRESENCE_INTERVAL_MS = 250;
const MEMBERSHIP_CHECK_MS = 20_000;
export const MALL_MAX_PLAYERS = 40;

function supabaseSettings() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key)
    throw new Error("The multiplayer server needs Supabase URL and publishable key configuration.");
  return { url: url.replace(/\/$/, ""), key };
}

function allowedOrigins() {
  const configured = process.env["MULTIPLAYER_ALLOWED_ORIGINS"]
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured?.length) return configured;
  return process.env["NODE_ENV"] === "production" || process.env["RAILWAY_ENVIRONMENT_NAME"]
    ? []
    : [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:3010",
        "http://localhost:3010",
      ];
}

// Confirms the player's session and that their saved character is currently in this mall.
async function readMallMember(accessToken: string, locationId: string): Promise<MallMember> {
  const { url, key } = supabaseSettings();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
  };
  const authResponse = await fetch(`${url}/auth/v1/user`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!authResponse.ok) throw new Error("The game session could not be verified.");
  const user = (await authResponse.json()) as { id?: unknown };
  if (typeof user.id !== "string") throw new Error("The game session could not be verified.");

  const query = new URLSearchParams({
    select: "id,name,gender,appearance,current_location_id",
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  const characterResponse = await fetch(`${url}/rest/v1/characters?${query}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!characterResponse.ok) throw new Error("The saved character could not be loaded.");
  const character = (
    (await characterResponse.json()) as Array<{
      id: string;
      name: string;
      gender: string;
      appearance: unknown;
      current_location_id: string | null;
    }>
  )[0];
  if (!character) throw new Error("Create a character before entering the mall.");
  if (character.current_location_id !== locationId)
    throw new Error("Travel to the mall before joining it.");

  return {
    characterId: character.id,
    name: String(character.name ?? "Guest").slice(0, NAME_MAX),
    gender: String(character.gender ?? "nonbinary"),
    appearance: character.appearance,
    accessToken,
    position: [MALL_ENTRANCE[0], MALL_ENTRANCE[1]],
    allowance: MALL_MOVE_BURST,
    lastMoveAt: Date.now(),
  };
}

function isPoint(value: unknown): value is WalkPoint {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number" &&
    Number.isFinite(value[0]) &&
    Number.isFinite(value[1])
  );
}

export class MallRoom extends Room {
  override maxClients = MALL_MAX_PLAYERS;
  override maxMessagesPerSecond = 12;
  private readonly members = new Map<string, MallMember>();
  private locationId = "";
  private dirty = false;

  override onCreate(options: { locationId?: unknown }) {
    if (typeof options.locationId !== "string" || !UUID_PATTERN.test(options.locationId))
      throw new Error("A valid mall is required.");
    this.locationId = options.locationId;
    this.setMetadata({ locationId: options.locationId });
    this.onMessage("move", (client, payload: unknown) => this.moveMember(client, payload));
    this.setSimulationInterval(() => {
      if (!this.dirty) return;
      this.dirty = false;
      this.broadcastPresence();
    }, PRESENCE_INTERVAL_MS);
    this.clock.setInterval(() => void this.recheckMembers(), MEMBERSHIP_CHECK_MS);
  }

  override async onAuth(
    _client: Client,
    options: { locationId?: unknown; accessToken?: unknown },
    context: AuthContext,
  ) {
    if (
      typeof options.locationId !== "string" ||
      !UUID_PATTERN.test(options.locationId) ||
      typeof options.accessToken !== "string" ||
      options.accessToken.length < 32 ||
      options.accessToken.length > 4_096
    )
      throw new Error("Sign in with a saved character before entering the mall.");
    const origin = context.headers.get("origin");
    if (typeof origin !== "string" || !allowedOrigins().includes(origin))
      throw new Error("This website is not allowed to join the game server.");
    return readMallMember(options.accessToken, options.locationId);
  }

  override onJoin(client: Client, _options: unknown, auth: MallMember) {
    this.members.set(client.sessionId, auth);
    this.dirty = true;
    this.broadcastPresence();
  }

  override onLeave(client: Client) {
    this.members.delete(client.sessionId);
    this.dirty = true;
  }

  private moveMember(client: Client, payload: unknown) {
    const member = this.members.get(client.sessionId);
    if (!member || typeof payload !== "object" || payload === null) return;
    const target = (payload as Record<string, unknown>)["to"];
    if (!isPoint(target)) return;
    const now = Date.now();
    const elapsed = (now - member.lastMoveAt) / 1000;
    member.lastMoveAt = now;
    const result = checkMallMove(member.allowance, member.position, target, elapsed);
    if (!result.ok) {
      // Tell only this player where the server has them and why the move was refused.
      client.send("rejected", { position: member.position, reason: result.reason });
      return;
    }
    member.allowance = result.allowance;
    member.position = [target[0], target[1]];
    this.dirty = true;
  }

  /** Removes anyone whose saved character has left the mall or whose session is no longer valid. */
  private async recheckMembers() {
    const entries = [...this.members.entries()];
    const results = await Promise.allSettled(
      entries.map(([, member]) => readMallMember(member.accessToken, this.locationId)),
    );
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const [sessionId] = entries[index] ?? [];
        const client = sessionId ? this.clients.getById(sessionId) : undefined;
        client?.leave(4_003, "You left the mall.");
      }
    });
  }

  private broadcastPresence() {
    this.broadcast("presence", {
      people: [...this.members.entries()].map(([sessionId, member]) => ({
        sessionId,
        characterId: member.characterId,
        name: member.name,
        gender: member.gender,
        appearance: member.appearance,
        position: member.position,
      })),
    });
  }
}

import { Room, type AuthContext, type Client } from "colyseus";

// One room per club. The room only relays presence and dance cosmetics.
// Money, mood and cooldowns are changed by database RPCs; this room never writes to them.

type PartyMember = { characterId: string; name: string; locationId: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DANCE_MIN_INTERVAL_MS = 1_000;
const DANCE_NAME_MAX = 24;

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

// Confirms the player's session and that their character has an active, unexpired club visit here.
async function readClubMember(accessToken: string, locationId: string): Promise<PartyMember> {
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

  const characterQuery = new URLSearchParams({
    select: "id,name",
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  const characterResponse = await fetch(`${url}/rest/v1/characters?${characterQuery}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!characterResponse.ok) throw new Error("The saved character could not be loaded.");
  const character = ((await characterResponse.json()) as Array<{ id: string; name: string }>)[0];
  if (!character) throw new Error("Create a character before joining the party.");

  const visitQuery = new URLSearchParams({
    select: "location_id,expires_at",
    character_id: `eq.${character.id}`,
    ended_at: "is.null",
    limit: "1",
  });
  const visitResponse = await fetch(`${url}/rest/v1/club_visits?${visitQuery}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!visitResponse.ok) throw new Error("Your club visit could not be loaded.");
  const visit = (
    (await visitResponse.json()) as Array<{ location_id: string; expires_at: string }>
  )[0];
  if (!visit || visit.location_id !== locationId || Date.parse(visit.expires_at) <= Date.now())
    throw new Error("Join this club before joining its party room.");

  return {
    characterId: character.id,
    name: String(character.name ?? "Guest").slice(0, DANCE_NAME_MAX),
    locationId,
  };
}

export class PartyRoom extends Room {
  override maxClients = 40;
  override maxMessagesPerSecond = 5;

  private readonly members = new Map<string, PartyMember>();
  private readonly lastDanceAt = new Map<string, number>();

  override onCreate(options: { locationId?: unknown }) {
    if (typeof options.locationId !== "string" || !UUID_PATTERN.test(options.locationId))
      throw new Error("A valid club is required.");
    this.setMetadata({ locationId: options.locationId });
    this.onMessage("dance", (client, payload: unknown) => this.relayDance(client, payload));
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
      throw new Error("Sign in with a saved character before joining the party.");

    const origin = context.headers.get("origin");
    if (typeof origin !== "string" || !allowedOrigins().includes(origin))
      throw new Error("This website is not allowed to join the game server.");

    return readClubMember(options.accessToken, options.locationId);
  }

  override onJoin(client: Client, _options: unknown, auth: PartyMember) {
    this.members.set(client.sessionId, auth);
    this.broadcastPresence();
  }

  override onLeave(client: Client) {
    this.members.delete(client.sessionId);
    this.lastDanceAt.delete(client.sessionId);
    this.broadcastPresence();
  }

  private broadcastPresence() {
    this.broadcast("presence", {
      people: [...this.members.values()].map((member) => ({
        characterId: member.characterId,
        name: member.name,
      })),
    });
  }

  // Sent by the client only after dance_with_npc / dance_with_player succeeds.
  private relayDance(client: Client, payload: unknown) {
    const member = this.members.get(client.sessionId);
    if (!member || typeof payload !== "object" || payload === null) return;
    const now = Date.now();
    if (now - (this.lastDanceAt.get(client.sessionId) ?? 0) < DANCE_MIN_INTERVAL_MS) return;
    this.lastDanceAt.set(client.sessionId, now);

    const data = payload as Record<string, unknown>;
    if (
      data["partner"] === "npc" &&
      typeof data["npcSlug"] === "string" &&
      /^[a-z0-9-]{1,40}$/.test(data["npcSlug"])
    ) {
      this.broadcast("dance", { from: member.name, partner: "npc", npcSlug: data["npcSlug"] });
      return;
    }
    if (data["partner"] === "player" && typeof data["targetCharacterId"] === "string") {
      const target = [...this.members.values()].find(
        (candidate) => candidate.characterId === data["targetCharacterId"],
      );
      if (!target) return;
      this.broadcast("dance", { from: member.name, partner: "player", to: target.name });
    }
  }
}

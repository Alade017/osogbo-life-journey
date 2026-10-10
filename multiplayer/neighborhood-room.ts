import { Room, type AuthContext, type Client } from "colyseus";
import { NeighborhoodState, NetworkPlayer } from "../src/game/multiplayer-state.ts";
import {
  movementFacing,
  parseMovementIntent,
  stepAuthoritativePosition,
} from "../src/game/authoritative-movement.ts";
import { cityEntranceForRecord } from "../src/lib/city-world.ts";
import {
  neighborhoodAreaForSlug,
  neighborhoodAreaOrigin,
  type NeighborhoodArea,
  type WorldPoint,
} from "../src/game/neighborhood-model.ts";
import type { MovementIntent, NetworkPlayerSnapshot } from "../src/game/multiplayer-state.ts";

type CharacterRow = {
  id: string;
  name: string;
  gender: string;
  appearance: unknown;
  world_x: number | null;
  world_y: number | null;
  current_location_id: string | null;
};
type LocationRow = { id: string; slug: string; map_x: number; map_y: number };

type AuthenticatedPlayer = {
  userId: string;
  character: CharacterRow;
  area: NeighborhoodArea;
  areaOrigin: WorldPoint;
};

type InputState = { intent: MovementIntent; updatedAt: number };

const LOCATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_APPEARANCE = "{}";

function supabaseSettings() {
  const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key)
    throw new Error("The multiplayer server needs Supabase URL and publishable key configuration.");
  return { url: url.replace(/\/$/, ""), key };
}

async function readCharacter(accessToken: string, locationId: string) {
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
    select: "id,name,gender,appearance,world_x,world_y,current_location_id",
    user_id: `eq.${user.id}`,
    limit: "1",
  });
  const characterResponse = await fetch(`${url}/rest/v1/characters?${query}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!characterResponse.ok) throw new Error("The saved character could not be loaded.");
  const rows = (await characterResponse.json()) as CharacterRow[];
  const character = rows[0];
  if (!character || character.current_location_id !== locationId)
    throw new Error("Your character is not saved in this neighborhood.");
  const locationQuery = new URLSearchParams({
    select: "id,slug,map_x,map_y",
    id: `eq.${locationId}`,
    limit: "1",
  });
  const locationResponse = await fetch(`${url}/rest/v1/locations?${locationQuery}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!locationResponse.ok) throw new Error("The neighborhood could not be loaded.");
  const locationRows = (await locationResponse.json()) as LocationRow[];
  const location = locationRows[0];
  if (!location) throw new Error("The neighborhood could not be loaded.");
  const entrance = cityEntranceForRecord(location);
  return {
    userId: user.id,
    character,
    area: neighborhoodAreaForSlug(location.slug),
    areaOrigin: neighborhoodAreaOrigin(entrance),
  } satisfies AuthenticatedPlayer;
}

function playerSnapshot(character: CharacterRow, areaOrigin: WorldPoint): NetworkPlayerSnapshot {
  let appearance = EMPTY_APPEARANCE;
  try {
    appearance = JSON.stringify(character.appearance ?? {}) ?? EMPTY_APPEARANCE;
  } catch {
    appearance = EMPTY_APPEARANCE;
  }
  return {
    characterId: character.id,
    name: String(character.name ?? "Neighbour").slice(0, 24),
    gender: String(character.gender ?? "nonbinary").slice(0, 16),
    appearance,
    x: Number.isFinite(character.world_x) ? (character.world_x as number) : areaOrigin.x,
    y: Number.isFinite(character.world_y) ? (character.world_y as number) : areaOrigin.y,
    facing: "south",
  };
}

export class NeighborhoodRoom extends Room {
  override state = new NeighborhoodState();
  override maxClients = 32;
  override maxMessagesPerSecond = 30;
  override patchRate = 50;

  private readonly movement = new Map<string, InputState>();
  private areaOrigin: WorldPoint = { x: 7, y: 6 };
  private area = neighborhoodAreaForSlug(undefined);

  override onCreate(options: { locationId?: unknown }) {
    if (typeof options.locationId !== "string" || !LOCATION_ID_PATTERN.test(options.locationId))
      throw new Error("A valid neighborhood is required.");
    this.setMetadata({ locationId: options.locationId });
    this.onMessage("move", (client, payload: unknown) => {
      const intent = parseMovementIntent(payload);
      if (!intent) {
        this.movement.set(client.sessionId, { intent: { x: 0, y: 0 }, updatedAt: Date.now() });
        return;
      }
      this.movement.set(client.sessionId, { intent, updatedAt: Date.now() });
    });
    this.setSimulationInterval(() => this.stepPlayers(), 50);
  }

  override async onAuth(
    _client: Client,
    options: { locationId?: unknown; accessToken?: unknown },
    context: AuthContext,
  ) {
    if (
      typeof options.locationId !== "string" ||
      !LOCATION_ID_PATTERN.test(options.locationId) ||
      typeof options.accessToken !== "string" ||
      options.accessToken.length < 32 ||
      options.accessToken.length > 4_096
    )
      throw new Error("Sign in with a saved character before joining the neighborhood.");

    const origin = context.headers.get("origin");
    const configuredOrigins = process.env["MULTIPLAYER_ALLOWED_ORIGINS"]
      ?.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    const allowedOrigins = configuredOrigins?.length
      ? configuredOrigins
      : [
          "http://127.0.0.1:3000",
          "http://localhost:3000",
          "http://127.0.0.1:3010",
          "http://localhost:3010",
        ];
    if (typeof origin !== "string" || !allowedOrigins.includes(origin))
      throw new Error("This website is not allowed to join the game server.");

    const verified = await readCharacter(options.accessToken, options.locationId);
    return { ...verified, locationId: options.locationId };
  }

  override onJoin(client: Client, _options: unknown, auth: AuthenticatedPlayer) {
    this.areaOrigin = auth.areaOrigin;
    this.area = auth.area;
    const player = new NetworkPlayer(playerSnapshot(auth.character, auth.areaOrigin));
    this.state.players.set(client.sessionId, player);
    this.movement.set(client.sessionId, { intent: { x: 0, y: 0 }, updatedAt: Date.now() });
  }

  override onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.movement.delete(client.sessionId);
  }

  private stepPlayers() {
    const now = Date.now();
    const delta = 0.05;
    for (const [sessionId, player] of this.state.players) {
      const input = this.movement.get(sessionId);
      if (!input) continue;
      const intent = now - input.updatedAt > 250 ? { x: 0, y: 0 } : input.intent;
      const next = stepAuthoritativePosition(
        player,
        intent,
        delta,
        this.areaOrigin,
        this.area.objects,
      );
      player.x = next.x;
      player.y = next.y;
      player.facing = movementFacing(intent, player.facing);
    }
  }
}

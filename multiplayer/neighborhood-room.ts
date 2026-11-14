import { Room, type AuthContext, type Client } from "colyseus";
import { NeighborhoodState, NetworkPlayer } from "../src/game/multiplayer-state.ts";
import {
  canOccupyNeighborhoodPoint,
  canRestoreNeighborhoodCheckpoint,
  movementFacing,
  parseMovementIntent,
  PLAYER_WORLD_BOUNDS,
  stepAuthoritativePosition,
} from "../src/game/authoritative-movement.ts";
import { cityEntranceForRecord } from "../src/lib/city-world.ts";
import {
  advanceCommute,
  createCommutePlan,
  type CommuteContext,
  type CommutePlan,
} from "../src/game/commute-route.ts";
import { isPlayableLocationRecord } from "../src/game/playable-district.ts";
import {
  neighborhoodAreaForLocation,
  neighborhoodAreaForSlug,
  neighborhoodAreaOrigin,
  type NeighborhoodArea,
  type WorldPoint,
} from "../src/game/neighborhood-model.ts";
import type { MovementIntent, NetworkPlayerSnapshot } from "../src/game/multiplayer-state.ts";
import { supabaseAdmin } from "../src/integrations/supabase/client.server.ts";
import {
  CHECKPOINT_INTERVAL_MS,
  NeighborhoodCheckpoints,
  type CheckpointPoint,
  type CheckpointTarget,
} from "./neighborhood-checkpoints.ts";
import { verifyCommuteShift, type CommuteShiftRow } from "./commute-verification.ts";

type CharacterRow = {
  id: string;
  name: string;
  gender: string;
  appearance: unknown;
  world_x: number | null;
  world_y: number | null;
  current_location_id: string | null;
};
type LocationRow = {
  id: string;
  slug: string;
  name: string | null;
  map_category: string | null;
  map_x: number;
  map_y: number;
  is_active: boolean;
};

type AuthenticatedPlayer = {
  userId: string;
  accessToken: string;
  character: CharacterRow;
  equipment: string;
  area: NeighborhoodArea;
  areaOrigin: WorldPoint;
};

type InputState = { intent: MovementIntent; updatedAt: number };

/** A server-driven walk from the character's position to the workplace in this neighbourhood. */
type CommuteState = { client: Client; plan: CommutePlan };

const LOCATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMPTY_APPEARANCE = "{}";
const EMPTY_EQUIPMENT = "[]";

/**
 * Writes one checkpoint with the server-only admin client. The identity is always the one the room
 * verified at join time, never a value from the browser. Errors are rethrown without their details
 * so no key or token can reach the logs.
 */
async function saveCheckpoint(target: CheckpointTarget, point: CheckpointPoint) {
  const { data, error } = await supabaseAdmin.rpc("save_neighborhood_world_checkpoint", {
    p_character_id: target.characterId,
    p_user_id: target.userId,
    p_location_id: target.locationId,
    p_world_x: point.x,
    p_world_y: point.y,
  });
  if (error) throw new Error("checkpoint write failed");
  return (data as { saved?: unknown } | null)?.saved === true;
}

function serializeEquipment(rows: { slot?: unknown }[]) {
  const allowed = new Set(["head", "top", "bottom", "shoes", "accessory"]);
  return JSON.stringify(
    rows.flatMap(({ slot }) => (typeof slot === "string" && allowed.has(slot) ? [{ slot }] : [])),
  );
}

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
    select: "id,slug,name,map_category,map_x,map_y,is_active",
    id: `eq.${locationId}`,
    is_active: "eq.true",
    limit: "1",
  });
  const locationResponse = await fetch(`${url}/rest/v1/locations?${locationQuery}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!locationResponse.ok) throw new Error("The neighborhood could not be loaded.");
  const locationRows = (await locationResponse.json()) as LocationRow[];
  const location = locationRows[0];
  if (!isPlayableLocationRecord(location) || location.id !== locationId)
    throw new Error("This destination is not available for walking.");
  const area = neighborhoodAreaForLocation(location);
  const equipmentQuery = new URLSearchParams({
    select: "slot",
    character_id: `eq.${character.id}`,
  });
  const equipmentResponse = await fetch(`${url}/rest/v1/player_equipment?${equipmentQuery}`, {
    headers,
    signal: AbortSignal.timeout(5_000),
  });
  if (!equipmentResponse.ok) throw new Error("Your equipped items could not be loaded.");
  const equipment = serializeEquipment((await equipmentResponse.json()) as { slot?: unknown }[]);
  const entrance = cityEntranceForRecord(location);
  return {
    userId: user.id,
    accessToken,
    character,
    equipment,
    area,
    areaOrigin: neighborhoodAreaOrigin(entrance),
  } satisfies AuthenticatedPlayer;
}

function playerSnapshot(
  character: CharacterRow,
  areaOrigin: WorldPoint,
  area: NeighborhoodArea,
  equipment = EMPTY_EQUIPMENT,
): NetworkPlayerSnapshot {
  let appearance = EMPTY_APPEARANCE;
  try {
    appearance = JSON.stringify(character.appearance ?? {}) ?? EMPTY_APPEARANCE;
  } catch {
    appearance = EMPTY_APPEARANCE;
  }
  const savedPoint =
    typeof character.world_x === "number" && typeof character.world_y === "number"
      ? { x: character.world_x, y: character.world_y }
      : null;
  const spawn =
    savedPoint &&
    canRestoreNeighborhoodCheckpoint(savedPoint, areaOrigin, area.objects, area.obstacles)
      ? savedPoint
      : areaOrigin;
  return {
    characterId: character.id,
    name: String(character.name ?? "Neighbour").slice(0, 24),
    gender: String(character.gender ?? "nonbinary").slice(0, 16),
    appearance,
    equipment,
    x: spawn.x,
    y: spawn.y,
    facing: "south",
  };
}

export class NeighborhoodRoom extends Room {
  override state = new NeighborhoodState();
  override maxClients = 32;
  override maxMessagesPerSecond = 30;
  override patchRate = 50;

  private readonly movement = new Map<string, InputState>();
  private readonly credentials = new Map<
    string,
    { accessToken: string; locationId: string; characterId: string }
  >();
  private readonly commutes = new Map<string, CommuteState>();
  private readonly equipmentRefreshAt = new Map<string, number>();
  private readonly checkpoints = new NeighborhoodCheckpoints(saveCheckpoint, (message) =>
    console.warn(message),
  );
  private areaOrigin: WorldPoint = { x: 7, y: 6 };
  private area = neighborhoodAreaForSlug(undefined);

  override onCreate(options: { locationId?: unknown }) {
    if (typeof options.locationId !== "string" || !LOCATION_ID_PATTERN.test(options.locationId))
      throw new Error("A valid neighborhood is required.");
    this.setMetadata({ locationId: options.locationId });
    // The room clock is cleared automatically when the room is disposed.
    this.clock.setInterval(() => void this.persistCheckpoints(), CHECKPOINT_INTERVAL_MS);
    this.onMessage("move", (client, payload: unknown) => {
      const intent = parseMovementIntent(payload);
      // Any real movement input takes control back from an automatic commute.
      const commute = this.commutes.get(client.sessionId);
      if (commute && intent && (intent.x !== 0 || intent.y !== 0)) {
        this.endCommute(client.sessionId, commute, "cancelled");
      }
      if (!intent) {
        this.movement.set(client.sessionId, { intent: { x: 0, y: 0 }, updatedAt: Date.now() });
        return;
      }
      this.movement.set(client.sessionId, { intent, updatedAt: Date.now() });
    });
    this.onMessage(
      "commute-to-work",
      (client, payload: unknown) => void this.startCommute(client, payload),
    );
    this.onMessage("keke-dropoff", (client, payload: unknown) =>
      this.handleKekeDropoff(client, payload),
    );
    this.onMessage("refresh-equipment", (client) => void this.refreshEquipment(client));
    this.setSimulationInterval(() => this.stepPlayers(), 50);
  }

  private handleKekeDropoff(client: Client, payload: unknown) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !payload || typeof payload !== "object") return;
    const rawX = (payload as { x?: unknown }).x;
    const rawY = (payload as { y?: unknown }).y;
    if (
      typeof rawX !== "number" ||
      typeof rawY !== "number" ||
      !Number.isFinite(rawX) ||
      !Number.isFinite(rawY)
    ) {
      return;
    }
    const target = {
      x: Math.max(PLAYER_WORLD_BOUNDS.minX, Math.min(PLAYER_WORLD_BOUNDS.maxX, rawX)),
      y: Math.max(PLAYER_WORLD_BOUNDS.minY, Math.min(PLAYER_WORLD_BOUNDS.maxY, rawY)),
    };
    if (
      !canOccupyNeighborhoodPoint(target, this.areaOrigin, this.area.objects, this.area.obstacles)
    ) {
      client.send("keke-arrived", { ok: false, x: player.x, y: player.y });
      return;
    }
    const commute = this.commutes.get(client.sessionId);
    if (commute) {
      this.endCommute(client.sessionId, commute, "cancelled");
    }
    this.movement.set(client.sessionId, { intent: { x: 0, y: 0 }, updatedAt: Date.now() });
    player.x = target.x;
    player.y = target.y;
    player.facing = "south";
    client.send("keke-arrived", { ok: true, x: target.x, y: target.y });
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
      : process.env["NODE_ENV"] === "production" || process.env["RAILWAY_ENVIRONMENT_NAME"]
        ? []
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
    const player = new NetworkPlayer(
      playerSnapshot(auth.character, auth.areaOrigin, auth.area, auth.equipment),
    );
    this.state.players.set(client.sessionId, player);
    this.credentials.set(client.sessionId, {
      accessToken: auth.accessToken,
      locationId: auth.character.current_location_id!,
      characterId: auth.character.id,
    });
    this.checkpoints.track(
      client.sessionId,
      {
        userId: auth.userId,
        characterId: auth.character.id,
        locationId: auth.character.current_location_id!,
      },
      typeof auth.character.world_x === "number" && typeof auth.character.world_y === "number"
        ? { x: auth.character.world_x, y: auth.character.world_y }
        : null,
    );
    this.movement.set(client.sessionId, { intent: { x: 0, y: 0 }, updatedAt: Date.now() });
  }

  override onLeave(client: Client) {
    // Capture the authoritative position before the player is removed, then save it.
    const player = this.state.players.get(client.sessionId);
    const finalPosition = player ? { x: player.x, y: player.y } : undefined;
    this.state.players.delete(client.sessionId);
    this.movement.delete(client.sessionId);
    this.commutes.delete(client.sessionId);
    this.credentials.delete(client.sessionId);
    this.equipmentRefreshAt.delete(client.sessionId);
    void this.checkpoints.release(client.sessionId, finalPosition);
  }

  override onDispose() {
    return this.checkpoints.dispose();
  }

  private persistCheckpoints() {
    return this.checkpoints.saveAll((sessionId) => {
      const player = this.state.players.get(sessionId);
      return player ? { x: player.x, y: player.y } : undefined;
    });
  }

  private async refreshEquipment(client: Client) {
    const now = Date.now();
    if (now - (this.equipmentRefreshAt.get(client.sessionId) ?? 0) < 1_000) return;
    this.equipmentRefreshAt.set(client.sessionId, now);
    const credentials = this.credentials.get(client.sessionId);
    const player = this.state.players.get(client.sessionId);
    if (!credentials || !player) return;
    try {
      const fresh = await readCharacter(credentials.accessToken, credentials.locationId);
      player.equipment = fresh.equipment;
    } catch {
      // Keep the last verified snapshot; the normal reconnect path will retry.
    }
  }

  private async startCommute(client: Client, payload: unknown) {
    const shiftId =
      payload && typeof payload === "object"
        ? (payload as { shiftId?: unknown }).shiftId
        : undefined;
    const refuse = (reason: string) => client.send("commute-state", { status: "refused", reason });

    if (typeof shiftId !== "string" || !LOCATION_ID_PATTERN.test(shiftId))
      return refuse("That shift could not be found.");
    const credentials = this.credentials.get(client.sessionId);
    if (!credentials || !this.state.players.has(client.sessionId)) return;
    const workplace = this.area.objects.find((object) => object.kind === "work");
    if (!workplace) return refuse("There is no workplace in this neighbourhood.");

    let verdict;
    try {
      // Service role, server-only: the shift row is read here, never trusted from the client.
      const { data, error } = await supabaseAdmin
        .from("career_shifts")
        .select("id, character_id, location_id, status")
        .eq("id", shiftId)
        .maybeSingle();
      if (error) throw error;
      verdict = verifyCommuteShift(data as CommuteShiftRow | null, {
        characterId: credentials.characterId,
        locationId: credentials.locationId,
      });
    } catch {
      return refuse("Could not check your shift. Try again.");
    }
    if (!verdict.ok) return refuse(verdict.reason);

    // The player may have left while the shift was being checked.
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    const plan = createCommutePlan({ x: player.x, y: player.y }, workplace, this.commuteContext());
    if (!plan) return refuse("No walkable route to work from here.");

    this.commutes.set(client.sessionId, { client, plan });
    client.send("commute-state", { status: "started" });
  }

  private commuteContext(): CommuteContext {
    return {
      origin: this.areaOrigin,
      objects: this.area.objects,
      ...(this.area.obstacles ? { obstacles: this.area.obstacles } : {}),
    };
  }

  /** Ends a commute and tells the client why, so it can clear the banner or open work. */
  private endCommute(
    sessionId: string,
    commute: CommuteState,
    reason: "arrived" | "cancelled" | "blocked",
  ) {
    this.commutes.delete(sessionId);
    commute.client.send("commute-state", { status: "ended", reason });
  }

  /** Returns this tick's intent, or null when the commute has ended. */
  private commuteStep(
    sessionId: string,
    player: { x: number; y: number },
    commute: CommuteState,
  ): MovementIntent | null {
    const tick = advanceCommute(commute.plan, { x: player.x, y: player.y }, this.commuteContext());
    if (tick.status === "moving") return tick.intent;
    this.endCommute(sessionId, commute, tick.status === "arrived" ? "arrived" : "blocked");
    return null;
  }

  private stepPlayers() {
    const now = Date.now();
    const delta = 0.05;
    for (const [sessionId, player] of this.state.players) {
      let intent: MovementIntent;
      const commute = this.commutes.get(sessionId);
      if (commute) {
        const commuting = this.commuteStep(sessionId, player, commute);
        if (!commuting) continue;
        intent = commuting;
      } else {
        const input = this.movement.get(sessionId);
        if (!input) continue;
        intent = now - input.updatedAt > 250 ? { x: 0, y: 0 } : input.intent;
      }
      const next = stepAuthoritativePosition(
        player,
        intent,
        delta,
        this.areaOrigin,
        this.area.objects,
        this.area.obstacles,
      );
      player.x = next.x;
      player.y = next.y;
      player.facing = movementFacing(intent, player.facing);
    }
  }
}

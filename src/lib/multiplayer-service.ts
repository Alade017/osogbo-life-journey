import { Client } from "@colyseus/sdk";
import { supabase } from "@/integrations/supabase/client";
import { EQUIPMENT_REFRESH_EVENT } from "@/lib/equipment-service";

export type NeighborhoodRoom = Awaited<ReturnType<typeof joinNeighborhood>>;

type InteractionAuthorizationResponse = {
  requestId: string;
  landmarkId: string;
  actionId: string;
  token: string;
  expiresAt: number;
};

type InteractionAuthorizationError = { requestId: string | null; code: string };
type PendingInteractionAuthorization = {
  resolve: (authorization: InteractionAuthorizationResponse) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const interactionRequests = new WeakMap<
  NeighborhoodRoom,
  Map<string, PendingInteractionAuthorization>
>();
const authorizationListeners = new WeakSet<NeighborhoodRoom>();

function installInteractionAuthorizationListeners(room: NeighborhoodRoom) {
  if (authorizationListeners.has(room)) return;
  authorizationListeners.add(room);
  const pending = new Map<string, PendingInteractionAuthorization>();
  interactionRequests.set(room, pending);
  room.onMessage("interaction-authorization", (payload: InteractionAuthorizationResponse) => {
    const request = pending.get(payload?.requestId);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(payload.requestId);
    request.resolve(payload);
  });
  room.onMessage("interaction-authorization-error", (payload: InteractionAuthorizationError) => {
    if (typeof payload?.requestId !== "string") return;
    const request = pending.get(payload.requestId);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(payload.requestId);
    request.reject(new Error(payload.code || "INTERACTION_AUTH_FAILED"));
  });
  room.onLeave(() => {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error("NEIGHBORHOOD_DISCONNECTED"));
    }
    pending.clear();
  });
}

export function requestNeighborhoodInteractionAuthorization(
  room: NeighborhoodRoom,
  input: { requestId: string; landmarkId: string; actionId: string },
): Promise<InteractionAuthorizationResponse> {
  installInteractionAuthorizationListeners(room);
  const pending = interactionRequests.get(room);
  if (!pending) return Promise.reject(new Error("INTERACTION_AUTH_UNAVAILABLE"));
  if (pending.has(input.requestId)) return Promise.reject(new Error("INTERACTION_REQUEST_PENDING"));
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pending.delete(input.requestId);
      reject(new Error("INTERACTION_AUTH_TIMEOUT"));
    }, 8_000);
    pending.set(input.requestId, { resolve, reject, timeout });
    try {
      room.send("authorize-interaction", input);
    } catch (error) {
      clearTimeout(timeout);
      pending.delete(input.requestId);
      reject(error instanceof Error ? error : new Error("INTERACTION_AUTH_FAILED"));
    }
  });
}

export async function joinNeighborhood(locationId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in again to join the neighborhood.");

  const configuredEndpoints = import.meta.env["VITE_MULTIPLAYER_URL"]
    ?.split(",")
    .map((endpoint: string) => endpoint.trim())
    .filter(Boolean);
  const endpoints = configuredEndpoints?.length ? configuredEndpoints : ["ws://127.0.0.1:2567"];
  const startIndex = Math.floor(Math.random() * endpoints.length);
  let lastError: unknown;

  for (let offset = 0; offset < endpoints.length; offset += 1) {
    const endpoint = endpoints[(startIndex + offset) % endpoints.length];
    if (!endpoint) continue;

    try {
      const client = new Client(endpoint);
      const room = await client.joinOrCreate("neighborhood", { locationId, accessToken });
      installInteractionAuthorizationListeners(room);
      const refreshEquipment = () => room.send("refresh-equipment");
      window.addEventListener(EQUIPMENT_REFRESH_EVENT, refreshEquipment);
      room.onLeave(() => window.removeEventListener(EQUIPMENT_REFRESH_EVENT, refreshEquipment));
      return room;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No multiplayer server endpoint is configured.");
}

export type PartyPresence = { characterId: string; name: string };
export type PartyDanceEvent =
  | { from: string; partner: "npc"; npcSlug: string }
  | { from: string; partner: "player"; to: string };

// Joins the party room for one club. The server confirms the player is in that club
// before accepting the connection. Dance messages are cosmetic: money and mood never
// change through this room.
export async function joinPartyRoom(locationId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error("Sign in again to join the party.");

  const configuredEndpoints = import.meta.env["VITE_MULTIPLAYER_URL"]
    ?.split(",")
    .map((endpoint: string) => endpoint.trim())
    .filter(Boolean);
  const endpoints = configuredEndpoints?.length ? configuredEndpoints : ["ws://127.0.0.1:2567"];
  const startIndex = Math.floor(Math.random() * endpoints.length);
  let lastError: unknown;

  for (let offset = 0; offset < endpoints.length; offset += 1) {
    const endpoint = endpoints[(startIndex + offset) % endpoints.length];
    if (!endpoint) continue;
    try {
      const client = new Client(endpoint);
      return await client.joinOrCreate("party", { locationId, accessToken });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("No multiplayer server endpoint is configured.");
}

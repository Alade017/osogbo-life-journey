import { parseMapSchedule, type MapSchedule } from "@/lib/map-schedule";
import { supabase } from "@/integrations/supabase/client";
import type { Activity, Job } from "@/lib/game";
import type { PlaceActionResult } from "@/components/map/PlaceActionMenu";
import type { MapPlaceAction } from "@/components/map/OsogboMap.svg";

export type MapTravelResponse = {
  travel_id: string;
  landmark_id: string;
  fare: number;
  distance_m: number;
  travel_minutes: number;
  departed_at: string;
  arrival_at: string;
  status: "travelling" | "completed";
};

export type TownTravelResponse = {
  travel_id: string;
  from_town_id: string;
  to_town_id: string;
  fare: number;
  travel_minutes: number;
  arrival_at: string;
  status: "travelling" | "completed";
};

export type MapLandmarkDetails = {
  schedule?: MapSchedule | undefined;
  landmark: {
    id: string;
    district_id: string;
    location_id: string;
    player_location_id: string | null;
    min_age: number;
    name: string;
    description: string;
  };
  activities: Activity[];
  jobs: Job[];
  actions: MapPlaceAction[];
};

export async function requestAvailableMapLandmarks(): Promise<string[]> {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new MapApiError("Sign in to view the map.", "UNAUTHORIZED");
  const response = await fetch("/api/map/landmarks", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => null)) as {
    landmarkIds?: string[];
    error?: { code?: string };
  } | null;
  if (!response.ok || !Array.isArray(result?.landmarkIds)) {
    const code = result?.error?.code ?? "INTERNAL_ERROR";
    throw new MapApiError(code, code);
  }
  return result.landmarkIds;
}

export class MapApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "MapApiError";
  }
}

export async function requestMapTravel(landmarkId: string, idempotencyKey: string) {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new MapApiError("Sign in to travel.", "UNAUTHORIZED");

  const response = await fetch("/api/map/travel", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ destination_landmark_id: landmarkId }),
  });
  const result = (await response.json().catch(() => null)) as
    MapTravelResponse | { error?: { code?: string } } | null;
  if (!response.ok) {
    const code =
      result && "error" in result ? (result.error?.code ?? "INTERNAL_ERROR") : "INTERNAL_ERROR";
    throw new MapApiError(code, code);
  }
  return result as MapTravelResponse;
}

export async function requestTownTravel(destinationTownId: string, idempotencyKey: string) {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new MapApiError("Sign in to travel.", "UNAUTHORIZED");
  const response = await fetch("/api/map/town-travel", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({ destination_town_id: destinationTownId }),
  });
  const result = (await response.json().catch(() => null)) as
    TownTravelResponse | { error?: { code?: string } } | null;
  if (!response.ok) {
    const code =
      result && "error" in result ? (result.error?.code ?? "INTERNAL_ERROR") : "INTERNAL_ERROR";
    throw new MapApiError(code, code);
  }
  return result as TownTravelResponse;
}

export function getPendingTownTravelKey(townId: string) {
  const storageKey = `osun-town-travel-request-v1:${townId}`;
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    const key = crypto.randomUUID();
    localStorage.setItem(storageKey, key);
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearPendingTownTravelKey(townId: string, requestId: string) {
  const storageKey = `osun-town-travel-request-v1:${townId}`;
  try {
    if (localStorage.getItem(storageKey) === requestId) localStorage.removeItem(storageKey);
  } catch {
    // Server idempotency still protects the request when storage is unavailable.
  }
}

export async function requestMapLandmark(landmarkId: string, accountId: string) {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  const token = session?.access_token;
  if (error || !token) throw new MapApiError("Sign in to view this place.", "UNAUTHORIZED");
  if (session.user.id !== accountId) throw new MapApiError("Account changed", "UNAUTHORIZED");
  const response = await fetch(`/api/map/landmark/${encodeURIComponent(landmarkId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const result = (await response.json().catch(() => null)) as
    MapLandmarkDetails | { error?: { code?: string } } | null;
  if (!response.ok) {
    const code =
      result && "error" in result ? (result.error?.code ?? "INTERNAL_ERROR") : "INTERNAL_ERROR";
    throw new MapApiError(code, code);
  }
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== session.user.id)
    throw new MapApiError("Account changed", "UNAUTHORIZED");
  if (
    !result ||
    !("landmark" in result) ||
    result.landmark?.id !== landmarkId ||
    !Array.isArray(result.actions) ||
    !Array.isArray(result.activities) ||
    !Array.isArray(result.jobs)
  )
    throw new MapApiError("Invalid place details", "INVALID_RESPONSE");
  return {
    ...result,
    schedule: parseMapSchedule(
      result.schedule,
      result.actions.map((a) => a.id),
    ),
  };
}

export async function requestMapPlaceAction(
  landmarkId: string,
  actionId: string,
  requestId: string,
  accountId: string,
) {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  const token = session?.access_token;
  if (error || !token) throw new MapApiError("Sign in to do this activity.", "UNAUTHORIZED");
  if (session.user.id !== accountId) throw new MapApiError("Account changed", "UNAUTHORIZED");
  const response = await fetch("/api/map/action", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": requestId,
    },
    body: JSON.stringify({ landmarkId, actionId }),
  });
  const result = (await response.json().catch(() => null)) as
    PlaceActionResult | { error?: { code?: string } } | null;
  if (!response.ok) {
    const code =
      result && "error" in result ? (result.error?.code ?? "INTERNAL_ERROR") : "INTERNAL_ERROR";
    throw new MapApiError(code, code);
  }
  const current = await supabase.auth.getSession();
  if (current.error || current.data.session?.user.id !== accountId)
    throw new MapApiError("Account changed", "UNAUTHORIZED");
  return result as PlaceActionResult;
}

export function getPendingTravelKey(landmarkId: string) {
  const storageKey = "osogbo-map-travel-request-v1";
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      const pending = JSON.parse(stored) as { landmarkId?: unknown; key?: unknown };
      if (pending.landmarkId === landmarkId && typeof pending.key === "string") return pending.key;
    }
    const key = crypto.randomUUID();
    window.localStorage.setItem(storageKey, JSON.stringify({ landmarkId, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearPendingTravelKey(idempotencyKey: string) {
  const storageKey = "osogbo-map-travel-request-v1";
  try {
    const stored = window.localStorage.getItem(storageKey);
    const pending = stored ? (JSON.parse(stored) as { key?: unknown }) : null;
    if (pending?.key === idempotencyKey) window.localStorage.removeItem(storageKey);
  } catch {
    // Storage can be unavailable in private browsing; server idempotency still applies per request.
  }
}

export function getPendingMapActionKey(
  accountId: string,
  characterId: string,
  landmarkId: string,
  actionId: string,
) {
  const storageKey = "osogbo-map-action-requests-v1";
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      unknown
    >;
    const key = `${accountId}:${characterId}:${landmarkId}:${actionId}`;
    if (typeof stored[key] === "string") return stored[key] as string;
    const requestId = crypto.randomUUID();
    stored[key] = requestId;
    window.localStorage.setItem(storageKey, JSON.stringify(stored));
    return requestId;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearPendingMapActionKey(
  accountId: string,
  characterId: string,
  landmarkId: string,
  actionId: string,
  requestId: string,
) {
  const storageKey = "osogbo-map-action-requests-v1";
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      unknown
    >;
    const key = `${accountId}:${characterId}:${landmarkId}:${actionId}`;
    if (stored[key] === requestId) {
      delete stored[key];
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
    }
  } catch {
    // The server still guarantees idempotency for the key attached to the request.
  }
}

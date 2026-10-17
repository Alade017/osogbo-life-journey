import { supabase } from "@/integrations/supabase/client";
import type { Activity, Job } from "@/lib/game";
import type { PlaceActionResult } from "@/components/map/PlaceActionMenu";

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
  landmark: {
    id: string;
    district_id: string;
    location_id: string;
    min_age: number;
    name: string;
    description: string;
  };
  activities: Activity[];
  jobs: Job[];
};

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

export async function requestMapLandmark(landmarkId: string) {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new MapApiError("Sign in to view this place.", "UNAUTHORIZED");
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
  return result as MapLandmarkDetails;
}

export async function requestMapPlaceAction(
  landmarkId: string,
  actionId: string,
  requestId: string,
) {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (error || !token) throw new MapApiError("Sign in to do this activity.", "UNAUTHORIZED");
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

export function getPendingMapActionKey(landmarkId: string, actionId: string) {
  const storageKey = "osogbo-map-action-requests-v1";
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      unknown
    >;
    const key = `${landmarkId}:${actionId}`;
    if (typeof stored[key] === "string") return stored[key] as string;
    const requestId = crypto.randomUUID();
    stored[key] = requestId;
    window.localStorage.setItem(storageKey, JSON.stringify(stored));
    return requestId;
  } catch {
    return crypto.randomUUID();
  }
}

export function clearPendingMapActionKey(landmarkId: string, actionId: string, requestId: string) {
  const storageKey = "osogbo-map-action-requests-v1";
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      unknown
    >;
    const key = `${landmarkId}:${actionId}`;
    if (stored[key] === requestId) {
      delete stored[key];
      window.localStorage.setItem(storageKey, JSON.stringify(stored));
    }
  } catch {
    // The server still guarantees idempotency for the key attached to the request.
  }
}

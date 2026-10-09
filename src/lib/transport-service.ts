import type { Json } from "@/integrations/supabase/types";

export const TRAVEL_MODES = ["walking", "danfo", "keke", "okada", "car"] as const;
export type TravelMode = (typeof TRAVEL_MODES)[number];

export const TRAVEL_MODE_DETAILS: Record<TravelMode, { label: string; hint: string }> = {
  walking: { label: "Walk", hint: "No fare · slower trip" },
  danfo: { label: "Danfo", hint: "Shared ride · includes wait time" },
  keke: { label: "Keke", hint: "Local ride estimate" },
  okada: { label: "Okada", hint: "Quick ride estimate" },
  car: { label: "Car", hint: "Road route when available" },
};

type RouteConfig = { fareFactor: number; durationFactor: number; extraMinutes: number };
const ROUTE_CONFIG: Record<TravelMode, RouteConfig> = {
  walking: { fareFactor: 0, durationFactor: 2.4, extraMinutes: 0 },
  danfo: { fareFactor: 0.75, durationFactor: 1.25, extraMinutes: 5 },
  keke: { fareFactor: 1.15, durationFactor: 0.95, extraMinutes: 2 },
  okada: { fareFactor: 1.4, durationFactor: 0.8, extraMinutes: 1 },
  car: { fareFactor: 2.2, durationFactor: 0.7, extraMinutes: 2 },
};

export type TripEstimate = { fare: number; minutes: number; source: "game estimate" };

/** Accelerated visible journey time; this does not change the simulation-clock cost. */
export function travelAnimationDurationMs(gameMinutes: number): number {
  return Math.min(5_000, Math.max(1_000, Math.ceil(gameMinutes * 180)));
}

export function isTravelMode(value: unknown): value is TravelMode {
  return typeof value === "string" && TRAVEL_MODES.includes(value as TravelMode);
}

/** Reads optional, per-location mode rules; otherwise the simulation's five modes are enabled. */
export function getAvailableTravelModes(metadata: Json): TravelMode[] {
  if (metadata === null || typeof metadata !== "object" || Array.isArray(metadata))
    return [...TRAVEL_MODES];
  const configured = (metadata as Record<string, Json | undefined>)["available_transport_modes"];
  if (!Array.isArray(configured)) return [...TRAVEL_MODES];
  return TRAVEL_MODES.filter((mode) => configured.includes(mode));
}

/** Deterministic simulation rules mirrored and validated by the travel RPC. */
export function estimateTrip(
  mode: TravelMode,
  baseFare: number,
  baseMinutes: number,
): TripEstimate {
  const rule = ROUTE_CONFIG[mode];
  return {
    fare: Math.max(0, Math.ceil(baseFare * rule.fareFactor)),
    minutes: Math.max(1, Math.ceil(baseMinutes * rule.durationFactor) + rule.extraMinutes),
    source: "game estimate",
  };
}

export function validateTripRequest({
  destinationId,
  currentLocationId,
  mode,
  availableModes,
  balance,
  fare,
}: {
  destinationId: string | null;
  currentLocationId: string | null;
  mode: TravelMode;
  availableModes: readonly TravelMode[];
  balance: number;
  fare: number;
}): string | null {
  if (!destinationId) return "Choose a valid destination.";
  if (destinationId === currentLocationId) return "You are already at this destination.";
  if (!availableModes.includes(mode))
    return `${TRAVEL_MODE_DETAILS[mode].label} is unavailable here.`;
  if (balance < fare)
    return `You need ₦${(fare - balance).toLocaleString("en-NG")} more for this trip.`;
  return null;
}

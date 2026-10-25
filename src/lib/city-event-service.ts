import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CityEventOccurrence = {
  occurrenceId: string;
  id: string;
  title: string;
  description: string;
  locationSlug: string;
  locationName: string;
  landmarkId: string;
  districtId: string;
  startsAt: string;
  endsAt: string;
  status: "active" | "upcoming" | "cancelled" | "unavailable";
  joined: boolean;
};
export type CityEventSnapshot = { serverTime: string; events: CityEventOccurrence[] };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";
const timestamp = (v: unknown): v is string =>
  typeof v === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const invalid = () => new Error("The server returned invalid city events. Refresh and try again.");
function rpcError(error: { message: string; code?: string }) {
  return new Error(
    error.code === "PGRST202"
      ? "City events are not available yet. Try again later."
      : error.message,
  );
}
export function parseCityEvents(value: unknown): CityEventSnapshot {
  if (
    !object(value) ||
    !timestamp(value["serverTime"]) ||
    !Array.isArray(value["events"]) ||
    value["events"].length > 6
  )
    throw invalid();
  const ids = new Set<string>();
  for (const event of value["events"]) {
    if (!object(event)) throw invalid();
    for (const key of [
      "occurrenceId",
      "id",
      "title",
      "description",
      "locationSlug",
      "locationName",
      "landmarkId",
      "districtId",
    ]) {
      if (typeof event[key] !== "string" || !event[key].trim()) throw invalid();
    }
    if (
      !timestamp(event["startsAt"]) ||
      !timestamp(event["endsAt"]) ||
      Date.parse(event["endsAt"]) <= Date.parse(event["startsAt"]) ||
      Date.parse(event["endsAt"]) <= Date.parse(value["serverTime"]) ||
      !["active", "upcoming", "cancelled", "unavailable"].includes(String(event["status"])) ||
      typeof event["joined"] !== "boolean" ||
      ids.has(String(event["occurrenceId"])) ||
      (event["status"] === "active" &&
        Date.parse(event["startsAt"]) > Date.parse(value["serverTime"])) ||
      (event["status"] === "upcoming" &&
        Date.parse(event["startsAt"]) <= Date.parse(value["serverTime"]))
    )
      throw invalid();
    ids.add(String(event["occurrenceId"]));
  }
  return value as unknown as CityEventSnapshot;
}
export function parseCityEventJoin(value: unknown): { joined: true; duplicate: boolean } {
  if (!object(value) || value["joined"] !== true || typeof value["duplicate"] !== "boolean")
    throw invalid();
  return { joined: true, duplicate: value["duplicate"] };
}
export async function getCityEvents(): Promise<CityEventSnapshot> {
  const { data, error } = await supabase.rpc("get_city_events");
  if (error) throw rpcError(error);
  return parseCityEvents(data);
}
export async function joinCityEventOccurrence(occurrenceId: string) {
  const { data, error } = await supabase.rpc("join_city_event_occurrence", {
    p_occurrence_id: occurrenceId,
  });
  if (error) throw rpcError(error);
  return parseCityEventJoin(data);
}
export const cityEventsKey = (userId: string, characterId: string) =>
  ["cityEvents", userId, characterId] as const;
export const cityEventOptions = (userId: string, characterId: string) =>
  queryOptions({
    queryKey: cityEventsKey(userId, characterId),
    queryFn: getCityEvents,
    enabled: !!userId && !!characterId,
    staleTime: 5_000,
    retry: false,
    refetchOnWindowFocus: "always",
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 15_000;
      const now = Date.parse(data.serverTime) + Date.now() - query.state.dataUpdatedAt;
      const boundaries = data.events
        .flatMap((event) => [Date.parse(event.startsAt), Date.parse(event.endsAt)])
        .filter((t) => t > now);
      return Math.max(1000, Math.min(15_000, ...boundaries.map((t) => t - now)));
    },
  });
export function cityEventsForDistrict(
  events: readonly CityEventOccurrence[],
  districtId: string | undefined,
) {
  return events.filter((event) => event.status === "active" && event.districtId === districtId);
}
export function cityEventTransitions(
  previous: readonly CityEventOccurrence[],
  next: readonly CityEventOccurrence[],
) {
  const was = new Map(
    previous.filter((e) => e.status === "active").map((e) => [e.occurrenceId, e]),
  );
  const active = new Set(next.filter((e) => e.status === "active").map((e) => e.occurrenceId));
  return {
    started: next.filter((e) => e.status === "active" && !was.has(e.occurrenceId)),
    ended: [...was.values()].filter((e) => !active.has(e.occurrenceId)),
  };
}

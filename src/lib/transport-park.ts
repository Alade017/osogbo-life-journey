import { isTravelMode, type TravelMode } from "./transport-service";

/** An initial preference only; destination metadata and the travel RPC still determine availability. */
export function transportPreference(href: string): TravelMode | null {
  const value = new URLSearchParams(href.split("?")[1]?.split("#")[0] ?? "").get("transport");
  return isTravelMode(value) ? value : null;
}
export function transportMapHref(mode: TravelMode | null): string {
  return mode && isTravelMode(mode) ? "/map?transport=" + encodeURIComponent(mode) : "/map";
}

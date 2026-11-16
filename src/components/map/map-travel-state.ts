import type { TravelMode } from "@/lib/transport-service";
export type MapTravelPhase =
  | "idle"
  | "editing"
  | "submitting"
  | "departing"
  | "syncing"
  | "sync-error"
  | "submit-error"
  | "arrived";
export type MapTravelTab = "travel" | "details";
export type MapTravelState<T> = {
  landmark: T | null;
  tab: MapTravelTab;
  mode: TravelMode | null;
  phase: MapTravelPhase;
  confirmedDestinationId: string | null;
  error: string | null;
};
export type MapTravelAction<T> =
  | { type: "select"; landmark: T; tab?: MapTravelTab }
  | { type: "tab"; tab: MapTravelTab }
  | { type: "mode"; mode: TravelMode }
  | { type: "close" }
  | { type: "reset" }
  | { type: "start"; departing?: boolean }
  | { type: "confirmed"; destinationId: string }
  | { type: "sync" }
  | { type: "arrived" }
  | { type: "fail"; message: string };
export function initialMapTravelState<T>(): MapTravelState<T> {
  return {
    landmark: null,
    tab: "travel",
    mode: null,
    phase: "idle",
    confirmedDestinationId: null,
    error: null,
  };
}
export function mapTravelBusy(phase: MapTravelPhase) {
  return ["submitting", "departing", "syncing"].includes(phase);
}
export function reduceMapTravelState<T>(
  state: MapTravelState<T>,
  action: MapTravelAction<T>,
): MapTravelState<T> {
  switch (action.type) {
    case "reset":
      return initialMapTravelState<T>();
    case "select":
      return mapTravelBusy(state.phase) || state.confirmedDestinationId
        ? state
        : {
            ...initialMapTravelState<T>(),
            landmark: action.landmark,
            tab: action.tab ?? "travel",
            phase: "editing",
          };
    case "close":
      return mapTravelBusy(state.phase) ||
        (state.confirmedDestinationId && state.phase !== "arrived")
        ? state
        : initialMapTravelState<T>();
    case "tab":
      return mapTravelBusy(state.phase) || state.confirmedDestinationId
        ? state
        : { ...state, tab: action.tab };
    case "mode":
      return mapTravelBusy(state.phase) || state.confirmedDestinationId
        ? state
        : { ...state, mode: action.mode, error: null, phase: "editing" };
    case "start":
      return {
        ...state,
        phase: action.departing ? "departing" : "submitting",
        error: null,
        tab: "travel",
      };
    case "confirmed":
      return {
        ...state,
        phase: "syncing",
        confirmedDestinationId: action.destinationId,
        error: null,
      };
    case "sync":
      return state.confirmedDestinationId ? { ...state, phase: "syncing", error: null } : state;
    case "arrived":
      return { ...state, phase: "arrived", error: null };
    case "fail":
      return {
        ...state,
        phase: state.confirmedDestinationId ? "sync-error" : "submit-error",
        error: action.message,
      };
  }
}

export function mapTravelError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/INSUFFICIENT_FUNDS|insufficient|enough money/i.test(message))
    return "You do not have enough money for this trip. Choose a cheaper option or walk.";
  if (/already at|ALREADY_THERE/i.test(message))
    return "You are already at this destination. Refresh your location to continue.";
  return "Travel could not be confirmed. Check your connection and try again.";
}

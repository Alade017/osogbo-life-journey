export type TravelStatus = "idle" | "selecting_destination" | "traveling" | "arrived" | "cancelled";

export type TravelState = {
  status: TravelStatus;
  originId: string | null;
  destinationId: string | null;
  destinationName: string | null;
  fare: number | null;
  estimatedMinutes: number | null;
  error: string | null;
};

export type TravelEvent =
  | {
      type: "select_destination";
      originId: string | null;
      destinationId: string;
      destinationName: string;
      fare: number;
      estimatedMinutes: number;
    }
  | { type: "start" }
  | { type: "arrive"; estimatedMinutes: number }
  | { type: "fail"; message: string }
  | { type: "cancel" }
  | { type: "reset" };

export const initialTravelState: TravelState = {
  status: "idle",
  originId: null,
  destinationId: null,
  destinationName: null,
  fare: null,
  estimatedMinutes: null,
  error: null,
};

export function travelReducer(state: TravelState, event: TravelEvent): TravelState {
  switch (event.type) {
    case "select_destination":
      return {
        status: "selecting_destination",
        originId: event.originId,
        destinationId: event.destinationId,
        destinationName: event.destinationName,
        fare: event.fare,
        estimatedMinutes: event.estimatedMinutes,
        error: null,
      };
    case "start":
      return state.status === "selecting_destination"
        ? { ...state, status: "traveling", error: null }
        : state;
    case "arrive":
      return state.status === "traveling"
        ? { ...state, status: "arrived", estimatedMinutes: event.estimatedMinutes, error: null }
        : state;
    case "fail":
      return state.status === "traveling"
        ? { ...state, status: "selecting_destination", error: event.message }
        : state;
    case "cancel":
      return state.status === "selecting_destination"
        ? { ...state, status: "cancelled", error: null }
        : state;
    case "reset":
      return initialTravelState;
  }
}

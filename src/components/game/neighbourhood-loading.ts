/**
 * One loading message for the neighbourhood page. Only one stage shows at a time, in the order
 * the player waits through them, so loaders never stack or repeat.
 */
export type NeighbourhoodConnection =
  "loading" | "connecting" | "connected" | "unavailable" | "wrong-area";

export type NeighbourhoodLoadingInput = {
  /** The saved character or location is still being read. */
  pageLoading: boolean;
  connection: NeighbourhoodConnection;
  connectionError: string | null;
  /** The neighbourhood layout for this location is known. */
  hasDistrict: boolean;
  /** The personal home entrance is still being checked. */
  homeLoading: boolean;
  /** The 3D scene has mounted and is ready to draw. */
  sceneReady: boolean;
};

export type NeighbourhoodLoadingStage = {
  title: string;
  detail: string;
  /** Show a Retry control, which is only useful when the connection has failed. */
  retry: boolean;
};

const CONNECTING_DETAIL = "Fetching your neighbourhood and connecting to the game server…";
const SLOW_DETAIL = "Your connection is slow. Reconnecting automatically…";

export function neighbourhoodLoadingStage(
  input: NeighbourhoodLoadingInput,
): NeighbourhoodLoadingStage | null {
  if (input.pageLoading) {
    return {
      title: "Opening the neighbourhood",
      detail: "Loading your saved character and location…",
      retry: false,
    };
  }
  if (input.connection === "unavailable") {
    return {
      title: "Entering the neighbourhood",
      detail: input.connectionError ?? SLOW_DETAIL,
      retry: input.connectionError !== null,
    };
  }
  if (input.connection === "loading" || input.connection === "connecting") {
    return {
      title: "Entering the neighbourhood",
      detail: CONNECTING_DETAIL,
      retry: input.connectionError !== null,
    };
  }
  if (input.connection !== "connected" || !input.hasDistrict) return null;
  if (input.homeLoading) {
    return {
      title: "Entering the neighbourhood",
      detail: "Checking your home entrance…",
      retry: false,
    };
  }
  if (!input.sceneReady) {
    return {
      title: "Loading the neighbourhood",
      detail: "Preparing the world scene…",
      retry: false,
    };
  }
  return null;
}

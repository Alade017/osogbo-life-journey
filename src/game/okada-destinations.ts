/**
 * Where an okada rider can take a passenger. The server accepts only these names (it checks
 * "Home" and the location names in the database), so the phone app and the street use this list.
 */
export const OKADA_HOME = "Home";

export const OKADA_DESTINATIONS: readonly string[] = [
  OKADA_HOME,
  "Market Square",
  "Meridian Bank",
  "Town Market",
  "Central Crossing",
  "Riverside Food Court",
  "Youth Arts Centre",
];

/** A ride lasts this long on the server: searching for 20 seconds, then 3 minutes on the road. */
export const OKADA_SEARCH_SECONDS = 20;
export const OKADA_RIDE_SECONDS = 180;

export type OkadaRideStatus = "requested" | "assigned" | "completed" | "cancelled";

/**
 * What the visitor should see for a ride, from its status and when it was made. The server moves
 * rides along when it is asked (okada_ride_sync); this only reads the state for display.
 */
export function rideProgress(
  status: OkadaRideStatus,
  createdAt: number,
  now: number,
): { label: string; canCancel: boolean } {
  if (status === "completed") return { label: "You have arrived.", canCancel: false };
  if (status === "cancelled")
    return { label: "Ride cancelled. Your fare was refunded.", canCancel: false };
  if (status === "assigned") return { label: "Your rider is on the way.", canCancel: false };
  const searchingFor = (now - createdAt) / 1000;
  return {
    label:
      searchingFor < OKADA_SEARCH_SECONDS
        ? "Looking for a rider nearby…"
        : "A rider has been found.",
    canCancel: searchingFor < OKADA_SEARCH_SECONDS,
  };
}

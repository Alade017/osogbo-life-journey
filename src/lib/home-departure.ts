import type { TravelMode } from "@/lib/transport-service";

export type HomeDeparture = { locationId: string; mode: TravelMode };

/**
 * A trip started from inside the house. The house screen plays the door and the walk out while
 * the travel request runs, so the map hands the trip over instead of travelling directly.
 */
let pendingDeparture: HomeDeparture | null = null;

export function requestDepartureFromHome(departure: HomeDeparture) {
  pendingDeparture = departure;
}

export function takeDepartureFromHome(): HomeDeparture | null {
  return pendingDeparture;
}

export function clearDepartureFromHome(departure: HomeDeparture) {
  if (
    pendingDeparture?.locationId === departure.locationId &&
    pendingDeparture.mode === departure.mode
  ) {
    pendingDeparture = null;
  }
}

import type { TravelMode } from "@/lib/transport-service";

export type HomeDeparture = {
  locationId: string;
  mode: TravelMode;
  characterId: string;
  fromLocationId: string;
};

export type HomeDepartureReadiness = {
  houseAvailable: boolean;
  isInsideHome: boolean;
  editing: boolean;
  busy: boolean;
  offline: boolean;
  activeCharacterId: string | undefined;
  activeLocationId: string | undefined;
};

/**
 * A trip started from inside the house is handed to the house screen so the player can walk
 * to the door before the canonical travel RPC is called.
 */
let pendingDeparture: HomeDeparture | null = null;

export function peekPendingDepartureFromHome(): HomeDeparture | null {
  return pendingDeparture;
}

export function requestDepartureFromHome(departure: HomeDeparture): HomeDeparture {
  pendingDeparture = departure;
  return departure;
}

/** Clear only the request owned by the caller; a newer request must remain queued. */
export function clearPendingDepartureFromHome(departure: HomeDeparture): boolean {
  if (pendingDeparture !== departure) return false;
  pendingDeparture = null;
  return true;
}

export function takeDepartureFromHome(): HomeDeparture | null {
  const next = pendingDeparture;
  pendingDeparture = null;
  return next;
}

/** Do not consume a queued trip until the house scene can safely execute it. */
export function takeDepartureFromHomeWhenReady(
  readiness: HomeDepartureReadiness,
): HomeDeparture | null {
  if (
    !readiness.houseAvailable ||
    !readiness.isInsideHome ||
    readiness.editing ||
    readiness.busy ||
    readiness.offline
  )
    return null;
  if (
    pendingDeparture &&
    (pendingDeparture.characterId !== readiness.activeCharacterId ||
      pendingDeparture.fromLocationId !== readiness.activeLocationId)
  ) {
    pendingDeparture = null;
    return null;
  }
  return takeDepartureFromHome();
}

/** The travel callback is never invoked unless the walk to the door completes successfully. */
export async function runHomeDepartureAfterWalk(
  walkToDoor: () => Promise<boolean>,
  travel: () => Promise<unknown>,
): Promise<boolean> {
  if (!(await walkToDoor())) return false;
  await travel();
  return true;
}

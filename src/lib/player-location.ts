import type { CityLocationData } from "@/lib/location-service";
import type { Character } from "@/lib/game";

/** Player map state derived from the authenticated character and its saved district. */
export type PlayerLocation = {
  playerId: string;
  playerName: string;
  currentLocationId: string | null;
  location: CityLocationData | null;
  latitude: number | null;
  longitude: number | null;
  movementStatus: "idle";
  destinationId: null;
};

export function resolvePlayerLocation(
  character: Character | null | undefined,
  locations: CityLocationData[] | undefined,
): PlayerLocation | null {
  if (!character) return null;

  const savedLocation =
    locations?.find((location) => location.id === character.current_location_id) ?? null;
  const hasCoordinates =
    typeof savedLocation?.latitude === "number" &&
    Number.isFinite(savedLocation.latitude) &&
    savedLocation.latitude >= -90 &&
    savedLocation.latitude <= 90 &&
    typeof savedLocation.longitude === "number" &&
    Number.isFinite(savedLocation.longitude) &&
    savedLocation.longitude >= -180 &&
    savedLocation.longitude <= 180;

  return {
    playerId: character.id,
    playerName: character.name,
    currentLocationId: character.current_location_id,
    location: savedLocation,
    latitude: hasCoordinates ? savedLocation.latitude : null,
    longitude: hasCoordinates ? savedLocation.longitude : null,
    movementStatus: "idle",
    destinationId: null,
  };
}

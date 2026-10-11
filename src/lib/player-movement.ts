export const OSOGBO_PLAYABLE_BOUNDS = {
  west: 4.25,
  east: 4.88,
  south: 7.48,
  north: 8.02,
} as const;

// Virtual spawn at the map's Osogbo center; this is not a device location.
export const OSOGBO_VIRTUAL_SPAWN = { latitude: 7.7677, longitude: 4.556 } as const;
export type VirtualPosition = { latitude: number; longitude: number };
export type MovementState = "idle" | "walking";
export type MovementDirection = "north" | "south" | "east" | "west";
export type PlayerMovementEvent = {
  position: VirtualPosition;
  movementState: MovementState;
  changedAt: number;
};

export function isPlayableOsogboPosition(position: VirtualPosition): boolean {
  return (
    Number.isFinite(position.latitude) &&
    Number.isFinite(position.longitude) &&
    position.latitude >= OSOGBO_PLAYABLE_BOUNDS.south &&
    position.latitude <= OSOGBO_PLAYABLE_BOUNDS.north &&
    position.longitude >= OSOGBO_PLAYABLE_BOUNDS.west &&
    position.longitude <= OSOGBO_PLAYABLE_BOUNDS.east
  );
}

export function stepVirtualPosition(
  position: VirtualPosition,
  directions: ReadonlySet<MovementDirection>,
  elapsedMs: number,
  degreesPerSecond = 0.00005,
): VirtualPosition {
  if (!directions.size || !isPlayableOsogboPosition(position)) return position;
  const north = Number(directions.has("north")) - Number(directions.has("south"));
  const east = Number(directions.has("east")) - Number(directions.has("west"));
  const magnitude = Math.hypot(north, east) || 1;
  const distance = (Math.min(Math.max(elapsedMs, 0), 50) / 1000) * degreesPerSecond;
  return {
    latitude: Math.min(
      OSOGBO_PLAYABLE_BOUNDS.north,
      Math.max(OSOGBO_PLAYABLE_BOUNDS.south, position.latitude + (north / magnitude) * distance),
    ),
    longitude: Math.min(
      OSOGBO_PLAYABLE_BOUNDS.east,
      Math.max(OSOGBO_PLAYABLE_BOUNDS.west, position.longitude + (east / magnitude) * distance),
    ),
  };
}

const movementListeners = new Set<(event: PlayerMovementEvent) => void>();
export function subscribePlayerMovement(listener: (event: PlayerMovementEvent) => void) {
  movementListeners.add(listener);
  return () => {
    movementListeners.delete(listener);
  };
}

export function publishPlayerMovement(position: VirtualPosition, movementState: MovementState) {
  const event = { position, movementState, changedAt: Date.now() };
  movementListeners.forEach((listener) => listener(event));
}

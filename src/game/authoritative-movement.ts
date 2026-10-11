import type { MovementIntent, NetworkPlayerSnapshot } from "./multiplayer-state.ts";
import {
  NEIGHBORHOOD_OBJECTS,
  toScene,
  type NeighborhoodObject,
  type WorldPoint,
} from "./neighborhood-model.ts";

export const PLAYER_SPEED = 0.6875;
export const PLAYER_WORLD_BOUNDS = { minX: 0, maxX: 14, minY: 0, maxY: 12 } as const;

export function canOccupyNeighborhoodPoint(
  point: WorldPoint,
  origin: WorldPoint,
  objects: readonly NeighborhoodObject[] = NEIGHBORHOOD_OBJECTS,
) {
  const scenePoint = toScene(point, origin);
  const body = {
    left: scenePoint.x - 8,
    right: scenePoint.x + 8,
    top: scenePoint.y + 8,
    bottom: scenePoint.y + 20,
  };
  return objects.every((object) => {
    if (object.kind === "npc") return true;
    const solid = {
      left: object.x - 57,
      right: object.x + 57,
      top: object.y - 62,
      bottom: object.y - 4,
    };
    return (
      body.right <= solid.left ||
      body.left >= solid.right ||
      body.bottom <= solid.top ||
      body.top >= solid.bottom
    );
  });
}

export function parseMovementIntent(value: unknown): MovementIntent | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  const x = candidate["x"];
  const y = candidate["y"];
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    Math.abs(x) > 1 ||
    Math.abs(y) > 1 ||
    (x !== 0 && Math.abs(x) !== 1) ||
    (y !== 0 && Math.abs(y) !== 1)
  )
    return null;
  return { x, y };
}

export function stepAuthoritativePosition(
  player: Pick<NetworkPlayerSnapshot, "x" | "y">,
  intent: MovementIntent,
  deltaSeconds: number,
  origin: WorldPoint = { x: 7, y: 6 },
  objects: readonly NeighborhoodObject[] = NEIGHBORHOOD_OBJECTS,
) {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return { x: player.x, y: player.y };
  const magnitude = Math.hypot(intent.x, intent.y);
  if (!magnitude) return { x: player.x, y: player.y };
  const distance = (PLAYER_SPEED * Math.min(deltaSeconds, 0.1)) / magnitude;
  const next = {
    x: Math.max(
      PLAYER_WORLD_BOUNDS.minX,
      Math.min(PLAYER_WORLD_BOUNDS.maxX, player.x + intent.x * distance),
    ),
    y: Math.max(
      PLAYER_WORLD_BOUNDS.minY,
      Math.min(PLAYER_WORLD_BOUNDS.maxY, player.y + intent.y * distance),
    ),
  };
  if (canOccupyNeighborhoodPoint(next, origin, objects)) return next;
  const horizontal = { ...next, y: player.y };
  if (canOccupyNeighborhoodPoint(horizontal, origin, objects)) return horizontal;
  const vertical = { x: player.x, y: next.y };
  return canOccupyNeighborhoodPoint(vertical, origin, objects)
    ? vertical
    : { x: player.x, y: player.y };
}

export function movementFacing(intent: MovementIntent, currentFacing: string) {
  if (!intent.x && !intent.y) return currentFacing;
  if (Math.abs(intent.x) > Math.abs(intent.y)) return intent.x < 0 ? "west" : "east";
  return intent.y < 0 ? "north" : "south";
}

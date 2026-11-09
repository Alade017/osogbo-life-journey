import {
  NEIGHBORHOOD_SCENE_BOUNDS,
  NEIGHBORHOOD_TILE_SIZE,
  type GroundRect,
} from "@/game/neighborhood-geometry";
import type { NeighborhoodObject } from "@/game/neighborhood-model";

const NPC_SLOT_SPACING = NEIGHBORHOOD_TILE_SIZE * 0.425;
const NPC_CLEARANCE = 22;
const NPC_SEPARATION = 42;
const SCENE_MARGIN = NPC_SEPARATION / 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

type NpcPoint = { x: number; y: number };

function isInsideScene(point: NpcPoint): boolean {
  const bounds = NEIGHBORHOOD_SCENE_BOUNDS;
  return (
    point.x >= bounds.left + SCENE_MARGIN &&
    point.x <= bounds.left + bounds.width - SCENE_MARGIN &&
    point.y >= bounds.top + SCENE_MARGIN &&
    point.y <= bounds.top + bounds.height - SCENE_MARGIN
  );
}

function overlapsFootprint(point: NpcPoint, footprints: readonly GroundRect[]): boolean {
  return footprints.some(
    (footprint) =>
      point.x >= footprint.left - NPC_CLEARANCE &&
      point.x <= footprint.left + footprint.width + NPC_CLEARANCE &&
      point.y >= footprint.top - NPC_CLEARANCE &&
      point.y <= footprint.top + footprint.height + NPC_CLEARANCE,
  );
}

function overlapsNpc(point: NpcPoint, occupiedPoints: readonly NpcPoint[]): boolean {
  return occupiedPoints.some(
    (occupied) => Math.hypot(point.x - occupied.x, point.y - occupied.y) < NPC_SEPARATION,
  );
}

function isAvailable(
  point: NpcPoint,
  occupied: readonly GroundRect[],
  occupiedPoints: readonly NpcPoint[],
): boolean {
  return (
    isInsideScene(point) &&
    !overlapsFootprint(point, occupied) &&
    !overlapsNpc(point, occupiedPoints)
  );
}

/** Deterministic candidate search shared by spawn and destination positions. */
function clearNpcPoint(
  anchor: Pick<NeighborhoodObject, "x" | "y">,
  index: number,
  occupied: readonly GroundRect[],
  occupiedPoints: readonly NpcPoint[],
  baseRadius: number,
): NpcPoint | null {
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const ring = Math.floor(attempt / 8) + 1;
    const angle = index * GOLDEN_ANGLE + (attempt % 8) * GOLDEN_ANGLE;
    const radius = baseRadius * Math.sqrt(ring);
    const candidate = {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    };
    if (isAvailable(candidate, occupied, occupiedPoints)) return candidate;
  }
  return null;
}

/**
 * Reuse authored NPC anchors first, then deterministically distribute overflow.
 * Candidates remain inside scene bounds and clear structures and other NPCs.
 */
export function neighborhoodNpcSpawnPoint(
  slots: readonly Pick<NeighborhoodObject, "x" | "y">[],
  index: number,
  occupied: readonly GroundRect[] = [],
  occupiedPoints: readonly NpcPoint[] = [],
): NpcPoint | null {
  if (!Number.isInteger(index) || index < 0 || slots.length === 0) return null;
  const anchor = slots[index % slots.length];
  if (!anchor) return null;
  const ring = Math.floor(index / slots.length);
  const angle = index * GOLDEN_ANGLE;
  const initialRadius = ring === 0 ? 0 : NPC_SLOT_SPACING * Math.sqrt(ring);
  const initial = {
    x: anchor.x + Math.cos(angle) * initialRadius,
    y: anchor.y + Math.sin(angle) * initialRadius,
  };
  if (isAvailable(initial, occupied, occupiedPoints)) return initial;
  return clearNpcPoint(anchor, index, occupied, occupiedPoints, NPC_SLOT_SPACING);
}

/**
 * Give each catalog character a stable destination offset while keeping it
 * inside scene bounds and clear of structures and other NPC destinations.
 */
export function neighborhoodNpcDestinationPoint(
  destination: Pick<NeighborhoodObject, "x" | "y">,
  catalogIndex: number,
  occupied: readonly GroundRect[] = [],
  occupiedPoints: readonly NpcPoint[] = [],
): NpcPoint | null {
  if (!Number.isInteger(catalogIndex) || catalogIndex < 0) return null;
  const angle = catalogIndex * GOLDEN_ANGLE;
  const radius = NEIGHBORHOOD_TILE_SIZE * 0.45 * Math.sqrt(catalogIndex + 1);
  const initial = {
    x: destination.x + Math.cos(angle) * radius,
    y: destination.y + Math.sin(angle) * radius,
  };
  if (isAvailable(initial, occupied, occupiedPoints)) return initial;
  return clearNpcPoint(destination, catalogIndex, occupied, occupiedPoints, NPC_SLOT_SPACING);
}

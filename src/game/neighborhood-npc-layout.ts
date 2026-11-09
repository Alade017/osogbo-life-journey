import { NEIGHBORHOOD_TILE_SIZE, type GroundRect } from "@/game/neighborhood-geometry";
import type { NeighborhoodObject } from "@/game/neighborhood-model";

const NPC_SLOT_SPACING = NEIGHBORHOOD_TILE_SIZE * 0.425;
const NPC_CLEARANCE = 22;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function overlapsFootprint(point: { x: number; y: number }, footprints: readonly GroundRect[]) {
  return footprints.some(
    (footprint) =>
      point.x >= footprint.left - NPC_CLEARANCE &&
      point.x <= footprint.left + footprint.width + NPC_CLEARANCE &&
      point.y >= footprint.top - NPC_CLEARANCE &&
      point.y <= footprint.top + footprint.height + NPC_CLEARANCE,
  );
}

/**
 * Reuse authored NPC anchors first, then deterministically distribute overflow
 * around those anchors. Candidate points avoid building and obstacle footprints.
 */
export function neighborhoodNpcSpawnPoint(
  slots: readonly Pick<NeighborhoodObject, "x" | "y">[],
  index: number,
  occupied: readonly GroundRect[] = [],
): { x: number; y: number } | null {
  if (!Number.isInteger(index) || index < 0 || slots.length === 0) return null;
  const anchor = slots[index % slots.length];
  if (!anchor) return null;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const ring = Math.floor(index / slots.length) + Math.floor(attempt / 8);
    const angle = index * GOLDEN_ANGLE + (attempt % 8) * GOLDEN_ANGLE;
    const radius = attempt === 0 && ring === 0
      ? 0
      : NPC_SLOT_SPACING * Math.sqrt(Math.max(1, ring) + Math.floor(attempt / 8));
    const candidate = {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    };
    if (!overlapsFootprint(candidate, occupied)) return candidate;
  }
  return null;
}

/**
 * Give each catalog character a stable destination offset. Unlike centring by
 * the number currently present, this does not move every NPC when schedules
 * change and residents enter or leave a neighborhood.
 */
export function neighborhoodNpcDestinationPoint(
  destination: Pick<NeighborhoodObject, "x" | "y">,
  catalogIndex: number,
): { x: number; y: number } {
  if (!Number.isInteger(catalogIndex) || catalogIndex < 0) return destination;
  const angle = catalogIndex * GOLDEN_ANGLE;
  const radius = NEIGHBORHOOD_TILE_SIZE * 0.45 * Math.sqrt(catalogIndex + 1);
  return {
    x: destination.x + Math.cos(angle) * radius,
    y: destination.y + Math.sin(angle) * radius,
  };
}

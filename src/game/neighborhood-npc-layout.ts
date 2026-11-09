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

/** Shared deterministic candidate search for spawn and destination positions. */
function clearNpcPoint(
  anchor: Pick<NeighborhoodObject, "x" | "y">,
  index: number,
  occupied: readonly GroundRect[],
  baseRadius: number,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < 32; attempt += 1) {
    const ring = Math.floor(attempt / 8) + 1;
    const angle = index * GOLDEN_ANGLE + (attempt % 8) * GOLDEN_ANGLE;
    const radius = baseRadius * Math.sqrt(ring);
    const candidate = {
      x: anchor.x + Math.cos(angle) * radius,
      y: anchor.y + Math.sin(angle) * radius,
    };
    if (!overlapsFootprint(candidate, occupied)) return candidate;
  }
  return null;
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
  const ring = Math.floor(index / slots.length);
  const angle = index * GOLDEN_ANGLE;
  const initialRadius = ring === 0 ? 0 : NPC_SLOT_SPACING * Math.sqrt(ring);
  const initial = {
    x: anchor.x + Math.cos(angle) * initialRadius,
    y: anchor.y + Math.sin(angle) * initialRadius,
  };
  if (!overlapsFootprint(initial, occupied)) return initial;
  return clearNpcPoint(anchor, index, occupied, NPC_SLOT_SPACING);
}

/**
 * Give each catalog character a stable destination offset while keeping them
 * outside building and obstacle footprints. Returns null if no safe point exists.
 */
export function neighborhoodNpcDestinationPoint(
  destination: Pick<NeighborhoodObject, "x" | "y">,
  catalogIndex: number,
  occupied: readonly GroundRect[] = [],
): { x: number; y: number } | null {
  if (!Number.isInteger(catalogIndex) || catalogIndex < 0) return null;
  const angle = catalogIndex * GOLDEN_ANGLE;
  const radius = NEIGHBORHOOD_TILE_SIZE * 0.45 * Math.sqrt(catalogIndex + 1);
  const initial = {
    x: destination.x + Math.cos(angle) * radius,
    y: destination.y + Math.sin(angle) * radius,
  };
  if (!overlapsFootprint(initial, occupied)) return initial;
  return clearNpcPoint(destination, catalogIndex, occupied, NPC_SLOT_SPACING);
}

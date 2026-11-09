import { NEIGHBORHOOD_TILE_SIZE } from "@/game/neighborhood-geometry";
import type { NeighborhoodObject } from "@/game/neighborhood-model";

const NPC_SLOT_SPACING = NEIGHBORHOOD_TILE_SIZE * 0.425;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Reuse authored NPC anchors first, then deterministically distribute overflow
 * around those anchors. This keeps scheduled characters visible without tying
 * population capacity to the number of decorative placeholder objects.
 */
export function neighborhoodNpcSpawnPoint(
  slots: readonly Pick<NeighborhoodObject, "x" | "y">[],
  index: number,
): { x: number; y: number } | null {
  if (!Number.isInteger(index) || index < 0 || slots.length === 0) return null;
  const anchor = slots[index % slots.length];
  if (!anchor) return null;
  const ring = Math.floor(index / slots.length);
  if (ring === 0) return { x: anchor.x, y: anchor.y };
  const angle = index * GOLDEN_ANGLE;
  const radius = NPC_SLOT_SPACING * Math.sqrt(ring);
  return {
    x: anchor.x + Math.cos(angle) * radius,
    y: anchor.y + Math.sin(angle) * radius,
  };
}

/**
 * Pure rules for hiding buildings that stand between the camera and the player.
 * Phones cut the blocking building away; laptops fade it so the walls stay readable.
 */
export type OcclusionStyle = "fade" | "cutaway";

export const OCCLUDED_OPACITY = 0.22;

export function occlusionStyleFor({ coarsePointer }: { coarsePointer: boolean }): OcclusionStyle {
  return coarsePointer ? "cutaway" : "fade";
}

/** Moves `current` toward `target` at a frame-rate independent speed. */
export function approachOpacity(current: number, target: number, delta: number, rate = 10): number {
  const step = 1 - Math.exp(-rate * Math.max(0, delta));
  return current + (target - current) * step;
}

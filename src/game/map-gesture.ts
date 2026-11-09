/** Shared pointer thresholds for distinguishing a map tap from a camera drag. */
export const MAP_TARGET_MAX_POINTER_DELTA = 5;
export const MAP_DRAG_THRESHOLD_PX = 10;

export function isMapTargetSelectionAllowed(
  pointerDelta: number | undefined,
  gestureMoved: boolean,
): boolean {
  return (pointerDelta ?? 0) <= MAP_TARGET_MAX_POINTER_DELTA && !gestureMoved;
}

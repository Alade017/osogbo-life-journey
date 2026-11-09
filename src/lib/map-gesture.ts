export type MapPointerSample = { x: number; y: number; at: number };

export const MAP_TAP_MAX_DISTANCE = 6;
export const MAP_TAP_MAX_DURATION_MS = 500;

export function isQuickMapTap(start: MapPointerSample, end: MapPointerSample) {
  return (
    Math.hypot(end.x - start.x, end.y - start.y) < MAP_TAP_MAX_DISTANCE &&
    end.at - start.at <= MAP_TAP_MAX_DURATION_MS
  );
}

/** Return a safe multiplicative zoom factor for a two-pointer pinch gesture. */
export function mapPinchZoomFactor(previousDistance: number, currentDistance: number) {
  if (
    !Number.isFinite(previousDistance) ||
    !Number.isFinite(currentDistance) ||
    previousDistance <= 0 ||
    currentDistance <= 0
  )
    return null;
  return currentDistance / previousDistance;
}

/**
 * Builds the minimap's plain telemetry from scene-space points. Everything is normalised to
 * 0..1 inside the neighbourhood, so the overlay never reads or changes game state.
 */
export type ScenePoint = { x: number; y: number };
export type MinimapBounds = { left: number; top: number; width: number; height: number };
export type MinimapTelemetry = {
  self: ScenePoint | null;
  others: ScenePoint[];
  target: ScenePoint | null;
};

function fraction(point: ScenePoint, bounds: MinimapBounds): ScenePoint {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return {
    x: clamp((point.x - bounds.left) / bounds.width),
    y: clamp((point.y - bounds.top) / bounds.height),
  };
}

export function buildMinimapTelemetry({
  bounds,
  self,
  others,
  target,
}: {
  bounds: MinimapBounds;
  self: ScenePoint | null;
  others: readonly ScenePoint[];
  target: ScenePoint | null;
}): MinimapTelemetry {
  return {
    self: self ? fraction(self, bounds) : null,
    others: others.map((point) => fraction(point, bounds)),
    target: target ? fraction(target, bounds) : null,
  };
}

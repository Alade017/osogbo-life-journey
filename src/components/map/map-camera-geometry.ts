export const MAP_VIEW_ELEVATION = 2.5;
export const MAP_VIEW_GROUND_PROJECTION = MAP_VIEW_ELEVATION / Math.hypot(MAP_VIEW_ELEVATION, 1);

export function mapCameraFrame(
  width: number,
  depth: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const aspect = Math.max(0.3, viewportWidth / Math.max(1, viewportHeight));
  const projectedDepth = depth * MAP_VIEW_GROUND_PROJECTION;
  const height = Math.max(projectedDepth + 12, width / Math.max(aspect, 1.3)) * 1.08;
  const horizontal = height * aspect;
  // At minimum zoom, the viewport remains over city land on either device orientation.
  const minZoom = Math.max(horizontal / width, height / projectedDepth);
  return {
    left: -horizontal / 2,
    right: horizontal / 2,
    top: height / 2,
    bottom: -height / 2,
    minZoom,
    maxZoom: minZoom * 4,
  };
}

export function mapCameraPanLimits(
  width: number,
  depth: number,
  camera: { left: number; right: number; top: number; bottom: number; zoom: number },
) {
  const halfWidth = (camera.right - camera.left) / (2 * camera.zoom);
  const halfDepth = (camera.top - camera.bottom) / (2 * camera.zoom * MAP_VIEW_GROUND_PROJECTION);
  return { x: Math.max(0, width / 2 - halfWidth), z: Math.max(0, depth / 2 - halfDepth) };
}

/** Pure camera constraints for the presentation-only overview. */
export function overviewFit(width: number, height: number, mapWidth: number, mapDepth: number) {
  return Math.max(0.01, Math.min(width, height) / (Math.hypot(mapWidth, mapDepth) * 1.12));
}
export function overviewClampZoom(zoom: number, fit: number) {
  return Math.max(fit, Math.min(fit * 5, zoom));
}
export function overviewPanCorrection(
  x: number,
  y: number,
  z: number,
  width: number,
  depth: number,
): [number, number, number] {
  return [
    Math.max(-width / 2, Math.min(width / 2, x)) - x,
    -y,
    Math.max(-depth / 2, Math.min(depth / 2, z)) - z,
  ];
}

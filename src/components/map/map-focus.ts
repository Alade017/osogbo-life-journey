import { MAP_VIEW_GROUND_PROJECTION } from "./map-camera-geometry";
export type MapFocusInsets = { right: number; bottom: number };
export const EMPTY_FOCUS_INSETS: MapFocusInsets = { right: 0, bottom: 0 };

/** Offset a north-up oblique ground target into the unobscured viewport. */
export function mapFocusTarget(
  target: readonly [number, number, number],
  insets: MapFocusInsets,
  viewport: { width: number; height: number },
  frustum: { left: number; right: number; top: number; bottom: number; zoom: number },
): [number, number, number] {
  const right = Math.max(0, Math.min(insets.right, viewport.width * 0.85));
  const bottom = Math.max(0, Math.min(insets.bottom, viewport.height * 0.85));
  return [
    target[0] +
      (right * (frustum.right - frustum.left)) / (2 * Math.max(1, viewport.width) * frustum.zoom),
    0,
    target[2] +
      (bottom * (frustum.top - frustum.bottom)) /
        (2 * Math.max(1, viewport.height) * frustum.zoom * MAP_VIEW_GROUND_PROJECTION),
  ];
}

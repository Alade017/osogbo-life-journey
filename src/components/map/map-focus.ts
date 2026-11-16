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
  const groundUpProjection = 1.35 / Math.hypot(1.35, 1);
  return [
    target[0] +
      (right * (frustum.right - frustum.left)) / (2 * Math.max(1, viewport.width) * frustum.zoom),
    0,
    target[2] +
      (bottom * (frustum.top - frustum.bottom)) /
        (2 * Math.max(1, viewport.height) * frustum.zoom * groundUpProjection),
  ];
}

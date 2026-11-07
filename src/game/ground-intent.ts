/** Walking to a tapped ground point, shared by the neighbourhood and its tests. */
/** Within this many world units of a tapped point, the character has arrived. */
export const GROUND_ARRIVE_DISTANCE = 12;
/** Along each axis, movement stops closing in below this distance so the character does not jitter. */
export const GROUND_AXIS_DEADZONE = 6;

/** Intent toward a tapped ground point, or null once the character has arrived there. */
export function groundIntent(
  target: { x: number; y: number } | null,
  position: { x: number; y: number } | null,
) {
  if (!target || !position) return null;
  const dx = target.x - position.x;
  const dy = target.y - position.y;
  if (Math.hypot(dx, dy) <= GROUND_ARRIVE_DISTANCE) return null;
  return {
    x: Math.abs(dx) > GROUND_AXIS_DEADZONE ? Math.sign(dx) : 0,
    y: Math.abs(dy) > GROUND_AXIS_DEADZONE ? Math.sign(dy) : 0,
  };
}

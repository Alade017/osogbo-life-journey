import type { MovementDirection } from "@/lib/player-movement";

/** Radius in px the joystick knob can travel from the centre of the base. */
export const JOYSTICK_RADIUS_PX = 34;
/** Fraction of the radius the knob must pass before a direction counts, so a resting thumb presses nothing. */
const DEAD_ZONE = 0.25;

/**
 * Maps a joystick offset from its centre (px, screen y pointing down) to the directions it presses.
 * Pushing diagonally presses two directions, as the keyboard does with two keys.
 */
export function directionsFor(
  dx: number,
  dy: number,
  radius = JOYSTICK_RADIUS_PX,
): Set<MovementDirection> {
  const pressed = new Set<MovementDirection>();
  const limit = DEAD_ZONE * radius;
  if (dx > limit) pressed.add("east");
  if (dx < -limit) pressed.add("west");
  if (dy > limit) pressed.add("south");
  if (dy < -limit) pressed.add("north");
  return pressed;
}

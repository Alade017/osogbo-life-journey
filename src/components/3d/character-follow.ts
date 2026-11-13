export type Vec3 = [number, number, number];

/**
 * Moves `current` toward `goal` for one frame. The character keeps walking at least at `speed`
 * (measured from the server's own updates), and closes any larger gap smoothly, so it never
 * stalls between updates and never overshoots.
 */
export function followStep(
  current: Vec3,
  goal: Vec3,
  delta: number,
  speed: number,
  catchUpRate: number,
): Vec3 {
  const dx = goal[0] - current[0];
  const dy = goal[1] - current[1];
  const dz = goal[2] - current[2];
  const distance = Math.hypot(dx, dy, dz);
  if (distance === 0) return [goal[0], goal[1], goal[2]];
  const eased = (1 - Math.exp(-Math.max(0, delta) * catchUpRate)) * distance;
  const step = Math.min(distance, Math.max(speed * Math.max(0, delta), eased));
  const scale = step / distance;
  return [current[0] + dx * scale, current[1] + dy * scale, current[2] + dz * scale];
}

/**
 * Speed of the last server update, in scene units per second. Measured from the distance moved
 * and the time since the previous update, so it matches whatever units the scene uses.
 */
export function measuredSpeed(
  previous: Vec3,
  next: Vec3,
  elapsedSeconds: number,
  maxSpeed = 6,
): number {
  const distance = Math.hypot(next[0] - previous[0], next[1] - previous[1], next[2] - previous[2]);
  if (distance === 0) return 0;
  return Math.min(maxSpeed, distance / Math.max(elapsedSeconds, 0.02));
}

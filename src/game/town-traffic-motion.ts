/** Presentation-only traffic dynamics in world units and seconds. */
export const TRAFFIC_MOTION = {
  maxFrameSeconds: 0.1,
  acceleration: 1.8,
  braking: 3.2,
  turnRate: Math.PI * 2,
} as const;

export function trafficFrameSeconds(delta: number): number {
  return Number.isFinite(delta) ? Math.max(0, Math.min(delta, TRAFFIC_MOTION.maxFrameSeconds)) : 0;
}

export function trafficSpeed(current: number, target: number, dt: number): number {
  const change = (target >= current ? TRAFFIC_MOTION.acceleration : TRAFFIC_MOTION.braking) * dt;
  return Math.max(0, current + Math.max(-change, Math.min(change, target - current)));
}

export function trafficBrakingSpeed(distance: number): number {
  return Math.sqrt(2 * TRAFFIC_MOTION.braking * Math.max(0, distance));
}

export function trafficHeading(current: number, target: number, dt: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  const limit = TRAFFIC_MOTION.turnRate * dt;
  return current + Math.max(-limit, Math.min(limit, difference));
}

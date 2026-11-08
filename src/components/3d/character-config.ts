/**
 * Presentation tuning for the procedural character. Lengths are fractions of the character's
 * body height unless a name says otherwise. Simulation positions never read these values.
 */
export const CHARACTER_SOCKETS = {
  /** Neck pivot, where the head turns. */
  neck: 0.68,
  /** Anchor for headwear and hair accessories. */
  head: 1.0,
  /** Anchor for back-worn items such as bags. Body-space origin, so existing offsets stay valid. */
  back: 0,
} as const;

export const CHARACTER_MOTION = {
  /** Per-second rate for blending between poses so changes fade instead of snapping. */
  fadeRate: 10,
  /** Arm and leg swing amplitude in radians while walking. */
  armSwing: 0.5,
  legSwing: 0.4,
  /** Body rise on each footfall, as a fraction of height. */
  bob: 0.025,
  /** Vertical squash on each footfall (negative scale delta), as a fraction. */
  squash: 0.04,
  /** How quickly the head turns toward the nearest character. */
  headTurnRate: 6,
  /** Largest head turn either side of facing, in radians. */
  headTurnLimit: 0.7,
  /** Other characters within this many body heights are looked at. */
  lookRange: 2.5,
  /** Seconds to keep frames running after a change so the blend settles. */
  settleSeconds: 0.6,
} as const;

export const CHARACTER_GROUND = {
  /** Soft contact shadow radius, as a fraction of height. */
  shadowRadius: 0.32,
  shadowOpacity: 0.22,
  shadowColor: "#2b2118",
} as const;

export const CHARACTER_OUTLINE = {
  /** Torso outline thickness, as a fraction of height. */
  thickness: 0.012,
  color: "#2b2118",
} as const;

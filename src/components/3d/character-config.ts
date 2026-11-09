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
  /** Per-second rate for gliding to a new position, so moves are walked, never teleported. */
  glideRate: 6,
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

export const CHARACTER_CLOTH = {
  /** Outfit palette indices that are drawn with the Adire resist pattern instead of plain colour. */
  patternedOutfits: [3] as readonly number[],
  textureSize: 128,
  adire: {
    base: "#2f3f63",
    motif: "#e9e2d0",
    /** Motif cells across the texture; each cell holds one resist dot and two diagonal strokes. */
    cells: 8,
  },
} as const;

/** Arm measurements, as fractions of body height. The hand socket sits at the end of the arm. */
export const CHARACTER_ARM = {
  /** Shoulder offset from the body centre, sideways (x) and height (y). */
  shoulderX: 0.19,
  shoulderY: 0.64,
  /** Length from shoulder to hand. */
  length: 0.4,
} as const;

export const CHARACTER_HAND = {
  /** Which arm carries the right-hand socket: +1 is the positive-x arm. */
  socketSide: 1,
  /** Forward reach for the interact pose, in radians. */
  reachAngle: -1.1,
  reachSway: 0.08,
} as const;

/**
 * Where the right hand is, in body space (feet on the floor, facing south), when the
 * interact pose reaches forward. Props held in that hand are placed here.
 */
export function rightHandPoint(height: number): [number, number, number] {
  const reach = CHARACTER_HAND.reachAngle;
  const length = height * CHARACTER_ARM.length;
  return [
    CHARACTER_HAND.socketSide * height * CHARACTER_ARM.shoulderX,
    height * CHARACTER_ARM.shoulderY - length * Math.cos(reach),
    -length * Math.sin(reach),
  ];
}

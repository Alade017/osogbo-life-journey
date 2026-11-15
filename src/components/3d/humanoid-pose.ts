/**
 * Bone names and procedural poses for the low-poly body. The names follow the biped convention the
 * wardrobe already looks up, so garments attach without changes. Forward is -z; a positive x angle
 * on a limb that hangs down swings it forward, and a negative x on a shin bends the knee.
 */
export const BONE = {
  root: "Bip01",
  spine: "Bip01 Spine",
  spine1: "Bip01 Spine1",
  spine2: "Bip01 Spine2",
  neck: "Bip01 Neck",
  head: "Bip01 Head",
  lUpperArm: "Bip01 L UpperArm",
  lForearm: "Bip01 L Forearm",
  lHand: "Bip01 L Hand",
  rUpperArm: "Bip01 R UpperArm",
  rForearm: "Bip01 R Forearm",
  rHand: "Bip01 R Hand",
  lThigh: "Bip01 L Thigh",
  lCalf: "Bip01 L Calf",
  lFoot: "Bip01 L Foot",
  rThigh: "Bip01 R Thigh",
  rCalf: "Bip01 R Calf",
  rFoot: "Bip01 R Foot",
} as const;

export type BoneName = (typeof BONE)[keyof typeof BONE];
/** Height of the hips above the feet, in body-height units. */
export const ROOT_REST_Y = 0.5;

export type Euler3 = [number, number, number];
export type PoseMotion =
  "Idle" | "Walk" | "Work" | "Talk" | "Interact" | "Sit" | "Wash" | "Cook" | "Collect" | "Stretch";
export type Pose = { bones: Partial<Record<BoneName, Euler3>>; rootY?: number };

const sin = Math.sin;
const cos = Math.cos;

/** The pose a motion wants at `t` seconds. Pure, so it can be tested without a renderer. */
/** Per-body motion style. Hip sway is stronger on the female body, so her walk reads as hers. */
export const POSE_STYLE: Record<"female" | "male" | "business", { hipSway: number }> = {
  female: { hipSway: 1.8 },
  male: { hipSway: 1 },
  business: { hipSway: 1 },
};

export function poseFor(
  motion: PoseMotion,
  t: number,
  options: { hipSway: number } = { hipSway: 1 },
): Pose {
  switch (motion) {
    case "Walk": {
      const p = t * 6.2;
      const s = sin(p);
      // Each leg swings half a cycle apart. Calves bend smoothly during the forward swing
      // (no hard kinks), and the hips roll with a counter-rotating spine.
      const left = p;
      const right = p + Math.PI;
      const lift = (phase: number) => (1 + cos(phase + 0.6)) / 2;
      const hipSway = options.hipSway;
      return {
        rootY: Math.abs(cos(p)) * 0.025,
        bones: {
          // Pelvis rotates against the rib cage to keep the gait balanced.
          [BONE.root]: [0, 0, sin(p) * 0.035 * hipSway],
          [BONE.spine]: [0, -sin(p) * 0.045 * hipSway, 0],
          [BONE.spine2]: [0, sin(p) * 0.018, 0],
          [BONE.lThigh]: [sin(left) * 0.48, 0, 0],
          [BONE.rThigh]: [sin(right) * 0.48, 0, 0],
          // Knee flexion increases during swing and relaxes as the foot plants.
          [BONE.lCalf]: [-0.72 * lift(left) * lift(left), 0, 0],
          [BONE.rCalf]: [-0.72 * lift(right) * lift(right), 0, 0],
          // Ankles counter-rotate against shin flexion to keep the feet from pointing straight down.
          [BONE.lFoot]: [0.22 * lift(left) + 0.12 * sin(left), 0, 0],
          [BONE.rFoot]: [0.22 * lift(right) + 0.12 * sin(right), 0, 0],
          // Arms counter-swing with a relaxed elbow bend rather than rigid straight arms.
          [BONE.lUpperArm]: [-s * 0.36, 0, 0.07],
          [BONE.rUpperArm]: [s * 0.36, 0, -0.07],
          [BONE.lForearm]: [0.18 + 0.16 * Math.max(0, -s), 0, 0],
          [BONE.rForearm]: [0.18 + 0.16 * Math.max(0, s), 0, 0],
        },
      };
    }
    case "Work":
      return {
        bones: {
          [BONE.spine]: [-0.25, 0, 0],
          [BONE.head]: [-0.35, 0, 0],
          [BONE.lUpperArm]: [0.6, 0, 0.1],
          [BONE.rUpperArm]: [0.6, 0, -0.1],
          [BONE.lForearm]: [0.9, 0, 0],
          [BONE.rForearm]: [0.9, 0, 0],
        },
      };
    case "Talk":
      return {
        bones: {
          [BONE.head]: [-0.1, sin(t * 1.2) * 0.22, 0],
          [BONE.lUpperArm]: [0.1, 0, 0.08],
          [BONE.lForearm]: [0.2, 0, 0],
          [BONE.rUpperArm]: [0.5 + sin(t * 4) * 0.12, 0, -0.25],
          [BONE.rForearm]: [0.9, 0, 0],
        },
      };
    case "Interact":
      return {
        bones: {
          [BONE.spine]: [-0.12, 0, 0],
          [BONE.head]: [-0.1, 0, 0],
          [BONE.lUpperArm]: [0.1, 0, 0.08],
          [BONE.rUpperArm]: [1.2, 0, -0.15],
          [BONE.rForearm]: [0.2, 0, 0],
        },
      };
    case "Sit":
      return {
        bones: {
          [BONE.spine]: [-0.05, 0, 0],
          [BONE.lThigh]: [1.45, 0, 0],
          [BONE.rThigh]: [1.45, 0, 0],
          [BONE.lCalf]: [-1.45, 0, 0],
          [BONE.rCalf]: [-1.45, 0, 0],
          [BONE.lFoot]: [0.28, 0, 0],
          [BONE.rFoot]: [0.28, 0, 0],
          [BONE.lUpperArm]: [0.35, 0, 0.1],
          [BONE.rUpperArm]: [0.35, 0, -0.1],
          [BONE.lForearm]: [0.9, 0, 0],
          [BONE.rForearm]: [0.9, 0, 0],
        },
      };
    case "Wash":
      return {
        bones: {
          [BONE.spine]: [-0.3, 0, 0],
          [BONE.head]: [-0.25, 0, 0],
          [BONE.lUpperArm]: [0.7, 0, 0.15],
          [BONE.lForearm]: [0.6, 0, 0],
          [BONE.rUpperArm]: [1.0, 0, -0.2],
          [BONE.rForearm]: [1.1 + sin(t * 7) * 0.25, 0, 0],
        },
      };
    case "Cook":
      return {
        bones: {
          [BONE.spine]: [-0.15, 0, 0],
          [BONE.head]: [-0.2, 0, 0],
          [BONE.lUpperArm]: [0.9, 0, 0.08],
          [BONE.rUpperArm]: [0.9, 0, -0.08],
          [BONE.lForearm]: [1.0 + sin(t * 3) * 0.15, 0, 0],
          [BONE.rForearm]: [1.0 + sin(t * 3 + 1) * 0.15, 0, 0],
        },
      };
    case "Collect":
      return {
        bones: {
          [BONE.spine]: [-0.85 + sin(t * 1.5) * 0.12, 0, 0],
          [BONE.head]: [0.2, 0, 0],
          [BONE.lUpperArm]: [0.1, 0, 0.08],
          [BONE.rUpperArm]: [0.1, 0, -0.08],
          [BONE.lForearm]: [0.3, 0, 0],
          [BONE.rForearm]: [0.3, 0, 0],
        },
      };
    case "Stretch":
      return {
        bones: {
          [BONE.spine]: [0.12, 0, 0],
          [BONE.head]: [0.2, 0, 0],
          [BONE.lUpperArm]: [-2.9, 0, 0.25],
          [BONE.rUpperArm]: [-2.9, 0, -0.25],
        },
      };
    case "Idle":
    default:
      return {
        rootY: 0,
        bones: {
          [BONE.spine2]: [sin(t * 1.6) * 0.02, 0, 0],
          [BONE.lUpperArm]: [0, 0, 0.08],
          [BONE.rUpperArm]: [0, 0, -0.08],
          [BONE.lForearm]: [0.12, 0, 0],
          [BONE.rForearm]: [0.12, 0, 0],
          [BONE.head]: [0, sin(t * 0.5) * 0.12, 0],
        },
      };
  }
}

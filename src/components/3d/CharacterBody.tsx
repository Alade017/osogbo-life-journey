import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, type ReactNode } from "react";
import { Euler, Quaternion, type Material } from "three";
import {
  HAIR_COLORS,
  HAIR_STYLES_BY_GENDER,
  normalizeAvatarAppearance,
  SKIN_TONES,
  type Appearance,
} from "@/game/avatar-appearance";
import { CharacterWardrobe } from "./CharacterWardrobe";
import { ProceduralHeadwear } from "./ProceduralHeadwear";
import { CHARACTER_MOTION } from "./character-config";
import {
  BONE,
  POSE_STYLE,
  poseFor,
  ROOT_REST_Y,
  type BoneName,
  type PoseMotion,
} from "./humanoid-pose";
import { hairShapeFor } from "./hair-shapes";
import { createHumanoid, type BodyVariant } from "./humanoid-rig";

export type { BodyVariant } from "./humanoid-rig";
export type MotionName = PoseMotion;

const TASK_MOTIONS: Record<string, PoseMotion> = {
  sit: "Sit",
  wash: "Wash",
  cook: "Cook",
  collect: "Collect",
  stretch: "Stretch",
};

/** The body that best matches a saved gender. Non-binary characters use the female body. */
export function bodyVariantFor(gender: string): BodyVariant {
  return gender === "male" ? "male" : "female";
}

/**
 * Picks the pose for a character's state. A task pose wins, then walking, then the standing
 * states. Walking wins over any standing pose while the character moves.
 */
export function motionFor(animation: string, walking: boolean, taskPose?: string): PoseMotion {
  const task = taskPose ? TASK_MOTIONS[taskPose] : undefined;
  if (task) return task;
  if (walking) return "Walk";
  if (animation === "work") return "Work";
  if (animation === "interact") return "Interact";
  if (animation === "talk") return "Talk";
  return "Idle";
}

const scratchEuler = new Euler();
const scratchQuat = new Quaternion();
const identity = new Quaternion();

/**
 * A low-poly body built in code: one skinned mesh on a 18-bone biped. Each character owns its
 * skeleton, so poses never leak between characters. Held items attach to the right hand.
 */
export function CharacterBody({
  variant,
  height,
  motion,
  held = null,
  appearance = {},
  gender = "nonbinary",
}: {
  variant: BodyVariant;
  height: number;
  motion: PoseMotion;
  held?: ReactNode;
  appearance?: Appearance;
  gender?: string;
}) {
  const { invalidate } = useThree();
  const safe = normalizeAvatarAppearance(appearance, gender);
  const skinColor = SKIN_TONES[safe.skin] ?? SKIN_TONES[0]!;
  const hairStyle = (HAIR_STYLES_BY_GENDER[gender] ?? HAIR_STYLES_BY_GENDER["female"] ?? [])[
    safe.hair
  ];
  const hairShape = hairStyle ? hairShapeFor(hairStyle) : null;
  const hairColor = hairShape ? (HAIR_COLORS[safe.hairColor] ?? HAIR_COLORS[0]!) : null;

  const rig = useMemo(
    () => createHumanoid({
      variant,
      skinColor,
      hairColor,
      hairShape: hairShape ?? "cap",
      build: safe.build,
    }),
    [variant, skinColor, hairColor, hairShape, safe.build],
  );
  const hand = rig.byName.get(BONE.rHand) ?? null;
  const head = rig.byName.get(BONE.head) ?? null;

  useEffect(() => {
    return () => {
      for (const mesh of rig.meshes) {
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          (material as Material).dispose();
        }
      }
    };
  }, [rig]);

  useFrame((state, delta) => {
    const pose = poseFor(motion, state.clock.elapsedTime, POSE_STYLE[variant]);
    const blend = 1 - Math.exp(-CHARACTER_MOTION.fadeRate * delta);
    let moving = false;
    for (const bone of rig.bones) {
      const angles = pose.bones[bone.name as BoneName];
      if (angles) scratchQuat.setFromEuler(scratchEuler.set(angles[0], angles[1], angles[2]));
      else scratchQuat.copy(identity);
      if (bone.quaternion.angleTo(scratchQuat) > 0.0005) {
        moving = true;
        bone.quaternion.slerp(scratchQuat, blend);
      }
    }
    const restY = ROOT_REST_Y + (pose.rootY ?? 0);
    if (Math.abs(rig.root.position.y - restY) > 0.0005) {
      moving = true;
      rig.root.position.y += (restY - rig.root.position.y) * blend;
    }
    if (moving) invalidate();
  });

  return (
    <group scale={height}>
      <primitive object={rig.root} />
      {rig.meshes.map((mesh, index) => (
        <primitive key={index} object={mesh} />
      ))}
      <CharacterWardrobe rig={rig.root} appearance={safe} gender={gender} />
      {head && safe.headwear > 0
        ? createPortal(
            <ProceduralHeadwear
              style={safe.headwear as 1 | 2 | 3}
              color={HAIR_COLORS[safe.hairColor] ?? HAIR_COLORS[0]!}
            />,
            head,
          )
        : null}
      {held && hand ? createPortal(<group scale={1 / height}>{held}</group>, hand) : null}
    </group>
  );
}

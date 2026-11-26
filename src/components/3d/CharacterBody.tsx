import { createVisibleSkin } from "./humanoid-clothing";
import type { WornOutfit } from "@/game/wearable-outfits";
import { createPortal, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { Euler, Quaternion, Vector3, type Material } from "three";
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
  if (walking || animation === "walk") return "Walk";
  if (animation === "work") return "Work";
  if (animation === "interact") return "Interact";
  if (animation === "talk") return "Talk";
  if (animation === "dance") return "Dance";
  return "Idle";
}

const scratchEuler = new Euler();
const scratchQuat = new Quaternion();
const identity = new Quaternion();
const LOOPING_MOTIONS = new Set<PoseMotion>([
  "Walk",
  "Talk",
  "Wash",
  "Cook",
  "Collect",
  "Work",
  "Interact",
  "Dance",
]);

/**
 * A low-poly body built in code: one skinned mesh on a 18-bone biped. Each character owns its
 * skeleton, so poses never leak between characters. Held items attach to the right hand.
 */
export function CharacterBody({
  variant,
  height,
  motion,
  animated = true,
  poseUpdateInterval = 0,
  walkCadence,
  held = null,
  backAccessory = null,
  appearance = {},
  gender = "nonbinary",
  outfit,
}: {
  variant: BodyVariant;
  height: number;
  motion: PoseMotion;
  animated?: boolean;
  /** Minimum seconds between pose evaluations; zero preserves full-rate animation. */
  poseUpdateInterval?: number;
  walkCadence?: { readonly current: number };
  held?: ReactNode;
  backAccessory?: ReactNode;
  appearance?: Appearance;
  gender?: string;
  outfit?: WornOutfit;
}) {
  const { invalidate } = useThree();
  const safe = normalizeAvatarAppearance(appearance, gender);
  const skinColor = SKIN_TONES[safe.skin] ?? SKIN_TONES[0]!;
  const hairStyle = (HAIR_STYLES_BY_GENDER[gender] ?? HAIR_STYLES_BY_GENDER["female"] ?? [])[
    safe.hair
  ];
  const hairShape = hairStyle ? hairShapeFor(hairStyle) : null;
  // Keep the saved hairstyle intact, but hide its geometry under fitted headwear.
  // Restoring headwear to None restores the original hairstyle automatically.
  const visibleHairShape = safe.headwear > 0 ? null : hairShape;
  const hairColor = visibleHairShape ? (HAIR_COLORS[safe.hairColor] ?? HAIR_COLORS[0]!) : null;

  const rig = useMemo(
    () =>
      createHumanoid({
        variant,
        skinColor,
        hairColor,
        hairShape: visibleHairShape ?? "cap",
        build: safe.build,
      }),
    [variant, skinColor, hairColor, visibleHairShape, safe.build],
  );
  const clothed = safe.clothed;
  const cut = outfit?.topCut ?? "tee";
  const visibleBody = useMemo(
    () => (clothed ? createVisibleSkin(rig.meshes[0]!, cut) : rig.meshes[0]!),
    [rig, clothed, cut],
  );
  const hand = rig.byName.get(BONE.rHand) ?? null;
  const head = rig.byName.get(BONE.head) ?? null;
  const upperSpine = rig.byName.get(BONE.spine2) ?? null;

  const backOffset = useMemo(() => {
    const index = upperSpine ? rig.bones.indexOf(upperSpine) : -1;
    const inverse = rig.meshes[0]?.skeleton.boneInverses[index];
    return inverse
      ? new Vector3().setFromMatrixPosition(inverse.clone().invert()).negate()
      : new Vector3();
  }, [rig, upperSpine]);
  const phase = useRef({ motion, elapsed: 0 });
  const settledPose = useRef(false);
  const pendingPoseTime = useRef(0);

  useEffect(() => {
    settledPose.current = false;
    pendingPoseTime.current = 0;
    invalidate();
  }, [rig, motion, animated, poseUpdateInterval, invalidate]);

  useEffect(() => {
    return () => {
      for (const mesh of rig.meshes) {
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          (material as Material).dispose();
        }
      }
      rig.meshes[0]?.skeleton.dispose();
    };
  }, [rig]);

  useFrame((_state, frameDelta) => {
    const looping = animated && LOOPING_MOTIONS.has(motion);
    if (settledPose.current && !looping) return;
    pendingPoseTime.current += Math.max(0, frameDelta);
    if (pendingPoseTime.current < poseUpdateInterval) {
      invalidate();
      return;
    }
    const delta = pendingPoseTime.current;
    pendingPoseTime.current = 0;

    if (phase.current.motion !== motion) phase.current = { motion, elapsed: 0 };
    else if (animated && motion !== "Idle") {
      const rate = motion === "Walk" ? (walkCadence?.current ?? 1) : 1;
      phase.current.elapsed += Math.max(0, delta) * rate;
    }
    const pose = poseFor(motion, animated ? phase.current.elapsed : 0, POSE_STYLE[variant]);
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
    settledPose.current = !moving && !looping;
    if (moving || looping) invalidate();
  });

  return (
    <group scale={height}>
      <primitive object={rig.root} />
      {rig.meshes.map((mesh, index) => (
        <primitive key={index} object={index === 0 ? visibleBody : mesh} dispose={null} />
      ))}
      <CharacterWardrobe body={rig.meshes[0]!} appearance={safe} outfit={outfit} />
      {head && safe.headwear > 0
        ? createPortal(
            <group scale={[0.7, 1, 0.82]}>
              <ProceduralHeadwear
                style={safe.headwear as 1 | 2 | 3}
                color={HAIR_COLORS[safe.hairColor] ?? HAIR_COLORS[0]!}
              />
            </group>,
            head,
          )
        : null}
      {backAccessory && upperSpine
        ? createPortal(
            // Existing accessory meshes use absolute body-height coordinates.
            // Convert them into spine-local coordinates without changing the models.
            <group position={backOffset}>{backAccessory}</group>,
            upperSpine,
          )
        : null}
      {held && hand ? createPortal(<group scale={1 / height}>{held}</group>, hand) : null}
    </group>
  );
}

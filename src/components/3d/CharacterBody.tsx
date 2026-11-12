import { createPortal, useThree } from "@react-three/fiber";
import type { Appearance } from "@/game/avatar-appearance";
import { CharacterWardrobe } from "./CharacterWardrobe";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { AnimationClip, Box3, type Group, Object3D, Vector3 } from "three";
import { clone as cloneRig } from "three/addons/utils/SkeletonUtils.js";

/** The rigged adult bodies shipped in public/models/characters. */
export type BodyVariant = "female" | "male" | "business";

export const BODY_FILES: Record<BodyVariant, string> = {
  female: "/models/characters/female-adult.glb",
  male: "/models/characters/male-adult.glb",
  business: "/models/characters/business-male.glb",
};

/** Talking gestures are separate clips on the same skeleton. Business staff share the male set. */
const TALK_FILES: Record<BodyVariant, string> = {
  female: "/models/characters/motion/female-gesture-thoughtful.glb",
  male: "/models/characters/motion/male-gesture-thoughtful.glb",
  business: "/models/characters/motion/male-gesture-thoughtful.glb",
};

/** Clip names the body understands. Idle, Walk and Work come from the adult models. */
export type MotionName = "Idle" | "Walk" | "Work" | "Talk";

/** The body that best matches a saved gender. Non-binary characters use the female body. */
export function bodyVariantFor(gender: string): BodyVariant {
  return gender === "male" ? "male" : "female";
}

/** Picks the clip for a character's state. Walking wins over any pose while the character moves. */
export function motionFor(animation: string, walking: boolean): MotionName {
  if (walking) return "Walk";
  if (animation === "work" || animation === "interact") return "Work";
  if (animation === "talk") return "Talk";
  return "Idle";
}

/** Keeps only tracks whose bone exists on the target rig, and names the talk clip. */
export function retargetClips(
  base: readonly AnimationClip[],
  talk: readonly AnimationClip[],
  bones: ReadonlySet<string>,
): AnimationClip[] {
  const keep = (clip: AnimationClip) => {
    const copy = clip.clone();
    copy.tracks = copy.tracks.filter((track) => {
      const node = track.name.slice(0, track.name.lastIndexOf("."));
      return bones.has(node);
    });
    return copy;
  };
  const clips = base.map(keep);
  for (const clip of talk) {
    const copy = keep(clip);
    copy.name = "Talk";
    clips.push(copy);
  }
  return clips;
}

const FADE_SECONDS = 0.25;

/**
 * A rigged, textured adult body that plays its own animation clips. Each character gets its own
 * copy of the rig, so poses never leak between characters. Held items attach to the right hand.
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
  motion: MotionName;
  held?: ReactNode;
  appearance?: Appearance;
  gender?: string;
}) {
  const gltf = useGLTF(BODY_FILES[variant]);
  const talk = useGLTF(TALK_FILES[variant]);
  const { invalidate } = useThree();
  const rig = useMemo(() => cloneRig(gltf.scene), [gltf]);
  const bones = useMemo(() => {
    const names = new Set<string>();
    rig.traverse((node) => names.add(node.name));
    return names;
  }, [rig]);
  const clips = useMemo(
    () => retargetClips(gltf.animations, talk.animations, bones),
    [gltf, talk, bones],
  );
  const root = useRef<Group>(null);
  const { actions } = useAnimations(clips, root);
  const hand = useMemo<Object3D | null>(() => rig.getObjectByName("Bip01 R Hand") ?? null, [rig]);

  // Fit the rig so its feet stand on the origin at the requested height.
  const fit = useMemo(() => {
    const box = new Box3().setFromObject(rig);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const scale = height / size.y;
    return { scale, x: -centre.x * scale, y: -box.min.y * scale, z: -centre.z * scale };
  }, [rig, height]);

  useEffect(() => {
    const action = actions[motion] ?? actions["Idle"];
    if (!action) return;
    action.reset().fadeIn(FADE_SECONDS).play();
    invalidate();
    return () => {
      action.fadeOut(FADE_SECONDS);
    };
  }, [actions, motion, invalidate]);

  return (
    <group ref={root} position={[fit.x, fit.y, fit.z]} scale={fit.scale}>
      <primitive object={rig} />
      <CharacterWardrobe rig={rig} appearance={appearance} gender={gender} />
      {held && hand ? createPortal(<group scale={1 / fit.scale}>{held}</group>, hand) : null}
    </group>
  );
}

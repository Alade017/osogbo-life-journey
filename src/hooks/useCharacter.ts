import { useEffect, useMemo } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { Color, LoopOnce, LoopRepeat, Mesh, type Material, type Object3D } from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { DRACO_PATH } from "@/types/models";
import type { CharacterAppearance3D } from "@/types/models";

const ANIMATION_NAMES: Readonly<Record<string, string>> = {
  idle: "Idle",
  walk: "Walk",
  sit: "Sit",
  work: "Work",
  wave: "Wave",
  talk: "Wave",
};

export function resolveCharacterAnimation(
  requested: string,
  available: readonly string[],
  names?: Readonly<Record<string, string>>,
) {
  const semantic = requested.toLowerCase();
  const configured = names?.[requested] ?? names?.[semantic];
  const preferred = configured ?? ANIMATION_NAMES[semantic] ?? requested;
  const match = (name: string) =>
    available.find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  return match(preferred) ?? (semantic !== "idle" ? match(names?.["idle"] ?? "Idle") : undefined);
}

function cloneCharacterScene(source: Object3D) {
  const scene = clone(source);
  scene.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    const cloneMaterial = (material: Material) => {
      const copy = material.clone();
      const color = (copy as Material & { color?: Color }).color;
      if (color) copy.userData["baseColor"] = color.getHexString();
      return copy;
    };
    node.material = Array.isArray(node.material)
      ? node.material.map(cloneMaterial)
      : cloneMaterial(node.material);
  });
  return scene;
}

export function useCharacter(
  modelPath: string,
  animation: string,
  names?: Readonly<Record<string, string>>,
  appearance?: CharacterAppearance3D,
) {
  const gltf = useGLTF(modelPath, DRACO_PATH);
  const scene = useMemo(() => cloneCharacterScene(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  useEffect(
    () => () => {
      scene.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material.dispose());
      });
    },
    [scene],
  );
  useEffect(() => {
    const name = resolveCharacterAnimation(animation, Object.keys(actions), names);
    const action = name ? actions[name] : undefined;
    if (!action) {
      return;
    }
    const oneShot = ["sit", "wave", "talk"].includes(animation.toLowerCase());
    action.setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity);
    action.clampWhenFinished = oneShot;
    action.reset().fadeIn(0.15).play();
    return () => {
      action.fadeOut(0.15);
    };
  }, [actions, animation, names, modelPath, gltf.animations.length]);
  useEffect(() => {
    scene.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      for (const material of materials) {
        const color = (material as Material & { color?: Color }).color;
        if (!color) continue;
        if (material.name === "Skin")
          color.set(
            appearance?.skinTone ?? `#${String(material.userData["baseColor"] ?? "ffffff")}`,
          );
        if (material.name === "Outfit")
          color.set(
            appearance?.outfitColor ?? `#${String(material.userData["baseColor"] ?? "ffffff")}`,
          );
      }
    });
  }, [scene, appearance?.skinTone, appearance?.outfitColor]);
  // Geometry/textures stay shared; cloned per-character materials allow independent palettes.
  return { scene, animations: gltf.animations };
}

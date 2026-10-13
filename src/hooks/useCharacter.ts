import { useEffect, useMemo } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { DRACO_PATH } from "@/types/models";

export function useCharacter(modelPath: string, animation: string, names?: Readonly<Record<string, string>>) {
  const gltf = useGLTF(modelPath, DRACO_PATH);
  const scene = useMemo(() => clone(gltf.scene), [gltf.scene]);
  const { actions } = useAnimations(gltf.animations, scene);
  useEffect(() => {
    const name = names?.[animation] ?? animation;
    const action = actions[name] ?? Object.entries(actions).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
    if (!action) { if (gltf.animations.length) console.warn(`Animation '${name}' unavailable in ${modelPath}`); return; }
    action.reset().fadeIn(0.15).play();
    return () => { action.fadeOut(0.15); };
  }, [actions, animation, names, modelPath, gltf.animations.length]);
  // SkeletonUtils clones bones, while cached geometry/textures remain shared.
  return { scene, animations: gltf.animations };
}

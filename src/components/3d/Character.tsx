import { memo, useMemo } from "react";
import { createPortal } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { Bone, Skeleton, SkinnedMesh, type Object3D } from "three";
import { useCharacter } from "@/hooks/useCharacter";
import { DRACO_PATH, type CharacterModel, type ModelPart } from "@/types/models";

function Part({ part, body }: { part: ModelPart; body: Object3D }) {
  const gltf = useGLTF(part.modelPath, DRACO_PATH);
  const object = useMemo(() => {
    const copy = clone(gltf.scene);
    copy.traverse((node) => {
      if (!(node instanceof SkinnedMesh)) return;
      const bones = node.skeleton.bones.map((bone) => {
        const target = body.getObjectByName(bone.name);
        if (!(target instanceof Bone)) throw new Error(`Incompatible modular rig: ${bone.name}`);
        return target;
      });
      node.bind(new Skeleton(bones, node.skeleton.boneInverses.map((matrix) => matrix.clone())), node.bindMatrix);
    });
    return copy;
  }, [gltf.scene, body]);
  const socket = part.socket ? body.getObjectByName(part.socket) : null;
  if (part.socket && !socket) throw new Error(`Missing attachment socket: ${part.socket}`);
  return socket ? createPortal(<primitive object={object} dispose={null} />, socket) : <primitive object={object} dispose={null} />;
}

export const Character = memo(function Character({ modelPath, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, currentAnimation = "Idle", animationNames, parts = [] }: CharacterModel) {
  const { scene } = useCharacter(modelPath, currentAnimation, animationNames);
  return <group position={position} rotation={rotation} scale={scale}>
    <primitive object={scene} dispose={null} />
    {parts.map((part) => <Part key={`${part.modelPath}:${part.socket ?? "root"}`} part={part} body={scene} />)}
  </group>;
});

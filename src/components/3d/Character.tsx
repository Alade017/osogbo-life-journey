import { memo, useMemo } from "react";
import { createPortal } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { Bone, Skeleton, SkinnedMesh, type Object3D } from "three";
import { useCharacter } from "@/hooks/useCharacter";
import {
  DRACO_PATH,
  type CharacterAppearance3D,
  type CharacterModel,
  type ModelPart,
} from "@/types/models";

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
      node.bind(
        new Skeleton(
          bones,
          node.skeleton.boneInverses.map((matrix) => matrix.clone()),
        ),
        node.bindMatrix,
      );
    });
    return copy;
  }, [gltf.scene, body]);
  const socket = part.socket ? body.getObjectByName(part.socket) : null;
  if (part.socket && !socket) throw new Error(`Missing attachment socket: ${part.socket}`);
  return socket ? (
    createPortal(<primitive object={object} dispose={null} />, socket)
  ) : (
    <primitive object={object} dispose={null} />
  );
}

function HairStyle({ appearance, head }: { appearance: CharacterAppearance3D; head: Object3D }) {
  const style = appearance.hairStyle ?? "short";
  if (style === "bald") return null;
  const color = appearance.hairColor ?? "#24180f";
  const curly = style === "afro";
  return createPortal(
    <group position={[0, 0.19, 0]}>
      <mesh scale={style === "afro" ? [0.24, 0.2, 0.23] : [0.19, 0.12, 0.19]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {style === "braids" &&
        [-0.12, -0.04, 0.04, 0.12].map((x) => (
          <mesh key={x} position={[x, -0.08, 0]} rotation={[0, 0, -0.18]}>
            <cylinderGeometry args={[0.025, 0.025, 0.28, 5]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
        ))}
      {style === "locs" &&
        [-0.14, -0.07, 0, 0.07, 0.14].map((x) => (
          <mesh key={x} position={[x, -0.13, 0]}>
            <cylinderGeometry args={[0.025, 0.035, 0.3, 5]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
        ))}
      {curly && (
        <mesh position={[0, -0.08, 0]} scale={[0.23, 0.12, 0.23]}>
          <sphereGeometry args={[1, 7, 5]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      )}
    </group>,
    head,
  );
}

export const Character = memo(function Character({
  modelPath,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  currentAnimation = "Idle",
  animationNames,
  parts = [],
  appearance,
}: CharacterModel) {
  const { scene } = useCharacter(modelPath, currentAnimation, animationNames, appearance);
  const head = scene.getObjectByName("Head");
  const characterParts = useMemo(
    () => [parts, [appearance?.hairPart, appearance?.outfitPart].filter((part) => !!part)].flat(),
    [parts, appearance?.hairPart, appearance?.outfitPart],
  );
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} dispose={null} />
      {appearance && !appearance.hairPart && head && (
        <HairStyle appearance={appearance} head={head} />
      )}
      {characterParts.map((part) => (
        <Part key={`${part.modelPath}:${part.socket ?? "root"}`} part={part} body={scene} />
      ))}
    </group>
  );
});

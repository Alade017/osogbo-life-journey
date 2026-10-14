import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { DRACO_PATH } from "@/types/models";

export function Model({ modelPath }: { modelPath: string }) {
  const gltf = useGLTF(modelPath, DRACO_PATH);
  const object = useMemo(() => clone(gltf.scene), [gltf.scene]);
  return <primitive object={object} dispose={null} />;
}

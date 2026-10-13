import { memo, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { InstancedMesh, Object3D } from "three";
import { useCityInteractions } from "@/hooks/useCityInteractions";
import { DRACO_PATH, type CityLocationModel, type Vector3Tuple } from "@/types/models";

export function Model({ modelPath }: { modelPath: string }) {
  const gltf = useGLTF(modelPath, DRACO_PATH);
  const object = useMemo(() => clone(gltf.scene), [gltf.scene]);
  return <primitive object={object} dispose={null} />;
}
export function RepeatedProps({ positions }: { positions: readonly Vector3Tuple[] }) {
  const mesh = useRef<InstancedMesh>(null);
  useEffect(() => {
    const object = new Object3D();
    positions.forEach((position, index) => { object.position.set(...position); object.updateMatrix(); mesh.current?.setMatrixAt(index, object.matrix); });
    if (mesh.current) { mesh.current.instanceMatrix.needsUpdate = true; mesh.current.computeBoundingSphere(); }
  }, [positions]);
  return <instancedMesh ref={mesh} args={[undefined, undefined, positions.length]}>
    <coneGeometry args={[0.3, 1.1, 5]} /><meshLambertMaterial color="#176b45" />
  </instancedMesh>;
}
export const CityMap = memo(function CityMap({ modelPaths, locations, onLocationSelect }: { modelPaths: readonly string[]; locations: readonly CityLocationModel[]; onLocationSelect?: (id: string) => void }) {
  const select = useCityInteractions(onLocationSelect);
  return <group>
    {modelPaths.map((path) => <Model key={path} modelPath={path} />)}
    {locations.map((location) => <group key={location.id} position={location.position} scale={location.scale ?? 1} onClick={(event) => select(location.id, event)}>
      <Model modelPath={location.modelPath} />
    </group>)}
  </group>;
});

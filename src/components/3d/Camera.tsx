import { OrbitControls, OrthographicCamera } from "@react-three/drei";
export function Camera({ zoom = 38 }: { zoom?: number }) {
  return (
    <>
      <OrthographicCamera makeDefault position={[16, 18, 16]} zoom={zoom} near={0.1} far={100} />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        minZoom={18}
        maxZoom={80}
        minPolarAngle={0.6}
        maxPolarAngle={1.1}
        enableDamping={false}
      />
    </>
  );
}

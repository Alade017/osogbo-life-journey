import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { MOUSE, TOUCH } from "three";
import { useEffect, useRef } from "react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { clampTownTarget } from "@/lib/town-grid";

export function Camera({
  zoom = 38,
  mapControls = false,
}: {
  zoom?: number;
  mapControls?: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  useEffect(() => {
    if (!mapControls) return;
    const focus = (event: Event) => {
      const detail = (event as CustomEvent<{ x: number; z: number }>).detail;
      if (!detail || !controls.current) return;
      controls.current.target.set(detail.x, 0, detail.z);
      controls.current.update();
    };
    window.addEventListener("osogbo:map-focus", focus);
    return () => window.removeEventListener("osogbo:map-focus", focus);
  }, [mapControls]);
  return (
    <>
      <OrthographicCamera makeDefault position={[16, 18, 16]} zoom={zoom} near={0.1} far={100} />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0, 0]}
        enablePan={mapControls}
        enableZoom
        enableRotate={!mapControls}
        mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
        touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
        minZoom={mapControls ? 20 : 18}
        maxZoom={mapControls ? 64 : 80}
        minPolarAngle={mapControls ? 0.86 : 0.6}
        maxPolarAngle={mapControls ? 0.86 : 1.1}
        enableDamping={false}
        onChange={() => {
          if (!mapControls || !controls.current) return;
          const target = controls.current.target;
          const bounded = clampTownTarget(
            { x: target.x, z: target.z },
            { minX: -14, maxX: 14, minZ: -10, maxZ: 10 },
          );
          target.set(bounded.x, 0, bounded.z);
        }}
      />
    </>
  );
}

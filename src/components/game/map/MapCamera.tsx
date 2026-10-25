import { useEffect, useRef } from "react";
import { CameraControls } from "@react-three/drei";
import type { POI } from "@/store/mapSlice";

export const MapCamera = ({ selectedPoi = null }: { selectedPoi?: POI | null }) => {
  const controlsRef = useRef<CameraControls>(null);
  useEffect(() => {
    const position = selectedPoi?.position;
    void controlsRef.current?.setLookAt(
      position?.[0] ?? 0,
      position ? position[1] + 2 : 15,
      position ? position[2] + 2 : 15,
      position?.[0] ?? 0,
      position?.[1] ?? 0,
      position?.[2] ?? 0,
      true,
    );
  }, [selectedPoi]);
  return (
    <CameraControls
      ref={controlsRef}
      dollySpeed={0.3}
      azimuthRotateSpeed={0.5}
      polarRotateSpeed={0.5}
      enabled={!selectedPoi}
    />
  );
};

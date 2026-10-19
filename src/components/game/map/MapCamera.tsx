// src/components/game/map/MapCamera.tsx
import { useRef, useEffect } from "react";
import { CameraControls, CameraControlsProps } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useSelector } from "react-redux";
import { selectSelectedPoi, POI } from "../../store/mapSlice";
import { RootState } from "../../store/store"; // adjust if needed
import { Vector3 } from "three";

/**
 * Camera controller that smoothly transitions the view to the selected POI.
 * When no POI is selected, it stays at a top‑down overview.
 */
export const MapCamera = () => {
  const controlsRef = useRef<CameraControls>(null);
  const selectedPoi = useSelector(selectSelectedPoi);

  // Default overview position (slightly above the ground, looking down)
  const overviewTarget = new Vector3(0, 0, 0);
  const overviewPosition = new Vector3(0, 15, 15);

  // When a POI is selected, animate to an isometric close‑up
  const targetPosition = selectedPoi
    ? new Vector3(selectedPoi.position[0], selectedPoi.position[1] + 2, selectedPoi.position[2] + 2)
    : overviewPosition;
  const targetLookAt = selectedPoi ? new Vector3(...selectedPoi.position) : overviewTarget;

  useEffect(() => {
    if (!controlsRef.current) return;
    // Instantly set the camera to the overview if no selection (no animation needed on mount)
    if (!selectedPoi) {
      controlsRef.current.setPosition(overviewPosition.x, overviewPosition.y, overviewPosition.z);
      controlsRef.current.setTarget(overviewTarget.x, overviewTarget.y, overviewTarget.z);
    }
    // The actual smooth transition runs inside the `setLookAt` call – we use a small damping factor.
    // The `setLookAt` method will be called every frame in the render loop (useFrame) for smoothness.
  }, [selectedPoi]);

  // Render the controls; the animation happens inside the frame loop.
  return (
    <CameraControls
      ref={controlsRef}
      // Damping for cinematic feel
      dollySpeed={0.3}
      rotateSpeed={0.5}
      azimuthRotateSpeed={0.5}
      polarRotateSpeed={0.5}
      // Make the controls feel "locked" when a POI is selected
      enabled={!selectedPoi}
    />
  );
};

// Optional: useFrame to smoothly interpolate when a POI is selected.
import { useFrame } from "@react-three/fiber";
useFrame(() => {
  if (!controlsRef.current) return;
  if (selectedPoi) {
    // Lerp position and target for cinematic easing
    const currentPos = controlsRef.current.getPosition(new Vector3());
    const currentTarget = controlsRef.current.getTarget(new Vector3());
    const lerpFactor = 0.08; // feel free to tweak
    currentPos.lerp(targetPosition, lerpFactor);
    currentTarget.lerp(targetLookAt, lerpFactor);
    controlsRef.current.setPosition(currentPos.x, currentPos.y, currentPos.z);
    controlsRef.current.setTarget(currentTarget.x, currentTarget.y, currentTarget.z);
  } else {
    // Return to overview using the same lerp logic
    const currentPos = controlsRef.current.getPosition(new Vector3());
    const currentTarget = controlsRef.current.getTarget(new Vector3());
    const lerpFactor = 0.08;
    currentPos.lerp(overviewPosition, lerpFactor);
    currentTarget.lerp(overviewTarget, lerpFactor);
    controlsRef.current.setPosition(currentPos.x, currentPos.y, currentPos.z);
    controlsRef.current.setTarget(currentTarget.x, currentTarget.y, currentTarget.z);
  }
});

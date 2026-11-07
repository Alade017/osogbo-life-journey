import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

/**
 * Smooth camera glide controller for R3F map surfaces.
 * Animates the camera toward a focus target without abrupt jumps
 * while preserving the town isometric pitch and elevation.
 */
export function useMapCameraFocus(
  targetPosition: [number, number, number] | null | undefined,
  enabled = true,
) {
  const { camera } = useThree();
  const currentTarget = useRef(new Vector3(0, 0, 0));
  const isInitialized = useRef(false);

  useFrame((_, delta) => {
    if (!enabled || !targetPosition) return;

    const target = new Vector3(targetPosition[0], targetPosition[1], targetPosition[2]);

    if (!isInitialized.current) {
      currentTarget.current.copy(target);
      isInitialized.current = true;
      return;
    }

    // Smoothly interpolate the look-at point
    currentTarget.current.lerp(target, Math.min(1, delta * 3.0));
    camera.lookAt(currentTarget.current);
  });
}

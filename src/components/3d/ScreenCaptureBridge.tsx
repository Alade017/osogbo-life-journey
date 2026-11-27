import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { registerScreenCapture } from "@/lib/camera-screen-capture";

/**
 * Lets the phone Camera and the hold-to-screenshot shortcut read this scene's 3D view.
 * It renders the frame and reads it in the same step, so the image is never blank.
 */
export function ScreenCaptureBridge() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);
  const camera = useThree((state) => state.camera);
  useEffect(
    () =>
      registerScreenCapture(
        () =>
          new Promise((resolve) => {
            gl.render(scene, camera);
            gl.domElement.toBlob((blob) => resolve(blob), "image/png");
          }),
      ),
    [gl, scene, camera],
  );
  return null;
}

import {
  useCallback,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Group,
  Vector3,
  type Camera,
  type OrthographicCamera,
  type PerspectiveCamera,
} from "three";
import { mountSceneOverlay } from "./scene-overlay-root";

type OverlayRoot = ReturnType<typeof mountSceneOverlay>;

const cameraWorldPos = new Vector3();
const groupWorldPos = new Vector3();

/** DOM labels own isolated containers; their roots are disposed cleanly after React commits. */
export function SceneHtml({
  children,
  position,
  center = false,
  distanceFactor,
  zIndexRange = [20, 0],
  portal,
  style,
  pointerEvents,
}: {
  children: ReactNode;
  position?: [number, number, number];
  center?: boolean;
  distanceFactor?: number;
  zIndexRange?: [number, number];
  portal?: RefObject<HTMLElement | null>;
  style?: CSSProperties;
  pointerEvents?: CSSProperties["pointerEvents"];
}) {
  const group = useRef<Group>(null);
  const overlay = useRef<OverlayRoot | null>(null);
  const projected = useRef(new Vector3());
  const previous = useRef("");
  const { camera, size, gl, invalidate } = useThree();
  const target = portal?.current ?? gl.domElement.parentElement;

  const syncTransform = useCallback(
    (cam: Camera, viewport: { width: number; height: number }) => {
      if (!overlay.current || !group.current) return;
      const { element } = overlay.current;
      cam.updateMatrixWorld();
      group.current.updateWorldMatrix(true, false);
      const point = projected.current.setFromMatrixPosition(group.current.matrixWorld).project(cam);
      const x = ((point.x + 1) * viewport.width) / 2;
      const y = ((1 - point.y) * viewport.height) / 2;

      let scale = 1;
      if (distanceFactor !== undefined) {
        if ("isPerspectiveCamera" in cam && cam.isPerspectiveCamera) {
          const pCam = cam as PerspectiveCamera;
          cameraWorldPos.setFromMatrixPosition(pCam.matrixWorld);
          groupWorldPos.setFromMatrixPosition(group.current.matrixWorld);
          const vFOV = (pCam.fov * Math.PI) / 180;
          const dist = Math.max(0.001, groupWorldPos.distanceTo(cameraWorldPos));
          const objectScale = 1 / (2 * Math.tan(vFOV / 2) * dist);
          scale = objectScale * distanceFactor;
        } else {
          const zoom = (cam as OrthographicCamera).zoom ?? 1;
          scale = (zoom || 1) * distanceFactor;
        }
      }

      const transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
      if (previous.current !== transform) {
        element.style.transform = transform;
        previous.current = transform;
      }
      const zIndex = Math.round(
        zIndexRange[1] + ((1 - point.z) / 2) * (zIndexRange[0] - zIndexRange[1]),
      );
      const hidden = point.z < -1 || point.z > 1;
      if (element.style.zIndex !== String(zIndex)) element.style.zIndex = String(zIndex);
      if (element.hidden !== hidden) element.hidden = hidden;
    },
    [distanceFactor, zIndexRange],
  );

  useLayoutEffect(() => {
    if (!target) return;
    const entry = mountSceneOverlay(target);
    overlay.current = entry;
    previous.current = "";
    syncTransform(camera, size);
    return () => {
      if (overlay.current === entry) overlay.current = null;
      entry.dispose();
    };
  }, [target, camera, size, syncTransform]);

  useLayoutEffect(() => {
    overlay.current?.root.render(
      <div
        style={{
          pointerEvents: pointerEvents ?? "auto",
          ...style,
          ...(center ? { transform: "translate(-50%, -50%)" } : {}),
        }}
      >
        {children}
      </div>,
    );
    invalidate();
  });

  useFrame((state) => {
    syncTransform(state.camera, state.size);
  });

  return <group ref={group} {...(position ? { position } : {})} />;
}

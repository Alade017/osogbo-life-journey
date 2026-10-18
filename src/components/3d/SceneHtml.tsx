import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Vector3, type OrthographicCamera } from "three";
import { mountSceneOverlay } from "./scene-overlay-root";

type OverlayRoot = ReturnType<typeof mountSceneOverlay>;

/** DOM labels own isolated containers; their roots are disposed after the scene commit. */
export function SceneHtml({
  children,
  position,
  center = false,
  distanceFactor,
  zIndexRange = [20, 0],
}: {
  children: ReactNode;
  position?: [number, number, number];
  center?: boolean;
  distanceFactor?: number;
  zIndexRange?: [number, number];
}) {
  const group = useRef<Group>(null);
  const overlay = useRef<OverlayRoot | null>(null);
  const projected = useRef(new Vector3());
  const previous = useRef("");
  const { gl, invalidate } = useThree();
  const target = gl.domElement.parentElement;
  useLayoutEffect(() => {
    if (!target) return;
    const entry = mountSceneOverlay(target);
    overlay.current = entry;
    previous.current = "";
    return () => {
      if (overlay.current === entry) overlay.current = null;
      entry.dispose();
    };
  }, [target]);
  useLayoutEffect(() => {
    overlay.current?.root.render(
      <div
        style={{ transform: center ? "translate(-50%, -50%)" : undefined, pointerEvents: "auto" }}
      >
        {children}
      </div>,
    );
    invalidate();
  });
  useFrame(({ camera, size }) => {
    if (!overlay.current || !group.current) return;
    const { element } = overlay.current;
    camera.updateMatrixWorld();
    group.current.updateWorldMatrix(true, false);
    const point = projected.current
      .setFromMatrixPosition(group.current.matrixWorld)
      .project(camera);
    const x = ((point.x + 1) * size.width) / 2;
    const y = ((1 - point.y) * size.height) / 2;
    const zoom = (camera as OrthographicCamera).zoom ?? 1;
    const scale = distanceFactor === undefined ? 1 : distanceFactor / zoom;
    const transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0) scale(${scale})`;
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
  });
  return <group ref={group} {...(position ? { position } : {})} />;
}

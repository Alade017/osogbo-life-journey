import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { MOUSE, TOUCH, Vector3, type OrthographicCamera } from "three";

import { mapCameraFrame, mapCameraPanLimits } from "./map-camera-geometry";

import { EMPTY_FOCUS_INSETS, mapFocusTarget, type MapFocusInsets } from "./map-focus";

const VIEW_DIRECTION = new Vector3(0, 1.35, 1).normalize();
const VIEW_POLAR = Math.atan2(1, 1.35);

/** Fixed north-up, oblique city camera: one-finger pan, pinch zoom, no orbit. */
export function MapCameraRig({
  width,
  depth,
  target,
  zoom = 1,
  onManual,
  active = true,
  focusInsets = EMPTY_FOCUS_INSETS,
}: {
  width: number;
  depth: number;
  target: readonly [number, number, number];
  zoom?: number;
  onManual?: () => void;
  active?: boolean;
  focusInsets?: MapFocusInsets;
}) {
  const { camera: sceneCamera, size, invalidate } = useThree();
  const camera = sceneCamera as OrthographicCamera;
  const controls = useRef<OrbitControlsImpl>(null);
  const goal = useRef(new Vector3());
  const scratch = useRef({ shift: new Vector3(), offset: new Vector3() });
  const transitioning = useRef(false);
  const initializedCamera = useRef<OrthographicCamera | null>(null);
  const wantedZoom = useRef(zoom);
  const lastRequestedZoom = useRef(zoom);
  const [x, y, z] = target;
  const frame = useMemo(
    () => mapCameraFrame(width, depth, size.width, size.height),
    [width, depth, size.width, size.height],
  );
  const previousMinZoom = useRef(frame.minZoom);
  const clampTarget = (point: Vector3) => {
    const limits = mapCameraPanLimits(width, depth, camera);
    const offset = mapFocusTarget([0, 0, 0], focusInsets, size, camera);
    return point.set(
      Math.max(-limits.x + offset[0], Math.min(limits.x + offset[0], point.x)),
      0,
      Math.max(-limits.z + offset[2], Math.min(limits.z + offset[2], point.z)),
    );
  };

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    camera.left = frame.left;
    camera.right = frame.right;
    camera.top = frame.top;
    camera.bottom = frame.bottom;
    const initial = initializedCamera.current !== camera;
    camera.zoom = initial
      ? frame.minZoom * Math.max(1, zoom)
      : Math.max(
          frame.minZoom,
          Math.min(frame.maxZoom, (camera.zoom * frame.minZoom) / previousMinZoom.current),
        );
    previousMinZoom.current = frame.minZoom;
    camera.near = 0.1;
    camera.far = Math.max(500, Math.max(width, depth) * 8);
    if (initial) {
      const focus = clampTarget(new Vector3(x, y, z));
      camera.position.copy(focus).addScaledVector(VIEW_DIRECTION, Math.max(width, depth) * 2);
      camera.lookAt(focus);
      orbit.target.copy(focus);
      initializedCamera.current = camera;
      orbit.update();
    }
    const shift = scratch.current.offset.copy(orbit.target);
    clampTarget(orbit.target);
    shift.subVectors(orbit.target, shift);
    camera.position.add(shift);
    wantedZoom.current = camera.zoom;
    camera.updateProjectionMatrix();
    invalidate();
    // Resizing changes the frustum, not the user's map position or pinch zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, frame, width, depth, invalidate]);

  useEffect(() => {
    if (!active) {
      transitioning.current = false;
      return;
    }
    wantedZoom.current =
      lastRequestedZoom.current === zoom
        ? camera.zoom
        : Math.min(frame.maxZoom, frame.minZoom * Math.max(1, zoom));
    const limits = mapCameraPanLimits(width, depth, { ...frame, zoom: wantedZoom.current });
    const focus = mapFocusTarget(
      [Math.max(-limits.x, Math.min(limits.x, x)), y, Math.max(-limits.z, Math.min(limits.z, z))],
      focusInsets,
      size,
      {
        ...frame,
        zoom: wantedZoom.current,
      },
    );
    goal.current.set(focus[0], 0, focus[2]);
    lastRequestedZoom.current = zoom;
    transitioning.current = true;
    invalidate();
  }, [x, y, z, zoom, width, depth, active, camera, frame, invalidate, focusInsets, size]);

  useFrame((_, delta) => {
    const orbit = controls.current;
    if (!orbit || !transitioning.current) return;
    const reduced =
      typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alpha = reduced ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 9);
    const shift = scratch.current.shift.copy(goal.current).sub(orbit.target).multiplyScalar(alpha);
    orbit.target.add(shift);
    camera.position.add(shift);
    camera.zoom += (wantedZoom.current - camera.zoom) * alpha;
    camera.updateProjectionMatrix();
    orbit.update();
    transitioning.current =
      orbit.target.distanceTo(goal.current) > 0.005 ||
      Math.abs(camera.zoom - wantedZoom.current) > 0.001;
    if (transitioning.current) invalidate();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableRotate={false}
      enablePan
      enableZoom
      enableDamping
      dampingFactor={0.12}
      screenSpacePanning={false}
      zoomToCursor
      minZoom={frame.minZoom}
      maxZoom={frame.maxZoom}
      minPolarAngle={VIEW_POLAR}
      maxPolarAngle={VIEW_POLAR}
      minAzimuthAngle={0}
      maxAzimuthAngle={0}
      mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
      touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
      onChange={() => {
        const orbit = controls.current;
        if (!orbit) return;
        const shift = scratch.current.offset.copy(orbit.target);
        clampTarget(orbit.target);
        shift.subVectors(orbit.target, shift);
        camera.position.add(shift);
      }}
      onStart={() => {
        transitioning.current = false;
        onManual?.();
      }}
    />
  );
}

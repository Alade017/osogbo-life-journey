import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { OrthographicCamera, Vector3, TOUCH, MOUSE } from "three";
import { mapCameraPanLimits } from "@/components/map/map-camera-geometry";
import { MapCameraRig } from "@/components/map/MapCameraRig";

const state = vi.hoisted(() => ({
  camera: null as unknown as OrthographicCamera,
  orbit: null as unknown as { target: Vector3; update: () => void },
  frame: null as unknown as (state: unknown, delta: number) => void,
  invalidate: vi.fn(),
  controlProps: {} as Record<string, unknown>,
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({
    camera: state.camera,
    size: { width: 1000, height: 600 },
    invalidate: state.invalidate,
  }),
  useFrame: (callback: typeof state.frame) => {
    state.frame = callback;
  },
}));
vi.mock("@react-three/drei", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    OrbitControls: forwardRef((props: { onStart: () => void }, ref) => {
      state.controlProps = props;
      const { onStart } = props;
      useImperativeHandle(ref, () => state.orbit);
      return (
        <button type="button" onClick={onStart}>
          Drag camera
        </button>
      );
    }),
  };
});
beforeEach(() => {
  state.camera = new OrthographicCamera(-50, 50, 30, -30);
  state.orbit = { target: new Vector3(), update: vi.fn() };
  state.invalidate.mockClear();
});
afterEach(cleanup);
const settle = () =>
  act(() => {
    for (let frame = 0; frame < 120; frame++) state.frame({}, 1 / 60);
  });

it("smoothly focuses a destination and stops automatic movement during manual exploration", () => {
  const onManual = vi.fn();
  const { rerender } = render(
    <MapCameraRig zoom={2} width={100} depth={60} target={[0, 0, 0]} onManual={onManual} />,
  );
  rerender(
    <MapCameraRig zoom={2} width={100} depth={60} target={[20, 0, -10]} onManual={onManual} />,
  );
  expect(state.orbit.target.x).toBe(0);
  settle();
  expect(state.orbit.target.distanceTo(new Vector3(20, 0, -10))).toBeLessThan(0.01);
  fireEvent.click(screen.getByRole("button", { name: "Drag camera" }));
  expect(onManual).toHaveBeenCalledOnce();
  const manualTarget = new Vector3(8, 0, 12);
  state.orbit.target.copy(manualTarget);
  rerender(<MapCameraRig zoom={2} width={100} depth={60} target={[30, 0, 15]} active={false} />);
  settle();
  expect(state.orbit.target.equals(manualTarget)).toBe(true);
  rerender(<MapCameraRig zoom={2} width={100} depth={60} target={[30, 0, 15]} active />);
  settle();
  const limits = mapCameraPanLimits(100, 60, state.camera);
  expect(
    state.orbit.target.distanceTo(new Vector3(Math.min(30, limits.x), 0, Math.min(15, limits.z))),
  ).toBeLessThan(0.01);
});

it("moves camera and orbit target together so focus changes preserve the viewing direction", () => {
  const { rerender } = render(<MapCameraRig zoom={2} width={100} depth={60} target={[0, 0, 0]} />);
  const offset = state.camera.position.clone().sub(state.orbit.target);
  rerender(<MapCameraRig zoom={2} width={100} depth={60} target={[-15, 0, 24]} />);
  settle();
  expect(state.camera.position.clone().sub(state.orbit.target).distanceTo(offset)).toBeLessThan(
    0.01,
  );
});

it("locks rotation and maps a single-finger or left-button drag to panning", () => {
  render(<MapCameraRig width={100} depth={60} target={[0, 0, 0]} />);
  expect(state.controlProps.enableRotate).toBe(false);
  expect(state.controlProps.touches).toEqual({ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN });
  expect(state.controlProps.mouseButtons).toEqual({
    LEFT: MOUSE.PAN,
    MIDDLE: MOUSE.DOLLY,
    RIGHT: MOUSE.PAN,
  });
});
it("keeps pinch zoom when a selected destination is centred", () => {
  const { rerender } = render(<MapCameraRig width={100} depth={60} target={[0, 0, 0]} />);
  fireEvent.click(screen.getByRole("button", { name: "Drag camera" }));
  state.camera.zoom = 2.5;
  rerender(<MapCameraRig width={100} depth={60} target={[12, 0, 8]} />);
  settle();
  expect(state.camera.zoom).toBeCloseTo(2.5);
  expect(state.orbit.target.distanceTo(new Vector3(12, 0, 8))).toBeLessThan(0.01);
});

it("bounds a drag before the city can disappear off screen", () => {
  render(<MapCameraRig width={100} depth={60} target={[0, 0, 0]} />);
  const offset = state.camera.position.clone().sub(state.orbit.target);
  state.orbit.target.set(1000, 0, 1000);
  state.camera.position.copy(offset).add(state.orbit.target);
  (state.controlProps.onChange as () => void)();
  const limits = mapCameraPanLimits(100, 60, state.camera);
  expect(state.orbit.target.x).toBeCloseTo(limits.x);
  expect(state.orbit.target.z).toBeCloseTo(limits.z);
  expect(state.camera.position.clone().sub(state.orbit.target).distanceTo(offset)).toBeLessThan(
    0.001,
  );
});

it("focuses beside the destination sheet and preserves position and zoom when it closes", () => {
  const { rerender } = render(
    <MapCameraRig
      width={100}
      depth={60}
      target={[0, 0, 0]}
      zoom={2.4}
      focusInsets={{ right: 400, bottom: 0 }}
    />,
  );
  settle();
  expect(state.orbit.target.x).toBeGreaterThan(0);
  const position = state.orbit.target.clone(),
    zoom = state.camera.zoom;
  rerender(<MapCameraRig width={100} depth={60} target={[0, 0, 0]} zoom={1.1} active={false} />);
  settle();
  expect(state.orbit.target.distanceTo(position)).toBeLessThan(0.001);
  expect(state.camera.zoom).toBe(zoom);
});

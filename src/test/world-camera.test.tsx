import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { WorldCamera } from "@/components/3d/WorldScene";
const state = vi.hoisted(() => ({
  camera: null as unknown,
  controls: null as unknown,
  end: null as null | (() => void),
  invalidate: vi.fn(),
}));
vi.mock("@react-three/fiber", () => ({
  useThree: () => ({
    camera: state.camera,
    size: { width: 1000, height: 800 },
    invalidate: state.invalidate,
  }),
  useFrame: vi.fn(),
}));
vi.mock("@react-three/drei", async () => {
  const React = await import("react");
  return {
    ContactShadows: () => null,
    OrbitControls: React.forwardRef(function MockControls(props: { onEnd: () => void }, ref) {
      React.useImperativeHandle(ref, () => state.controls);
      state.end = props.onEnd;
      return null;
    }),
  };
});
beforeEach(() => {
  state.camera = new PerspectiveCamera();
  state.controls = {
    target: new Vector3(),
    update: vi.fn(),
    getDistance: () =>
      (state.camera as PerspectiveCamera).position.distanceTo(
        (state.controls as { target: Vector3 }).target,
      ),
  };
});
it("preserves the player-adjusted orbit while following a moving target", () => {
  const view = render(<WorldCamera width={17} depth={14} target={[0, 0, 0]} />);
  const camera = state.camera as PerspectiveCamera;
  camera.position.set(20, 25, 30);
  view.rerender(<WorldCamera width={17} depth={14} target={[3, 0, 5]} />);
  expect(camera.position.toArray()).toEqual([23, 25, 35]);
  expect((state.controls as { target: Vector3 }).target.toArray()).toEqual([3, 0, 5]);
});
it("reports gesture zoom and preserves the orbit direction when buttons change zoom", () => {
  const onZoomChange = vi.fn();
  const view = render(<WorldCamera width={17} depth={14} zoom={1} onZoomChange={onZoomChange} />);
  const camera = state.camera as PerspectiveCamera;
  const distance = camera.position.length();
  camera.position.set(1, 2, 3).setLength(distance / 1.2);
  state.end?.();
  expect(onZoomChange).toHaveBeenCalledWith(expect.closeTo(1.2));
  const direction = camera.position.clone().normalize();
  view.rerender(<WorldCamera width={17} depth={14} zoom={1.35} onZoomChange={onZoomChange} />);
  expect(camera.position.length()).toBeCloseTo(distance / 1.35);
  expect(camera.position.clone().normalize().distanceTo(direction)).toBeLessThan(0.000001);
});

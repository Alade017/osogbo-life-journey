import { createRef } from "react";
import { act, render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { Group, OrthographicCamera, Vector3 } from "three";
import { BankCameraRig } from "@/components/3d/BankCameraRig";
import { buildBankWorld } from "@/game/bank-world-layout";

const state = vi.hoisted(() => ({ three: {} as Record<string, unknown>, tick: () => {} }));
vi.mock("@react-three/fiber", () => ({
  useThree: () => state.three,
  useFrame: (tick: () => void) => {
    state.tick = tick;
  },
}));
it("restores a manually changed camera on reset and follows the moving character", () => {
  const camera = new OrthographicCamera(-180, 180, 370, -370, 0.1, 100);
  const controls = { target: new Vector3(), update: () => camera.lookAt(controls.target) };
  state.three = { camera, controls, size: { width: 360, height: 740 }, invalidate: vi.fn() };
  const frame = createRef<HTMLDivElement>();
  const player = { current: new Group() };
  const layout = buildBankWorld("cedar-bank", "grounds");
  const view = render(
    <BankCameraRig layout={layout} frame={frame} player={player} resetToken={0} follow={false} />,
  );
  const fittedZoom = camera.zoom;
  const fittedPosition = camera.position.clone();
  camera.zoom = 28;
  camera.position.set(1, 1, 1);
  view.rerender(
    <BankCameraRig layout={layout} frame={frame} player={player} resetToken={1} follow={false} />,
  );
  expect(camera.zoom).toBe(fittedZoom);
  expect(camera.position.distanceTo(fittedPosition)).toBeLessThan(0.001);
  view.rerender(
    <BankCameraRig layout={layout} frame={frame} player={player} resetToken={1} follow />,
  );
  expect(camera.zoom).toBeGreaterThanOrEqual(20);
  act(() => state.tick());
  const before = camera.position.clone();
  player.current.position.set(3, 0, 4);
  act(() => state.tick());
  expect(controls.target.toArray()).toEqual([3, 1, 4]);
  expect(camera.position.clone().sub(before).toArray()).toEqual([3, 0, 4]);
});

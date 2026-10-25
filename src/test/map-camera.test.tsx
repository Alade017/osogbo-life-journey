import { render } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { MapCamera } from "@/components/game/map/MapCamera";

const camera = vi.hoisted(() => ({ setLookAt: vi.fn() }));
vi.mock("@react-three/drei", async () => {
  const { forwardRef, useImperativeHandle } = await import("react");
  return {
    CameraControls: forwardRef((_props, ref) => {
      useImperativeHandle(ref, () => camera);
      return null;
    }),
  };
});
beforeEach(() => camera.setLookAt.mockClear());

it("moves to the selected preview place and returns to overview when selection clears", () => {
  const { rerender, unmount } = render(<MapCamera />);
  expect(camera.setLookAt).toHaveBeenLastCalledWith(0, 15, 15, 0, 0, 0, true);
  rerender(
    <MapCamera
      selectedPoi={{
        id: "garden",
        name: "Garden",
        category: "park",
        position: [5, 1, -3],
        description: "Town garden",
      }}
    />,
  );
  expect(camera.setLookAt).toHaveBeenLastCalledWith(5, 3, -1, 5, 1, -3, true);
  rerender(<MapCamera selectedPoi={null} />);
  expect(camera.setLookAt).toHaveBeenLastCalledWith(0, 15, 15, 0, 0, 0, true);
  unmount();
});

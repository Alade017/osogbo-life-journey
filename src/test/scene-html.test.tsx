import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Matrix4, OrthographicCamera } from "three";
import { SceneHtml } from "@/components/3d/SceneHtml";

const overlay = vi.hoisted(() => ({ mount: vi.fn(), render: vi.fn(), dispose: vi.fn() }));
const scene = {
  camera: new OrthographicCamera(-10, 10, 10, -10, 0.1, 100),
  size: { width: 400, height: 400 },
  gl: { domElement: document.createElement("canvas") },
  invalidate: vi.fn(),
};
vi.mock("@react-three/fiber", () => ({ useThree: () => scene, useFrame: vi.fn() }));
vi.mock("@/components/3d/scene-overlay-root", () => ({
  mountSceneOverlay: (target: HTMLElement) => overlay.mount(target),
}));
beforeEach(() => {
  vi.clearAllMocks();
  // React DOM supplies the host ref in this test; emulate the two Object3D members used.
  Object.defineProperty(HTMLElement.prototype, "matrixWorld", {
    configurable: true,
    value: new Matrix4(),
  });
  Object.defineProperty(HTMLElement.prototype, "updateWorldMatrix", {
    configurable: true,
    value: vi.fn(),
  });
  scene.camera.position.z = 10;
  scene.camera.updateProjectionMatrix();
  const target = document.createElement("div");
  target.append(scene.gl.domElement);
  overlay.mount.mockImplementation(() => ({
    element: document.createElement("div"),
    root: { render: overlay.render },
    dispose: overlay.dispose,
  }));
});
afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "matrixWorld");
  Reflect.deleteProperty(HTMLElement.prototype, "updateWorldMatrix");
});
it("keeps its overlay root through clock updates, resize, and equal inline z-index ranges", () => {
  const { rerender, unmount } = render(<SceneHtml zIndexRange={[20, 0]}>Waiting</SceneHtml>);
  const firstHost = scene.gl.domElement.parentElement;
  scene.size = { width: 500, height: 400 };
  rerender(<SceneHtml zIndexRange={[20, 0]}>Updated</SceneHtml>);
  expect(overlay.mount).toHaveBeenCalledTimes(1);
  expect(overlay.mount).toHaveBeenCalledWith(firstHost);
  expect(overlay.dispose).not.toHaveBeenCalled();
  expect(overlay.render).toHaveBeenCalledTimes(2);
  unmount();
  expect(overlay.dispose).toHaveBeenCalledTimes(1);
});

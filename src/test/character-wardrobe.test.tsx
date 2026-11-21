import { render } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { SkinnedMesh, MeshStandardMaterial } from "three";
import { CharacterWardrobe } from "@/components/3d/CharacterWardrobe";
import { createFittedClothing } from "@/components/3d/humanoid-clothing";

vi.mock("@/components/3d/humanoid-clothing", () => ({
  createFittedClothing: vi.fn(() => new SkinnedMesh(undefined, new MeshStandardMaterial())),
}));

it("allocates clothing only when visible and disposes replaced materials", () => {
  const body = new SkinnedMesh();
  const create = vi.mocked(createFittedClothing);
  create.mockClear();
  const view = render(<CharacterWardrobe body={body} appearance={{ clothed: false }} />);
  expect(create).not.toHaveBeenCalled();

  view.rerender(<CharacterWardrobe body={body} appearance={{ clothed: true, outfit: 0 }} />);
  expect(create).toHaveBeenCalledTimes(1);
  const first = create.mock.results[0]!.value;
  const disposeFirst = vi.spyOn(first.material as MeshStandardMaterial, "dispose");

  view.rerender(<CharacterWardrobe body={body} appearance={{ clothed: true, outfit: 1 }} />);
  expect(create).toHaveBeenCalledTimes(2);
  expect(disposeFirst).toHaveBeenCalledTimes(1);
  const second = create.mock.results[1]!.value;
  const disposeSecond = vi.spyOn(second.material as MeshStandardMaterial, "dispose");

  view.rerender(<CharacterWardrobe body={body} appearance={{ clothed: false, outfit: 1 }} />);
  expect(create).toHaveBeenCalledTimes(2);
  expect(disposeSecond).toHaveBeenCalledTimes(1);
  view.unmount();
});

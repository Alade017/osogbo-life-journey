import { describe, expect, it, vi } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";

import { fitFurniture } from "@/components/3d/VenueFurniture";

function createSource() {
  const source = new Group();
  const mesh = new Mesh(new BoxGeometry(2, 4, 6), new MeshBasicMaterial());

  mesh.position.set(3, 4, 5);
  source.add(mesh);

  return { source, mesh };
}

describe("venue furniture fitting", () => {
  it("preserves model scaling and floor alignment", () => {
    const { source } = createSource();
    const fitted = fitFurniture(source, 4);

    expect(fitted.scale).toBe(2);
    expect(fitted.offset).toEqual([-6, -4, -10]);
  });

  it("reuses source bounds for different widths", () => {
    const { source } = createSource();
    const spy = vi.spyOn(Box3.prototype, "setFromObject");

    try {
      const first = fitFurniture(source, 2);
      const second = fitFurniture(source, 4);

      expect(first.scale).toBe(1);
      expect(second.scale).toBe(2);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("creates independent model hierarchies", () => {
    const { source } = createSource();

    const first = fitFurniture(source, 2);
    const second = fitFurniture(source, 2);

    expect(first.copy).not.toBe(second.copy);
    expect(first.copy).not.toBe(source);

    first.copy.position.x = 10;

    expect(second.copy.position.x).toBe(0);
    expect(source.position.x).toBe(0);
  });

  it("preserves shared geometry and materials", () => {
    const { source, mesh } = createSource();
    const fitted = fitFurniture(source, 2);
    const copiedMesh = fitted.copy.children[0] as Mesh;

    expect(copiedMesh).not.toBe(mesh);
    expect(copiedMesh.geometry).toBe(mesh.geometry);
    expect(copiedMesh.material).toBe(mesh.material);
  });

  it("keeps bounds independent for different sources", () => {
    const first = createSource();
    const second = createSource();

    second.mesh.scale.x = 2;

    expect(fitFurniture(first.source, 4).scale).toBe(2);
    expect(fitFurniture(second.source, 4).scale).toBe(1);
  });
});

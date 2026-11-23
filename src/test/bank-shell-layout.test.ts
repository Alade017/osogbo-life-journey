import { expect, it } from "vitest";
import { Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial } from "three";
import { fitBankShell } from "@/components/3d/bank-shell-layout";

it("finds imported bank hotspots whose names contain material-split suffixes", () => {
  const shell = new Group();
  for (const [name, x] of [
    ["000-lobby-floor-tile/0", 0],
    ["025-teller-counter/0", -2],
    ["025-teller-counter/2", 2],
    ["033-waiting-chairs/1", 4],
  ] as const) {
    const mesh = new Mesh(
      new BoxGeometry(name.startsWith("000") ? 20 : 1, 1, 2),
      new MeshBasicMaterial(),
    );
    mesh.name = name;
    mesh.position.x = x;
    shell.add(mesh);
  }
  const fitted = fitBankShell(shell);
  fitted.holder.updateMatrixWorld(true);
  expect(fitted.hotspots.map((h) => h.place).sort()).toEqual(["seat", "teller"]);
  expect(fitted.hotspots.find((h) => h.place === "teller")?.size[0]).toBe(5);
  const bounds = new Box3().setFromObject(fitted.holder);
  expect(bounds.min.y).toBeCloseTo(0);
  expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(11.4 + 0.001);
  expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(6.9 + 0.001);
  expect(shell.parent).toBeNull();
});

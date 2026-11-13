import { describe, expect, it } from "vitest";
import { Box3, Mesh, SkinnedMesh } from "three";
import { createHumanoid, JOINTS } from "@/components/3d/humanoid-rig";

function triangles(mesh: SkinnedMesh): number {
  const index = mesh.geometry.getIndex();
  return index ? index.count / 3 : mesh.geometry.attributes["position"]!.count / 3;
}

describe("code-built humanoid", () => {
  it.each(["female", "male"] as const)("builds a %s body within the triangle budget", (variant) => {
    const rig = createHumanoid({ variant, skinColor: "#8a5a3b", hairColor: "#1b1410" });
    const total = rig.meshes.reduce((sum, mesh) => sum + triangles(mesh), 0);
    expect(rig.meshes).toHaveLength(7);
    expect(total).toBeLessThan(7000);
  });

  it("keeps the female body within the low triangle budget", () => {
    const rig = createHumanoid({ variant: "female", skinColor: "#8a5a3b", hairColor: null });
    expect(rig.meshes[0]!.geometry.attributes["position"]!.count / 3).toBeLessThan(5000);
  });

  it("stands about one body height tall with the head on top", () => {
    const rig = createHumanoid({ variant: "male", skinColor: "#8a5a3b", hairColor: null });
    const box = new Box3();
    for (const mesh of rig.meshes) {
      mesh.geometry.computeBoundingBox();
      box.union(mesh.geometry.boundingBox!);
    }
    expect(box.min.y).toBeGreaterThan(-0.02);
    expect(box.max.y).toBeGreaterThan(0.98);
    expect(box.max.y).toBeLessThan(1.1);
  });

  it("uses saved build indices to change body proportions without changing the rig", () => {
    const lean = createHumanoid({
      variant: "male",
      skinColor: "#8a5a3b",
      hairColor: null,
      build: 0,
    });
    const muscular = createHumanoid({
      variant: "male",
      skinColor: "#8a5a3b",
      hairColor: null,
      build: 3,
    });
    expect(lean.bones).toHaveLength(JOINTS.length);
    expect(muscular.bones).toHaveLength(JOINTS.length);
    lean.meshes[0]!.geometry.computeBoundingBox();
    muscular.meshes[0]!.geometry.computeBoundingBox();
    const leanWidth = lean.meshes[0]!.geometry.boundingBox!.max.x - lean.meshes[0]!.geometry.boundingBox!.min.x;
    const muscularWidth = muscular.meshes[0]!.geometry.boundingBox!.max.x - muscular.meshes[0]!.geometry.boundingBox!.min.x;
    expect(muscularWidth).toBeGreaterThan(leanWidth);
  });

  it("skins every vertex to a real joint and leaves bald characters without hair", () => {
    const rig = createHumanoid({ variant: "female", skinColor: "#5a3825", hairColor: null });
    expect(rig.meshes).toHaveLength(6);
    for (const mesh of rig.meshes) {
      const indices = mesh.geometry.attributes["skinIndex"]!;
      for (let i = 0; i < indices.count; i += 1) {
        expect(indices.getX(i)).toBeLessThan(JOINTS.length);
      }
      expect(mesh).toBeInstanceOf(Mesh);
    }
  });
});

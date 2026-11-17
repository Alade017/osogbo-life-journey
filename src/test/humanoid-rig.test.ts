import { describe, expect, it } from "vitest";
import { Box3, DataTexture, Mesh, MeshStandardMaterial, SkinnedMesh, Vector3 } from "three";
import { createHumanoid, JOINTS } from "@/components/3d/humanoid-rig";
import { BONE, poseFor } from "@/components/3d/humanoid-pose";

function triangles(mesh: SkinnedMesh): number {
  const index = mesh.geometry.getIndex();
  return index ? index.count / 3 : mesh.geometry.attributes["position"]!.count / 3;
}

describe("code-built humanoid", () => {
  it.each(["female", "male"] as const)("builds a %s body within the triangle budget", (variant) => {
    const rig = createHumanoid({ variant, skinColor: "#8a5a3b", hairColor: "#1b1410" });
    const total = rig.meshes.reduce((sum, mesh) => sum + triangles(mesh), 0);
    expect(rig.meshes).toHaveLength(7);
    expect(total).toBeLessThanOrEqual(8000);
  });

  it("keeps the female body within the low triangle budget", () => {
    const rig = createHumanoid({ variant: "female", skinColor: "#8a5a3b", hairColor: null });
    expect(rig.meshes[0]!.geometry.attributes["position"]!.count / 3).toBeLessThan(6500);
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
    const leanWidth =
      lean.meshes[0]!.geometry.boundingBox!.max.x - lean.meshes[0]!.geometry.boundingBox!.min.x;
    const muscularWidth =
      muscular.meshes[0]!.geometry.boundingBox!.max.x -
      muscular.meshes[0]!.geometry.boundingBox!.min.x;
    expect(muscularWidth).toBeGreaterThan(leanWidth);
  });

  it("animates a balanced walk with knee flexion and ankle compensation", () => {
    const pose = poseFor("Walk", 0);
    expect(pose.bones[BONE.lThigh]).toBeDefined();
    expect(pose.bones[BONE.rThigh]).toBeDefined();
    expect(pose.bones[BONE.lCalf]![0]).toBeGreaterThan(0);
    expect(pose.bones[BONE.rCalf]![0]).toBeGreaterThanOrEqual(0);
    expect(pose.bones[BONE.lFoot]).toBeDefined();
    expect(pose.bones[BONE.rFoot]).toBeDefined();
    expect(pose.bones[BONE.spine2]).toBeDefined();
  });

  it("keeps both feet articulated in the seated pose", () => {
    const pose = poseFor("Sit", 0);
    expect(pose.bones[BONE.lCalf]![0]).toBeCloseTo(1.45);
    expect(pose.bones[BONE.rCalf]![0]).toBeCloseTo(1.45);
    expect(pose.bones[BONE.lFoot]![0]).toBeCloseTo(-0.28);
    expect(pose.bones[BONE.rFoot]![0]).toBeCloseTo(-0.28);
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

describe("reference-inspired character surface", () => {
  it("uses adult head proportions and smooth skin", () => {
    const rig = createHumanoid({ variant: "male", skinColor: "#754c32", hairColor: "#171512" });
    const skin = rig.meshes[0]!;
    const positions = skin.geometry.getAttribute("position");
    const indices = skin.geometry.getAttribute("skinIndex");
    const weights = skin.geometry.getAttribute("skinWeight");
    const head = rig.bones.findIndex((bone) => bone.name === BONE.head);
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < positions.count; i++) {
      if (indices.getX(i) === head && weights.getX(i) === 1) {
        min = Math.min(min, positions.getY(i));
        max = Math.max(max, positions.getY(i));
      }
    }
    expect(max - min).toBeGreaterThan(0.12);
    expect(max - min).toBeLessThan(0.19);
    expect((skin.material as MeshStandardMaterial).flatShading).toBe(false);
  });
  it.each(["male", "female", "business"] as const)(
    "keeps valid blended skin weights on the %s body",
    (variant) => {
      const rig = createHumanoid({ variant, skinColor: "#754c32", hairColor: null });
      const geometry = rig.meshes[0]!.geometry;
      const weights = geometry.getAttribute("skinWeight");
      const indices = geometry.getAttribute("skinIndex");
      let blended = 0;
      for (let i = 0; i < weights.count; i++) {
        const values = [weights.getX(i), weights.getY(i), weights.getZ(i), weights.getW(i)];
        expect(values.reduce((a, b) => a + b)).toBeCloseTo(1);
        expect(values.every((w) => Number.isFinite(w) && w >= 0 && w <= 1)).toBe(true);
        if (values[1]! > 0 && values[1]! < 1) blended++;
        expect(indices.getX(i)).toBeLessThan(rig.bones.length);
        expect(indices.getY(i)).toBeLessThan(rig.bones.length);
      }
      expect(blended).toBeGreaterThan(0);
    },
  );
});

it("preserves curved vertex normals after combining the skinned body surfaces", () => {
  const rig = createHumanoid({ variant: "male", skinColor: "#754c32", hairColor: "#171512" });
  const body = rig.meshes[0]!;
  const normals = body.geometry.getAttribute("normal");
  let smoothTriangles = 0;
  for (let i = 0; i < normals.count; i += 3) {
    const a = new Vector3().fromBufferAttribute(normals, i);
    const b = new Vector3().fromBufferAttribute(normals, i + 1);
    expect(a.length()).toBeCloseTo(1);
    if (a.distanceTo(b) > 0.001) smoothTriangles++;
  }
  expect(smoothTriangles).toBeGreaterThan(normals.count / 6);
  const total = rig.meshes.reduce((sum, mesh) => sum + triangles(mesh), 0);
  expect(total).toBeGreaterThanOrEqual(6000);
  expect(total).toBeLessThanOrEqual(8000);
});

it("shares lightweight skin maps while preserving individually selected skin colours", () => {
  const dark = createHumanoid({ variant: "male", skinColor: "#754c32", hairColor: null });
  const light = createHumanoid({ variant: "female", skinColor: "#c28a5e", hairColor: null });
  const a = dark.meshes[0]!.material as MeshStandardMaterial;
  const b = light.meshes[0]!.material as MeshStandardMaterial;
  expect(a.map).not.toBeNull();
  expect(a.map).toBe(b.map);
  expect(a.roughnessMap).toBe(b.roughnessMap);
  if (!(a.map instanceof DataTexture)) throw new Error("Expected a shared skin data texture");
  expect(a.map.image.width).toBeLessThanOrEqual(256);
  expect(a.map.image.height).toBeLessThanOrEqual(256);
  expect(a.color.getHexString()).toBe("754c32");
  expect(b.color.getHexString()).toBe("c28a5e");
  expect(a.metalness).toBe(0);
});

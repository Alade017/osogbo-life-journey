import { Bone, CylinderGeometry, Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { boneNamed, limbTube, loft } from "@/components/3d/procedural-clothing";

describe("loft", () => {
  it("spans the rings it is given", () => {
    const geometry = loft([
      { y: 0, rx: 0.2, rz: 0.1 },
      { y: 1, rx: 0.1, rz: 0.1 },
    ]);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.y).toBeCloseTo(0);
    expect(geometry.boundingBox!.max.y).toBeCloseTo(1);
    expect(geometry.boundingBox!.max.x).toBeCloseTo(0.2);
  });

  it("offsets a ring's centre in depth", () => {
    const geometry = loft([{ y: 0, rx: 0.1, rz: 0.1, z: 0.5 }]);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox!.min.z).toBeCloseTo(0.4);
    expect(geometry.boundingBox!.max.z).toBeCloseTo(0.6);
  });
});

describe("limbTube", () => {
  it("runs from the joint toward the child and extends past the joint", () => {
    const child = new Vector3(0, -0.4, 0);
    const tube = limbTube(child, 0.1, 0.07, 0.04);
    expect((tube.geometry as CylinderGeometry).parameters.height).toBeCloseTo(0.44);
    expect(tube.position.y).toBeCloseTo(-0.18);
    const along = new Vector3(0, 1, 0).applyQuaternion(tube.quaternion);
    expect(along.y).toBeCloseTo(-1);
  });
});

describe("boneNamed", () => {
  it("finds a bone whether its name kept the space or became an underscore", () => {
    const rig = new Object3D();
    const pelvis = new Bone();
    pelvis.name = "Bip01_Pelvis";
    rig.add(pelvis);
    expect(boneNamed(rig, "Bip01 Pelvis")).toBe(pelvis);
    expect(boneNamed(rig, "Bip01 Missing")).toBeNull();
  });
});

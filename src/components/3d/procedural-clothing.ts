import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from "three";
import type { BodyVariant } from "./CharacterBody";

/**
 * Clothes built in code and hung on the rig's own bones, so they follow every clip. Each garment
 * is measured in the rig's rest-pose metres: the body's fit scale applies to everything under it.
 * Shapes are deliberately simple (lofted torso, tapered limb tubes, boxed shoes), so the clothes
 * read as clothes at the distance the town is seen from.
 */

export type Ring = { y: number; rx: number; rz: number; z?: number };

/** Builds a closed, lofted surface through horizontal rings (top to bottom or bottom to top). */
export function loft(rings: readonly Ring[], radial = 20): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (const ring of rings) {
    for (let i = 0; i <= radial; i++) {
      const a = (i / radial) * Math.PI * 2;
      positions.push(Math.cos(a) * ring.rx, ring.y, (ring.z ?? 0) + Math.sin(a) * ring.rz);
    }
  }
  const stride = radial + 1;
  for (let j = 0; j < rings.length - 1; j++) {
    for (let i = 0; i < radial; i++) {
      const a = j * stride + i;
      const b = a + stride;
      const c = b + 1;
      const d = a + 1;
      indices.push(a, b, d, d, b, c);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Turns a geometry drawn in upright rig space into the bone's own frame. Bones are not always
 * upright at rest, so the bone's rest rotation is undone in the vertices, and the mesh then sits
 * untransformed under the bone and appears upright at rest.
 */
export function uprightFor(
  geometry: BufferGeometry,
  bone: Object3D,
  rig: Object3D,
): BufferGeometry {
  rig.updateMatrixWorld(true);
  const boneRot = bone.getWorldQuaternion(new Quaternion());
  const rigRot = rig.getWorldQuaternion(new Quaternion());
  const local = rigRot.clone().invert().multiply(boneRot);
  geometry.applyQuaternion(local.invert());
  return geometry;
}

/** A tapered open tube from a bone's origin to its child joint, extended a little past the origin. */
export function limbTube(
  child: Vector3,
  radiusAtJoint: number,
  radiusAtChild: number,
  extend = 0,
): { geometry: BufferGeometry; position: Vector3; quaternion: Quaternion } {
  const length = child.length();
  const dir = child.clone().normalize();
  const start = dir.clone().multiplyScalar(-extend);
  const end = child.clone();
  const mid = start.clone().add(end).multiplyScalar(0.5);
  const total = length + extend;
  const geometry = new CylinderGeometry(radiusAtChild, radiusAtJoint, total, 18, 1, true);
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
  return { geometry, position: mid, quaternion };
}

type Proportions = {
  /** Hip ring (y relative to the pelvis bone), half-width and half-depth. */
  hip: Ring;
  waist: Ring;
  chest: Ring;
  shoulder: Ring;
  neck: Ring;
  thigh: number;
  knee: number;
  ankle: number;
  upperArm: number;
  elbow: number;
};

const PROPORTIONS: Record<BodyVariant, Proportions> = {
  male: {
    hip: { y: -0.05, rx: 0.165, rz: 0.105 },
    waist: { y: 0.2, rx: 0.15, rz: 0.1 },
    chest: { y: 0.36, rx: 0.175, rz: 0.12 },
    shoulder: { y: 0.52, rx: 0.19, rz: 0.115 },
    neck: { y: 0.56, rx: 0.075, rz: 0.075 },
    thigh: 0.1,
    knee: 0.07,
    ankle: 0.05,
    upperArm: 0.055,
    elbow: 0.045,
  },
  business: {
    hip: { y: -0.05, rx: 0.165, rz: 0.105 },
    waist: { y: 0.2, rx: 0.15, rz: 0.1 },
    chest: { y: 0.36, rx: 0.175, rz: 0.12 },
    shoulder: { y: 0.52, rx: 0.19, rz: 0.115 },
    neck: { y: 0.56, rx: 0.075, rz: 0.075 },
    thigh: 0.1,
    knee: 0.07,
    ankle: 0.05,
    upperArm: 0.055,
    elbow: 0.045,
  },
  female: {
    hip: { y: -0.05, rx: 0.17, rz: 0.115 },
    waist: { y: 0.2, rx: 0.12, rz: 0.085 },
    chest: { y: 0.36, rx: 0.15, rz: 0.12 },
    shoulder: { y: 0.5, rx: 0.165, rz: 0.1 },
    neck: { y: 0.56, rx: 0.065, rz: 0.065 },
    thigh: 0.095,
    knee: 0.065,
    ankle: 0.046,
    upperArm: 0.05,
    elbow: 0.042,
  },
};

/** Garment colours and cuts for each body. Business staff wear a shirt and trousers. */
export type OutfitStyle = {
  top: { color: string; sleeves: "short" | "long" };
  trousers: { color: string };
  shoes: { color: string };
};

export const OUTFITS: Record<BodyVariant, OutfitStyle> = {
  male: {
    top: { color: "#2f5d8a", sleeves: "short" },
    trousers: { color: "#2d4a6b" },
    shoes: { color: "#f2efe8" },
  },
  female: {
    top: { color: "#c25a7c", sleeves: "long" },
    trousers: { color: "#3b5673" },
    shoes: { color: "#3b2f2a" },
  },
  business: {
    top: { color: "#e9e6df", sleeves: "long" },
    trousers: { color: "#3b3f47" },
    shoes: { color: "#1f1a17" },
  },
};

function material(color: string): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, side: DoubleSide });
}

/** Clothing sits just outside the skin so it does not z-fight with the body. */
/** Torso clothing sits this far off the skin; the baked-in clothes need the extra room. */
const SKIN_GAP = 0.035;
/** Limb clothing sits closer, so sleeves and trouser legs keep the body's own proportions. */
const LIMB_GAP = 0.015;

/** Finds a bone by its authored name. three.js writes spaces as underscores when it loads a GLB. */
export function boneNamed(rig: Object3D, name: string): Object3D | null {
  return rig.getObjectByName(name) ?? rig.getObjectByName(name.replace(/ /g, "_")) ?? null;
}

function addTube(
  parent: Object3D,
  child: Object3D,
  radiusAtJoint: number,
  radiusAtChild: number,
  color: string,
  extend = 0,
): void {
  const tube = limbTube(child.position, radiusAtJoint, radiusAtChild, extend);
  const mesh = new Mesh(tube.geometry, material(color));
  mesh.position.copy(tube.position);
  mesh.quaternion.copy(tube.quaternion);
  mesh.castShadow = true;
  parent.add(mesh);
}

/**
 * Hangs the outfit for a body on the rig. Each piece is a child of the bone it follows. Missing
 * bones are skipped rather than failing, so a partial rig still renders.
 */
export function dressRig(rig: Object3D, variant: BodyVariant): void {
  const outfit = OUTFITS[variant];
  const p = PROPORTIONS[variant];
  const pelvis = boneNamed(rig, "Bip01 Pelvis");

  if (pelvis) {
    const torso = uprightFor(
      loft(
        [p.hip, p.waist, p.chest, p.shoulder, p.neck].map((ring) => ({
          ...ring,
          rx: ring.rx + SKIN_GAP,
          rz: ring.rz + SKIN_GAP,
        })),
      ),
      pelvis,
      rig,
    );
    const torsoMesh = new Mesh(torso, material(outfit.top.color));
    torsoMesh.name = "top";
    pelvis.add(torsoMesh);

    const hipBand = uprightFor(
      loft([
        { y: -0.1, rx: p.hip.rx + SKIN_GAP, rz: p.hip.rz + SKIN_GAP },
        { y: -0.02, rx: p.hip.rx + SKIN_GAP, rz: p.hip.rz + SKIN_GAP },
      ]),
      pelvis,
      rig,
    );
    const bandMesh = new Mesh(hipBand, material(outfit.trousers.color));
    bandMesh.name = "trousers-hip";
    pelvis.add(bandMesh);
  }

  for (const side of ["L", "R"]) {
    const thigh = boneNamed(rig, `Bip01 ${side} Thigh`);
    const calf = boneNamed(rig, `Bip01 ${side} Calf`);
    const foot = boneNamed(rig, `Bip01 ${side} Foot`);
    const upperArm = boneNamed(rig, `Bip01 ${side} UpperArm`);
    const forearm = boneNamed(rig, `Bip01 ${side} Forearm`);

    if (thigh && calf) {
      addTube(thigh, calf, p.thigh + LIMB_GAP, p.knee + LIMB_GAP, outfit.trousers.color, 0.04);
      if (foot) {
        addTube(calf, foot, p.knee + LIMB_GAP, p.ankle + LIMB_GAP, outfit.trousers.color);
      }
    }
    if (foot) {
      // Drawn under the ankle and pointing forward, then turned into the foot bone's frame.
      const shoeGeometry = new BoxGeometry(0.1, 0.08, 0.26);
      shoeGeometry.translate(0, -0.06, 0.06);
      const shoe = new Mesh(uprightFor(shoeGeometry, foot, rig), material(outfit.shoes.color));
      shoe.name = `shoe-${side}`;
      shoe.castShadow = true;
      foot.add(shoe);
    }
    if (upperArm && forearm) {
      if (outfit.top.sleeves === "long") {
        addTube(upperArm, forearm, p.upperArm + LIMB_GAP, p.elbow + LIMB_GAP, outfit.top.color);
      } else {
        // Short sleeves cover the top part of the upper arm only.
        const sleeve = forearm.position.clone().multiplyScalar(0.45);
        const tube = limbTube(sleeve, p.upperArm + LIMB_GAP, p.upperArm + LIMB_GAP);
        const mesh = new Mesh(tube.geometry, material(outfit.top.color));
        mesh.position.copy(tube.position);
        mesh.quaternion.copy(tube.quaternion);
        upperArm.add(mesh);
      }
    }
  }
}

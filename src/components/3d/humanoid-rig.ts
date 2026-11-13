import {
  Bone,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BONE, ROOT_REST_Y, type BoneName } from "./humanoid-pose";

export type BodyVariant = "female" | "male" | "business";

type Joint = { name: BoneName; parent: BoneName | null; offset: [number, number, number] };

/** Bones in skeleton order. Offsets are relative to the parent, so the rest pose stands 1.0 tall. */
export const JOINTS: readonly Joint[] = [
  { name: BONE.root, parent: null, offset: [0, ROOT_REST_Y, 0] },
  { name: BONE.spine, parent: BONE.root, offset: [0, 0.04, 0] },
  { name: BONE.spine1, parent: BONE.spine, offset: [0, 0.08, 0] },
  { name: BONE.spine2, parent: BONE.spine1, offset: [0, 0.08, 0] },
  { name: BONE.neck, parent: BONE.spine2, offset: [0, 0.1, 0] },
  { name: BONE.head, parent: BONE.neck, offset: [0, 0.04, 0] },
  { name: BONE.lUpperArm, parent: BONE.spine2, offset: [0.19, 0.08, 0] },
  { name: BONE.lForearm, parent: BONE.lUpperArm, offset: [0, -0.17, 0] },
  { name: BONE.lHand, parent: BONE.lForearm, offset: [0, -0.15, 0] },
  { name: BONE.rUpperArm, parent: BONE.spine2, offset: [-0.19, 0.08, 0] },
  { name: BONE.rForearm, parent: BONE.rUpperArm, offset: [0, -0.17, 0] },
  { name: BONE.rHand, parent: BONE.rForearm, offset: [0, -0.15, 0] },
  { name: BONE.lThigh, parent: BONE.root, offset: [0.09, -0.02, 0] },
  { name: BONE.lCalf, parent: BONE.lThigh, offset: [0, -0.23, 0] },
  { name: BONE.lFoot, parent: BONE.lCalf, offset: [0, -0.2, 0] },
  { name: BONE.rThigh, parent: BONE.root, offset: [-0.09, -0.02, 0] },
  { name: BONE.rCalf, parent: BONE.rThigh, offset: [0, -0.23, 0] },
  { name: BONE.rFoot, parent: BONE.rCalf, offset: [0, -0.2, 0] },
];

type Part = { geometry: BufferGeometry; bone: BoneName };

function skinTo(geometry: BufferGeometry, boneIndex: number): BufferGeometry {
  const count = geometry.attributes["position"]!.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    indices[i * 4] = boneIndex;
    weights[i * 4] = 1;
  }
  geometry.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
  geometry.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  return geometry;
}

function cylinder(
  top: number,
  bottom: number,
  height: number,
  at: [number, number, number],
  bone: BoneName,
  scale: [number, number, number] = [1, 1, 1],
  radial = 8,
): Part {
  const geometry = new CylinderGeometry(top, bottom, height, radial, 1);
  geometry.scale(...scale);
  geometry.translate(...at);
  return { geometry, bone };
}

function sphere(
  radius: number,
  at: [number, number, number],
  bone: BoneName,
  scale: [number, number, number] = [1, 1, 1],
): Part {
  const geometry = new SphereGeometry(radius, 8, 6);
  geometry.scale(...scale);
  geometry.translate(...at);
  return { geometry, bone };
}

function bodyParts(variant: BodyVariant): Part[] {
  const w = variant === "female" ? 0.9 : 1;
  const hip = variant === "female" ? 1.08 : 1;
  const parts: Part[] = [
    cylinder(0.13, 0.12, 0.16, [0, 0.46, 0], BONE.root, [hip, 1, hip], 10),
    cylinder(0.115, 0.125, 0.14, [0, 0.6, 0], BONE.spine1, [w, 1, w], 10),
    cylinder(0.14, 0.115, 0.2, [0, 0.74, 0], BONE.spine2, [w, 1, w], 10),
    cylinder(0.05, 0.055, 0.1, [0, 0.84, 0], BONE.neck),
    sphere(0.09, [0, 0.91, 0], BONE.head, [1, 1.15, 1]),
  ];
  for (const side of [1, -1] as const) {
    const upper = side === 1 ? BONE.lUpperArm : BONE.rUpperArm;
    const fore = side === 1 ? BONE.lForearm : BONE.rForearm;
    const hand = side === 1 ? BONE.lHand : BONE.rHand;
    const thigh = side === 1 ? BONE.lThigh : BONE.rThigh;
    const calf = side === 1 ? BONE.lCalf : BONE.rCalf;
    const foot = side === 1 ? BONE.lFoot : BONE.rFoot;
    const ax = 0.19 * side;
    const lx = 0.09 * side;
    parts.push(
      sphere(0.07, [ax, 0.78, 0], upper),
      cylinder(0.05, 0.042, 0.17, [ax, 0.695, 0], upper),
      sphere(0.042, [ax, 0.61, 0], upper),
      cylinder(0.04, 0.034, 0.15, [ax, 0.535, 0], fore),
      sphere(0.045, [ax, 0.39, 0], hand, [0.8, 1.5, 0.5]),
      cylinder(0.078, 0.058, 0.23, [lx, 0.365, 0], thigh),
      sphere(0.056, [lx, 0.25, 0], calf),
      cylinder(0.056, 0.04, 0.22, [lx, 0.14, 0], calf),
      sphere(0.04, [lx, 0.05, 0], foot),
      sphere(0.06, [lx, 0.04, -0.04], foot, [0.8, 0.6, 1.7]),
    );
  }
  return parts;
}

const geometryCache = new Map<BodyVariant, { body: BufferGeometry; hair: BufferGeometry }>();

/** Geometry is shared per body shape; only the material colours differ between characters. */
function geometriesFor(variant: BodyVariant) {
  const cached = geometryCache.get(variant);
  if (cached) return cached;
  const indexOf = new Map(JOINTS.map((joint, index) => [joint.name, index]));
  const body = mergeGeometries(
    bodyParts(variant).map((part) => skinTo(part.geometry, indexOf.get(part.bone) ?? 0)),
    false,
  );
  const hairPart = sphere(0.1, [0, 0.94, -0.005], BONE.head, [1, 0.7, 1]);
  const hair = skinTo(hairPart.geometry, indexOf.get(BONE.head) ?? 0);
  if (!body) throw new Error("Body geometry could not be merged");
  const built = { body, hair };
  geometryCache.set(variant, built);
  return built;
}

export type Humanoid = {
  root: Bone;
  bones: Bone[];
  byName: Map<string, Bone>;
  meshes: SkinnedMesh[];
};

/** Builds the skeleton and skinned body. Hair is optional, so bald characters get no hair mesh. */
export function createHumanoid({
  variant,
  skinColor,
  hairColor,
}: {
  variant: BodyVariant;
  skinColor: string;
  hairColor: string | null;
}): Humanoid {
  const byName = new Map<string, Bone>();
  const bones: Bone[] = [];
  for (const joint of JOINTS) {
    const bone = new Bone();
    bone.name = joint.name;
    bone.position.set(...joint.offset);
    if (joint.parent) byName.get(joint.parent)!.add(bone);
    byName.set(joint.name, bone);
    bones.push(bone);
  }
  const root = byName.get(BONE.root)!;
  root.updateMatrixWorld(true);
  const skeleton = new Skeleton(bones);
  const geometries = geometriesFor(variant);

  const body = new SkinnedMesh(
    geometries.body,
    new MeshStandardMaterial({ color: skinColor, roughness: 0.82, flatShading: true }),
  );
  body.castShadow = true;
  body.bind(skeleton);
  const meshes = [body];
  if (hairColor) {
    const hair = new SkinnedMesh(
      geometries.hair,
      new MeshStandardMaterial({ color: hairColor, roughness: 0.9, flatShading: true }),
    );
    hair.castShadow = true;
    hair.bind(skeleton);
    meshes.push(hair);
  }
  return { root, bones, byName, meshes };
}

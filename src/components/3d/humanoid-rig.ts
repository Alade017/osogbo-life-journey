import {
  Bone,
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  IcosahedronGeometry,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
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
  // Parts mix indexed and unindexed geometry, so every part is unindexed before merging.
  if (geometry.index) geometry = geometry.toNonIndexed();
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

/**
 * A faceted ellipsoid. Detail 1 gives a rounder silhouette for the torso and head, detail 0 is
 * used for hands, feet and joints so the overall count stays low.
 */
function blob(
  radii: [number, number, number],
  at: [number, number, number],
  bone: BoneName,
  detail: 0 | 1 = 1,
): Part {
  const geometry = new IcosahedronGeometry(1, detail);
  geometry.scale(...radii);
  geometry.translate(...at);
  return { geometry, bone };
}

/** Each side of the body, mirrored: side 1 is the left limb, -1 the right. */
function limbParts(side: 1 | -1, w: number): Part[] {
  const upper = side === 1 ? BONE.lUpperArm : BONE.rUpperArm;
  const fore = side === 1 ? BONE.lForearm : BONE.rForearm;
  const hand = side === 1 ? BONE.lHand : BONE.rHand;
  const thigh = side === 1 ? BONE.lThigh : BONE.rThigh;
  const calf = side === 1 ? BONE.lCalf : BONE.rCalf;
  const foot = side === 1 ? BONE.lFoot : BONE.rFoot;
  const ax = 0.19 * side * w;
  const lx = 0.09 * side;
  return [
    // Shoulder cap and arm, tapering from deltoid to wrist.
    blob([0.062, 0.068, 0.062], [ax, 0.79, 0], upper),
    cylinder(0.05, 0.041, 0.17, [ax, 0.695, 0], upper),
    blob([0.042, 0.042, 0.042], [ax, 0.607, 0], upper, 0),
    cylinder(0.041, 0.031, 0.16, [ax, 0.53, 0], fore),
    blob([0.034, 0.034, 0.034], [ax, 0.45, 0], fore, 0),
    // Hand: a flat palm with a thumb bump on the outside.
    blob([0.04, 0.078, 0.024], [ax, 0.38, 0], hand),
    blob([0.02, 0.03, 0.02], [ax - 0.03 * side, 0.4, 0.01], hand, 0),
    // Leg: a full thigh, a calf bulge at the back, a slimmer shin and a foot.
    cylinder(0.086, 0.061, 0.23, [lx, 0.365, 0], thigh),
    blob([0.055, 0.055, 0.055], [lx, 0.25, 0], calf, 0),
    blob([0.06, 0.11, 0.058], [lx, 0.16, -0.012], calf),
    cylinder(0.056, 0.04, 0.2, [lx, 0.14, 0], calf),
    blob([0.04, 0.04, 0.04], [lx, 0.04, 0], foot, 0),
    blob([0.05, 0.034, 0.1], [lx, 0.03, 0.03], foot),
  ];
}

function bodyParts(variant: BodyVariant): Part[] {
  const female = variant === "female";
  const w = female ? 0.9 : 1;
  const hip = female ? 1.1 : 1;
  const parts: Part[] = [
    // Pelvis and hips, then a tapered waist, a chest and a shoulder bar.
    blob([0.13 * hip, 0.1, 0.09 * hip], [0, 0.45, 0], BONE.root),
    blob([0.11 * w, 0.11, 0.085 * w], [0, 0.6, 0], BONE.spine1),
    blob([0.16 * w, 0.13, 0.11 * w], [0, 0.74, 0], BONE.spine2),
    blob([0.19 * w, 0.05, 0.095], [0, 0.83, 0], BONE.spine2, 0),
    // Neck and head: a slightly longer jaw, ears on each side.
    cylinder(0.05, 0.056, 0.1, [0, 0.865, 0], BONE.neck),
    blob([0.085, 0.108, 0.095], [0, 0.945, 0], BONE.head),
    blob([0.07, 0.055, 0.07], [0, 0.885, 0.012], BONE.head),
    blob([0.02, 0.03, 0.016], [0.086, 0.935, 0], BONE.head, 0),
    blob([0.02, 0.03, 0.016], [-0.086, 0.935, 0], BONE.head, 0),
  ];
  parts.push(...limbParts(1, w), ...limbParts(-1, w));
  return parts;
}

/** Facial features sit on the head bone in a separate mesh, so they can take dark materials. */
function featureParts(): Part[] {
  return [
    blob([0.012, 0.011, 0.01], [0.032, 0.948, 0.083], BONE.head, 0),
    blob([0.012, 0.011, 0.01], [-0.032, 0.948, 0.083], BONE.head, 0),
    blob([0.03, 0.007, 0.01], [0.032, 0.97, 0.08], BONE.head, 0),
    blob([0.03, 0.007, 0.01], [-0.032, 0.97, 0.08], BONE.head, 0),
    blob([0.02, 0.03, 0.022], [0, 0.92, 0.095], BONE.head, 0),
    blob([0.03, 0.01, 0.012], [0, 0.893, 0.088], BONE.head, 0),
  ];
}

function hairParts(): Part[] {
  return [blob([0.095, 0.072, 0.105], [0, 0.968, -0.01], BONE.head)];
}

const geometryCache = new Map<BodyVariant, { body: BufferGeometry; hair: BufferGeometry }>();

function mergeSkinned(parts: readonly Part[], indexOf: Map<BoneName, number>): BufferGeometry {
  const merged = mergeGeometries(
    parts.map((part) => skinTo(part.geometry, indexOf.get(part.bone) ?? 0)),
    false,
  );
  if (!merged) throw new Error("Humanoid geometry could not be merged");
  return merged;
}

/** Geometry is shared per body shape; only the material colours differ between characters. */
function geometriesFor(variant: BodyVariant) {
  const cached = geometryCache.get(variant);
  if (cached) return cached;
  const indexOf = new Map(JOINTS.map((joint, index) => [joint.name, index]));
  // Skin is material 0 and facial features are material 1, so the body stays one mesh.
  const skin = mergeSkinned(bodyParts(variant), indexOf);
  const features = mergeSkinned(featureParts(), indexOf);
  const built = {
    body: mergeGeometries([skin, features], true) ?? skin,
    hair: mergeSkinned(hairParts(), indexOf),
  };
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

  const body = new SkinnedMesh(geometries.body, [
    new MeshStandardMaterial({ color: skinColor, roughness: 0.78, flatShading: true }),
    new MeshStandardMaterial({ color: "#1d1410", roughness: 0.6, flatShading: true }),
  ]);
  body.castShadow = true;
  body.bind(skeleton);
  const meshes: SkinnedMesh[] = [body];
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

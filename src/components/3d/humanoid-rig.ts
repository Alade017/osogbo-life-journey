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
import type { HairShape } from "./hair-shapes";

export type BodyVariant = "female" | "male" | "business";

/** Dark accessory colour for the face features, blindfold and wrist and ankle bands. */
export const ACCESSORY_COLOR = "#1d1410";

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

type Part = { geometry: BufferGeometry; bone: BoneName; accessory: boolean };

function skinTo(geometry: BufferGeometry, boneIndex: number): BufferGeometry {
  // Parts mix indexed and unindexed geometry, so every part is unindexed before merging.
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  const count = flat.attributes["position"]!.count;
  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);
  for (let i = 0; i < count; i += 1) {
    indices[i * 4] = boneIndex;
    weights[i * 4] = 1;
  }
  flat.setAttribute("skinIndex", new Uint16BufferAttribute(indices, 4));
  flat.setAttribute("skinWeight", new Float32BufferAttribute(weights, 4));
  return flat;
}

function cylinder(
  top: number,
  bottom: number,
  height: number,
  at: [number, number, number],
  bone: BoneName,
  options: { radial?: number; scale?: [number, number, number]; accessory?: boolean } = {},
): Part {
  const geometry = new CylinderGeometry(top, bottom, height, options.radial ?? 8, 1);
  if (options.scale) geometry.scale(...options.scale);
  geometry.translate(...at);
  return { geometry, bone, accessory: options.accessory ?? false };
}

/**
 * A faceted ellipsoid. Detail 0 is the blocky action-figure look; detail 1 is reserved for the
 * chest and head, where a rounder silhouette reads better.
 */
function blob(
  radii: [number, number, number],
  at: [number, number, number],
  bone: BoneName,
  options: { detail?: 0 | 1; accessory?: boolean } = {},
): Part {
  const geometry = new IcosahedronGeometry(1, options.detail ?? 0);
  geometry.scale(...radii);
  geometry.translate(...at);
  return { geometry, bone, accessory: options.accessory ?? false };
}

/**
 * Limbs are separate pieces with a joint sphere at each end, so the elbows, knees and wrists read
 * as physical gaps rather than smooth bends. Side 1 is the left limb, -1 the right.
 */
function limbParts(side: 1 | -1, shoulder: number): Part[] {
  const upper = side === 1 ? BONE.lUpperArm : BONE.rUpperArm;
  const fore = side === 1 ? BONE.lForearm : BONE.rForearm;
  const hand = side === 1 ? BONE.lHand : BONE.rHand;
  const thigh = side === 1 ? BONE.lThigh : BONE.rThigh;
  const calf = side === 1 ? BONE.lCalf : BONE.rCalf;
  const foot = side === 1 ? BONE.lFoot : BONE.rFoot;
  const ax = 0.2 * side * shoulder;
  const lx = 0.1 * side;
  return [
    // Shoulder joint, then a bulging upper arm (biceps and triceps) with a gap above the elbow.
    blob([0.07, 0.07, 0.07], [ax, 0.79, 0], upper),
    blob([0.08, 0.13, 0.08], [ax, 0.66, 0], upper),
    blob([0.045, 0.045, 0.045], [ax, 0.545, 0], upper),
    // Forearm is a thinner piece that starts below the elbow gap, then the wrist and hand.
    cylinder(0.05, 0.036, 0.15, [ax, 0.45, 0], fore, { radial: 6 }),
    cylinder(0.05, 0.05, 0.02, [ax, 0.36, 0], fore, { radial: 6, accessory: true }),
    blob([0.045, 0.07, 0.03], [ax, 0.3, 0], hand),
    // Leg: a bulging thigh, a knee joint, a calf and an ankle band above a rounded foot.
    blob([0.1, 0.2, 0.1], [lx, 0.33, 0], thigh),
    blob([0.055, 0.055, 0.055], [lx, 0.17, 0], calf),
    blob([0.07, 0.12, 0.065], [lx, 0.12, -0.01], calf),
    cylinder(0.055, 0.045, 0.02, [lx, 0.03, 0], calf, { radial: 6, accessory: true }),
    blob([0.055, 0.04, 0.095], [lx, 0.02, 0.03], foot),
  ];
}

function bodyParts(variant: BodyVariant): Part[] {
  const female = variant === "female";
  const shoulder = female ? 0.9 : 1;
  const hip = female ? 1.15 : 1;
  const parts: Part[] = [
    // V-shaped chest with a bulging upper back, very wide shoulders, a narrow waist and a small
    // round pelvis joint that makes the segmented action-figure waist.
    blob([0.2 * shoulder, 0.07, 0.12], [0, 0.85, 0], BONE.spine2),
    blob([0.19 * shoulder, 0.13, 0.13], [0, 0.76, 0], BONE.spine2, { detail: 1 }),
    blob([0.08, 0.09, 0.07], [0, 0.6, 0], BONE.spine1),
    blob([0.085 * hip, 0.075, 0.075], [0, 0.49, 0], BONE.root),
    // Neck, then a blocky head with a flat shelf for the brow and a broad jaw.
    cylinder(0.05, 0.056, 0.1, [0, 0.865, 0], BONE.neck, { radial: 6 }),
    blob([0.085, 0.105, 0.09], [0, 0.945, 0], BONE.head, { detail: 1 }),
    blob([0.07, 0.05, 0.07], [0, 0.885, 0.01], BONE.head),
  ];
  parts.push(...limbParts(1, shoulder), ...limbParts(-1, shoulder));
  return parts;
}

/** Face, blindfold and bands. These take the dark accessory material. */
function accessoryParts(): Part[] {
  return [
    // Blindfold: a squashed dark ring across the upper face that covers the eyes.
    cylinder(0.1, 0.1, 0.035, [0, 0.955, 0.0], BONE.head, {
      radial: 10,
      scale: [1, 1, 0.92],
      accessory: true,
    }),
    // Flat, protruding brow, a simplified nose and prominent lips.
    blob([0.085, 0.012, 0.03], [0, 0.972, 0.09], BONE.head, { accessory: true }),
    blob([0.02, 0.03, 0.022], [0, 0.915, 0.1], BONE.head, { accessory: true }),
    blob([0.04, 0.012, 0.018], [0, 0.885, 0.1], BONE.head, { accessory: true }),
  ];
}

function hairParts(shape: HairShape): Part[] {
  if (shape === "afro")
    return [blob([0.115, 0.1, 0.115], [0, 0.99, -0.01], BONE.head, { detail: 1 })];
  return [blob([0.095, 0.072, 0.105], [0, 0.968, -0.01], BONE.head)];
}

const geometryCache = new Map<string, { body: BufferGeometry; hair: BufferGeometry }>();

function mergeSkinned(parts: readonly Part[], indexOf: Map<BoneName, number>): BufferGeometry {
  const merged = mergeGeometries(
    parts.map((part) => skinTo(part.geometry, indexOf.get(part.bone) ?? 0)),
    false,
  );
  if (!merged) throw new Error("Humanoid geometry could not be merged");
  return merged;
}

/** Geometry is shared per body shape and hair shape; only the material colours differ. */
function geometriesFor(variant: BodyVariant, hairShape: HairShape) {
  const key = `${variant}:${hairShape}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const indexOf = new Map(JOINTS.map((joint, index) => [joint.name, index]));
  const body = bodyParts(variant);
  const accessories = accessoryParts();
  // Skin is material 0 and accessories are material 1, so the body stays one mesh.
  const skin = mergeSkinned(
    body.filter((part) => !part.accessory),
    indexOf,
  );
  const dark = mergeSkinned([...body.filter((part) => part.accessory), ...accessories], indexOf);
  const built = {
    body: mergeGeometries([skin, dark], true) ?? skin,
    hair: mergeSkinned(hairParts(hairShape), indexOf),
  };
  geometryCache.set(key, built);
  return built;
}

export type Humanoid = {
  root: Bone;
  bones: Bone[];
  byName: Map<string, Bone>;
  meshes: SkinnedMesh[];
};

/**
 * Builds the skeleton and skinned body. A bald character has no hair mesh; the hair shape is
 * chosen by the caller from the saved hair style.
 */
export function createHumanoid({
  variant,
  skinColor,
  hairColor,
  hairShape = "cap",
}: {
  variant: BodyVariant;
  skinColor: string;
  hairColor: string | null;
  hairShape?: HairShape;
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
  const geometries = geometriesFor(variant, hairShape);

  const body = new SkinnedMesh(geometries.body, [
    new MeshStandardMaterial({ color: skinColor, roughness: 0.78, flatShading: true }),
    new MeshStandardMaterial({ color: ACCESSORY_COLOR, roughness: 0.6, flatShading: true }),
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

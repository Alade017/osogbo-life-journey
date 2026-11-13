import {
  Bone,
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Uint16BufferAttribute,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BONE, ROOT_REST_Y, type BoneName } from "./humanoid-pose";
import type { HairShape } from "./hair-shapes";

export type BodyVariant = "female" | "male" | "business";
export const ACCESSORY_COLOR = "#241914";

type Joint = { name: BoneName; parent: BoneName | null; offset: [number, number, number] };
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
  const flat = geometry.index ? geometry.toNonIndexed() : geometry.clone();
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

/** Smooth UV spheres replace the old faceted icosahedra; detail is concentrated around the face and torso. */
function blob(
  radii: [number, number, number],
  at: [number, number, number],
  bone: BoneName,
  options: { detail?: 0 | 1; accessory?: boolean } = {},
): Part {
  const geometry = new SphereGeometry(1, options.detail ? 12 : 8, options.detail ? 8 : 6);
  geometry.scale(...radii);
  geometry.translate(...at);
  return { geometry, bone, accessory: options.accessory ?? false };
}

const SHAPES: Record<BodyVariant, { shoulder: number; waist: number; hip: number; bust: number }> = {
  male: { shoulder: 1, waist: 1, hip: 1, bust: 0 },
  business: { shoulder: 1, waist: 1, hip: 1, bust: 0 },
  female: { shoulder: 0.88, waist: 0.82, hip: 1.18, bust: 1 },
};

/** Overlapping smooth volumes create continuous-looking muscle transitions at game scale. */
function limbParts(side: 1 | -1, shape: { shoulder: number; hip: number }): Part[] {
  const upper = side === 1 ? BONE.lUpperArm : BONE.rUpperArm;
  const fore = side === 1 ? BONE.lForearm : BONE.rForearm;
  const hand = side === 1 ? BONE.lHand : BONE.rHand;
  const thigh = side === 1 ? BONE.lThigh : BONE.rThigh;
  const calf = side === 1 ? BONE.lCalf : BONE.rCalf;
  const foot = side === 1 ? BONE.lFoot : BONE.rFoot;
  const ax = 0.19 * side * shape.shoulder;
  const lx = 0.1 * side * shape.hip;
  const thighWidth = 0.095 * shape.hip;
  return [
    blob([0.082, 0.09, 0.085], [ax, 0.79, 0], upper, { detail: 1 }),
    blob([0.071, 0.13, 0.071], [ax, 0.66, 0], upper, { detail: 1 }),
    blob([0.048, 0.052, 0.048], [ax, 0.545, 0], fore),
    blob([0.047, 0.105, 0.047], [ax, 0.46, 0], fore, { detail: 1 }),
    blob([0.039, 0.045, 0.036], [ax, 0.36, 0], hand),
    blob([0.045, 0.055, 0.04], [ax, 0.3, 0], hand),
    blob([thighWidth, 0.19, thighWidth * 0.9], [lx, 0.33, 0], thigh, { detail: 1 }),
    blob([0.058, 0.065, 0.056], [lx, 0.17, 0], calf),
    blob([0.064, 0.12, 0.06], [lx, 0.12, -0.01], calf, { detail: 1 }),
    blob([0.052, 0.038, 0.09], [lx, 0.02, 0.03], foot),
  ];
}

function bodyParts(variant: BodyVariant): Part[] {
  const shape = SHAPES[variant];
  const { shoulder, waist, hip, bust } = shape;
  const parts: Part[] = [
    // Rib cage, tapered abdomen and pelvis overlap to avoid the old segmented mannequin silhouette.
    blob([0.205 * shoulder, 0.105, 0.125], [0, 0.82, 0], BONE.spine2, { detail: 1 }),
    blob([0.178 * shoulder, 0.105, 0.118], [0, 0.745, 0], BONE.spine2, { detail: 1 }),
    blob([0.105 * waist, 0.12, 0.085], [0, 0.625, 0], BONE.spine1, { detail: 1 }),
    blob([0.12 * hip, 0.09, 0.09], [0, 0.505, 0], BONE.root, { detail: 1 }),
    // Neck and a rounded head with a softer jaw and cheek volume.
    blob([0.052, 0.09, 0.052], [0, 0.865, 0], BONE.neck, { detail: 1 }),
    blob([0.087, 0.108, 0.09], [0, 0.95, 0], BONE.head, { detail: 1 }),
    blob([0.073, 0.05, 0.074], [0, 0.895, 0.012], BONE.head, { detail: 1 }),
    blob([0.018, 0.027, 0.018], [0.09, 0.94, 0], BONE.head),
    blob([0.018, 0.027, 0.018], [-0.09, 0.94, 0], BONE.head),
    // Shoulder caps and a subtle clavicle bridge.
    blob([0.09 * shoulder, 0.075, 0.09], [0.17, 0.79, 0], BONE.spine2, { detail: 1 }),
    blob([0.09 * shoulder, 0.075, 0.09], [-0.17, 0.79, 0], BONE.spine2, { detail: 1 }),
    blob([0.14 * shoulder, 0.018, 0.018], [0.075, 0.84, 0.108], BONE.spine2),
    blob([0.14 * shoulder, 0.018, 0.018], [-0.075, 0.84, 0.108], BONE.spine2),
  ];
  if (bust > 0) {
    parts.push(
      blob([0.073 * bust, 0.06 * bust, 0.064 * bust], [0.073, 0.75, 0.085], BONE.spine2, { detail: 1 }),
      blob([0.073 * bust, 0.06 * bust, 0.064 * bust], [-0.073, 0.75, 0.085], BONE.spine2, { detail: 1 }),
    );
  }
  parts.push(...limbParts(1, shape), ...limbParts(-1, shape));
  return parts;
}

function faceDetailParts(): Part[] {
  return [
    // Brows, nose definition and lips. Eye whites/irises/highlights use their own material meshes below.
    blob([0.024, 0.006, 0.009], [0.038, 0.976, 0.083], BONE.head, { accessory: true }),
    blob([0.024, 0.006, 0.009], [-0.038, 0.976, 0.083], BONE.head, { accessory: true }),
    blob([0.012, 0.026, 0.015], [0, 0.928, 0.094], BONE.head, { accessory: true }),
    blob([0.027, 0.006, 0.009], [0, 0.895, 0.087], BONE.head, { accessory: true }),
  ];
}
function eyeWhiteParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.019, 0.012, 0.009], [side * 0.038, 0.956, 0.083], BONE.head),
  );
}
function irisParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.008, 0.0085, 0.005], [side * 0.038, 0.956, 0.092], BONE.head),
  );
}
function pupilParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.0042, 0.0055, 0.003], [side * 0.038, 0.956, 0.096], BONE.head),
  );
}
function highlightParts(): Part[] {
  return [-1, 1].map((side) =>
    blob([0.0024, 0.0024, 0.0018], [side * 0.038 - 0.002, 0.959, 0.099], BONE.head),
  );
}

function hairParts(shape: HairShape): Part[] {
  // Keep the hair mass behind the facial plane so it cannot occlude brows or eyes.
  if (shape === "afro")
    return [blob([0.116, 0.103, 0.09], [0, 1.005, -0.035], BONE.head, { detail: 1 })];
  if (shape === "buzz")
    return [blob([0.09, 0.057, 0.07], [0, 1.002, -0.025], BONE.head, { detail: 1 })];
  return [blob([0.09, 0.071, 0.09], [0, 0.985, -0.03], BONE.head, { detail: 1 })];
}

const geometryCache = new Map<string, {
  body: BufferGeometry; face: BufferGeometry; eyes: BufferGeometry; irises: BufferGeometry;
  pupils: BufferGeometry; highlights: BufferGeometry; hair: BufferGeometry;
}>();
function mergeSkinned(parts: readonly Part[], indexOf: Map<BoneName, number>): BufferGeometry {
  const merged = mergeGeometries(parts.map((part) => skinTo(part.geometry, indexOf.get(part.bone) ?? 0)), false);
  if (!merged) throw new Error("Humanoid geometry could not be merged");
  return merged;
}
function geometriesFor(variant: BodyVariant, hairShape: HairShape) {
  const key = `${variant}:${hairShape}`;
  const cached = geometryCache.get(key);
  if (cached) return cached;
  const indexOf = new Map(JOINTS.map((joint, index) => [joint.name, index]));
  const parts = bodyParts(variant);
  const built = {
    body: mergeSkinned(parts, indexOf),
    face: mergeSkinned(faceDetailParts(), indexOf),
    eyes: mergeSkinned(eyeWhiteParts(), indexOf),
    irises: mergeSkinned(irisParts(), indexOf),
    pupils: mergeSkinned(pupilParts(), indexOf),
    highlights: mergeSkinned(highlightParts(), indexOf),
    hair: mergeSkinned(hairParts(hairShape), indexOf),
  };
  geometryCache.set(key, built);
  return built;
}

export type Humanoid = { root: Bone; bones: Bone[]; byName: Map<string, Bone>; meshes: SkinnedMesh[] };
export function createHumanoid({
  variant, skinColor, hairColor, hairShape = "cap",
}: {
  variant: BodyVariant; skinColor: string; hairColor: string | null; hairShape?: HairShape;
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
  const geo = geometriesFor(variant, hairShape);
  const makeMesh = (geometry: BufferGeometry, material: MeshStandardMaterial) => {
    const mesh = new SkinnedMesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.bind(skeleton);
    return mesh;
  };
  const meshes = [
    makeMesh(geo.body, new MeshStandardMaterial({ color: skinColor, roughness: 0.66, metalness: 0, flatShading: false })),
    makeMesh(geo.face, new MeshStandardMaterial({ color: ACCESSORY_COLOR, roughness: 0.58, flatShading: false })),
    makeMesh(geo.eyes, new MeshStandardMaterial({ color: "#f1e9df", roughness: 0.34, flatShading: false })),
    makeMesh(geo.irises, new MeshStandardMaterial({ color: "#3a2118", roughness: 0.28, flatShading: false })),
    makeMesh(geo.pupils, new MeshStandardMaterial({ color: "#100b09", roughness: 0.18, flatShading: false })),
    makeMesh(geo.highlights, new MeshStandardMaterial({ color: "#fffaf2", roughness: 0.12, emissive: "#fffaf2", emissiveIntensity: 0.08, flatShading: false })),
  ];
  if (hairColor) {
    meshes.push(makeMesh(geo.hair, new MeshStandardMaterial({ color: hairColor, roughness: 0.94, metalness: 0, flatShading: false })));
  }
  return { root, bones, byName, meshes };
}
